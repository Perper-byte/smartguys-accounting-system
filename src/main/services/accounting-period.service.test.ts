import { AccountingPeriodService } from './accounting-period.service';
import { LedgerService } from './ledger.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
    const mPrismaClient = {
        systemSetting: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        journalLine: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        journalEntry: {
            create: jest.fn(),
            delete: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
        },
        bankTransaction: {
            count: jest.fn().mockResolvedValue(0),
        },
        account: {
            findUnique: jest.fn().mockResolvedValue({ code: '3999', name: 'Income Summary' }),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
        },
        accountType: {
            findFirst: jest.fn().mockResolvedValue({ id: 'type-equity', name: 'Equity' }),
        }
    };
    return { PrismaClient: jest.fn(() => mPrismaClient) };
});

jest.mock('./reports.service', () => ({
    ReportsService: {
        getTrialBalance: jest.fn().mockResolvedValue({ isBalanced: true, totalDebits: 0, totalCredits: 0 }),
        getPostClosingTrialBalance: jest.fn().mockResolvedValue({ isBalanced: true, closedPeriodValid: true, unclosedTemporaryAccounts: [], totalDebits: 0, totalCredits: 0 })
    }
}));

jest.mock('./audit.service', () => ({
    AuditService: {
        logAction: jest.fn()
    }
}));

jest.mock('./ledger.service', () => ({
    LedgerService: {
        verifyManagerPin: jest.fn()
    }
}));

const prisma = new PrismaClient();

describe('AccountingPeriodService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getCalendar produces 12 distinct periods with valid date boundaries', async () => {
        (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([]);

        const year = 2026;
        const calendar = await AccountingPeriodService.getCalendar(year);
        
        expect(calendar.length).toBe(12);
        expect(calendar[0].periodNumber).toBe(1);
        expect(new Date(calendar[0].startDate).getFullYear()).toBe(2026);
        expect(new Date(calendar[0].startDate).getMonth()).toBe(0);
        expect(new Date(calendar[11].endDate).getFullYear()).toBe(2026);
        expect(new Date(calendar[11].endDate).getMonth()).toBe(11);
    });

    test('closePeriod calculation accurately computes Net Income, yields balanced debits and credits, and updates period status to CLOSED', async () => {
        const year = 2026;
        const periodNumber = 1;
        
        // Mock getCalendar
        jest.spyOn(AccountingPeriodService, 'getCalendar').mockResolvedValue([
            { year: 2026, periodNumber: 1, name: 'Jan 2026', startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z', status: 'OPEN' }
        ]);

        (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
            id: 'settings-1',
            accounting_calendar: JSON.stringify([
                { year: 2026, periodNumber: 1, startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z', status: 'OPEN' }
            ])
        });

        (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([
            { account_id: '4010', debit: 0, credit: 5000, account: { account_type: { name: 'Revenue' } } },
            { account_id: '5010', debit: 2000, credit: 0, account: { account_type: { name: 'Expenses' } } }
        ]);

        (prisma.journalEntry.create as jest.Mock).mockResolvedValue({ id: 'je-close-1' });

        await AccountingPeriodService.closePeriod(year, periodNumber, 'admin-1');

        expect(prisma.journalEntry.create).toHaveBeenCalled();
        const callArgs = (prisma.journalEntry.create as jest.Mock).mock.calls[0][0];
        
        expect(callArgs.data.reference_no).toBe('CLOSE-2026-P1');
        
        const lines = callArgs.data.lines.create;
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '4010', debit: 5000, credit: 0 })); // Revenue closed
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '5010', debit: 0, credit: 2000 })); // Expense closed
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3999', debit: 0, credit: 5000 })); // Revenue to Income Summary
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3999', debit: 2000, credit: 0 })); // Expense from Income Summary
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3999', debit: 3000, credit: 0 })); // Net income out of Income Summary
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3010', debit: 0, credit: 3000 })); // Net income to Retained Earnings
        
        // Verify balance
        const totalDebit = lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
        const totalCredit = lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);
        expect(totalDebit).toBe(totalCredit);
        expect(totalDebit).toBe(10000);
        
        expect(prisma.systemSetting.update).toHaveBeenCalled();
        const updateArgs = (prisma.systemSetting.update as jest.Mock).mock.calls[0][0];
        const updatedCalendar = JSON.parse(updateArgs.data.accounting_calendar);
        expect(updatedCalendar[0].status).toBe('CLOSED');
        expect(updatedCalendar[0].closingEntryId).toBe('je-close-1');
        
        (AccountingPeriodService.getCalendar as jest.Mock).mockRestore();
    });

    test('closePeriod correctly processes singular "Expense" account type name from database', async () => {
        jest.spyOn(AccountingPeriodService, 'getCalendar').mockResolvedValue([
            { year: 2026, periodNumber: 2, name: 'Feb 2026', startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-28T23:59:59Z', status: 'OPEN' }
        ]);
        (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
            id: 'settings-1',
            accounting_calendar: JSON.stringify([
                { year: 2026, periodNumber: 2, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-28T23:59:59Z', status: 'OPEN' }
            ])
        });
        (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([
            { account_id: '4010', debit: 0, credit: 8000, account: { account_type: { name: 'Revenue' } } },
            { account_id: '5020', debit: 3000, credit: 0, account: { account_type: { name: 'Expense' } } } // Singular 'Expense'
        ]);
        (prisma.journalEntry.create as jest.Mock).mockResolvedValue({ id: 'je-close-2' });

        await AccountingPeriodService.closePeriod(2026, 2, 'admin-1');
        const callArgs = (prisma.journalEntry.create as jest.Mock).mock.calls[0][0];
        const lines = callArgs.data.lines.create;

        // Verify Expense was closed despite singular name
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '5020', debit: 0, credit: 3000 }));
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3010', debit: 0, credit: 5000 })); // 8000 - 3000
        (AccountingPeriodService.getCalendar as jest.Mock).mockRestore();
    });

    test('closePeriod on Period 12 closes Owner Drawings (3020) to Owner Capital (3010)', async () => {
        jest.spyOn(AccountingPeriodService, 'getCalendar').mockResolvedValue([
            { year: 2026, periodNumber: 12, name: 'Dec 2026', startDate: '2026-12-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', status: 'OPEN' }
        ]);
        (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
            id: 'settings-1',
            accounting_calendar: JSON.stringify([
                { year: 2026, periodNumber: 12, startDate: '2026-12-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', status: 'OPEN' }
            ])
        });
        (prisma.journalLine.findMany as jest.Mock)
            .mockResolvedValueOnce([
                { account_id: '4010', debit: 0, credit: 10000, account: { account_type: { name: 'Revenue' } } }
            ])
            .mockResolvedValueOnce([
                { account_id: '3020', debit: 4000, credit: 0 } // Drawings line
            ]);
        (prisma.journalEntry.create as jest.Mock).mockResolvedValue({ id: 'je-close-12' });

        await AccountingPeriodService.closePeriod(2026, 12, 'admin-1');
        const callArgs = (prisma.journalEntry.create as jest.Mock).mock.calls[0][0];
        const lines = callArgs.data.lines.create;

        // Verify 3020 drawings credited and 3010 debited
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3020', debit: 0, credit: 4000 }));
        expect(lines).toContainEqual(expect.objectContaining({ account_id: '3010', debit: 4000, credit: 0 }));
        (AccountingPeriodService.getCalendar as jest.Mock).mockRestore();
    });

    test('validatePreClose detects out-of-balance ledgers and unclosed items', async () => {
        jest.spyOn(AccountingPeriodService, 'getCalendar').mockResolvedValue([
            { year: 2026, periodNumber: 1, name: 'Jan 2026', startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z', status: 'OPEN' }
        ]);
        const validation = await AccountingPeriodService.validatePreClose(2026, 1);
        expect(typeof validation.canClose).toBe('boolean');
        expect(Array.isArray(validation.warnings)).toBe(true);
        expect(Array.isArray(validation.errors)).toBe(true);
        (AccountingPeriodService.getCalendar as jest.Mock).mockRestore();
    });

    test('isDateInClosedPeriod returns true for dates in closed periods and false for open periods', async () => {
        (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
            accounting_calendar: JSON.stringify([
                { year: 2026, periodNumber: 1, status: 'CLOSED' },
                { year: 2026, periodNumber: 2, status: 'OPEN' }
            ])
        });

        const isJanClosed = await AccountingPeriodService.isDateInClosedPeriod(new Date('2026-01-15'));
        expect(isJanClosed).toBe(true);

        const isFebClosed = await AccountingPeriodService.isDateInClosedPeriod(new Date('2026-02-15'));
        expect(isFebClosed).toBe(false);
    });

    test('reopenPeriod properly reverts status to OPEN when valid PIN is supplied and rejects invalid PINs', async () => {
        (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
            id: 'settings-1',
            accounting_calendar: JSON.stringify([
                { year: 2026, periodNumber: 1, status: 'CLOSED', closingEntryId: 'je-1' }
            ])
        });

        // Test Invalid PIN
        (LedgerService.verifyManagerPin as jest.Mock).mockResolvedValue({ success: false, error: 'Invalid PIN' });
        await expect(AccountingPeriodService.reopenPeriod(2026, 1, 'admin-1', '0000')).rejects.toThrow('Invalid PIN');

        // Test Valid PIN
        (LedgerService.verifyManagerPin as jest.Mock).mockResolvedValue({ success: true });
        await AccountingPeriodService.reopenPeriod(2026, 1, 'admin-1', '1234');

        expect(prisma.journalLine.deleteMany).toHaveBeenCalledWith({ where: { entry_id: 'je-1' } });
        expect(prisma.journalEntry.delete).toHaveBeenCalledWith({ where: { id: 'je-1' } });
        
        const updateArgs = (prisma.systemSetting.update as jest.Mock).mock.calls[0][0];
        const updatedCalendar = JSON.parse(updateArgs.data.accounting_calendar);
        expect(updatedCalendar[0].status).toBe('OPEN');
        expect(updatedCalendar[0].closingEntryId).toBeUndefined();
    });
});
