import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { AuditService } from './audit.service'

export type PeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

export interface AccountingPeriod {
    year: number;
    periodNumber: number;
    name: string;
    startDate: string;
    endDate: string;
    status: PeriodStatus;
    closedAt?: string;
    closedBy?: string;
    closingEntryId?: string;
    netIncome?: number;
}

export class AccountingPeriodService {
    static async getCalendar(year?: number): Promise<AccountingPeriod[]> {
        const targetYear = year || new Date().getFullYear();
        const setting = await prisma.systemSetting.findFirst();
        
        let calendar: AccountingPeriod[] = [];
        if (setting?.accounting_calendar) {
            try {
                const allPeriods: AccountingPeriod[] = JSON.parse(setting.accounting_calendar);
                calendar = allPeriods.filter(p => p.year === targetYear);
            } catch (e) {
                console.error("Failed to parse accounting_calendar JSON:", e);
            }
        }

        const startMonth = (setting?.fiscal_year_start_month || 1) - 1;

        // Generate 12 months if missing
        if (calendar.length === 0) {
            calendar = Array.from({ length: 12 }).map((_, i) => {
                const monthOffset = startMonth + i;
                const actualYear = targetYear + Math.floor(monthOffset / 12);
                const actualMonth = monthOffset % 12;
                const startDate = new Date(actualYear, actualMonth, 1);
                const endDate = new Date(actualYear, actualMonth + 1, 0, 23, 59, 59, 999);
                return {
                    year: targetYear,
                    periodNumber: i + 1,
                    name: startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + actualYear,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    status: 'OPEN'
                } as AccountingPeriod;
            });
        } else if (calendar.length < 12) {
            // Fill in missing periods if calendar exists but is incomplete
            for (let i = 0; i < 12; i++) {
                if (!calendar.find(p => p.periodNumber === i + 1)) {
                    const monthOffset = startMonth + i;
                    const actualYear = targetYear + Math.floor(monthOffset / 12);
                    const actualMonth = monthOffset % 12;
                    const startDate = new Date(actualYear, actualMonth, 1);
                    const endDate = new Date(actualYear, actualMonth + 1, 0, 23, 59, 59, 999);
                    calendar.push({
                        year: targetYear,
                        periodNumber: i + 1,
                        name: startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + actualYear,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        status: 'OPEN'
                    });
                }
            }
            calendar.sort((a, b) => a.periodNumber - b.periodNumber);
        }

        const fiscalStart = new Date(targetYear + Math.floor(startMonth / 12), startMonth % 12, 1);
        const endMonthOffset = startMonth + 11;
        const endYear = targetYear + Math.floor(endMonthOffset / 12);
        const endMonth = endMonthOffset % 12;
        const fiscalEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59, 999);

        // Fetch all revenue and expense lines for the target year
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: {
                    date: {
                        gte: fiscalStart,
                        lte: fiscalEnd
                    }
                },
                account: {
                    account_type: {
                        name: { in: ['Revenue', 'Expenses'] }
                    }
                }
            },
            include: {
                entry: true,
                account: {
                    include: { account_type: true }
                }
            }
        });

        // Compute net income per period
        for (const period of calendar) {
            const start = new Date(period.startDate);
            const end = new Date(period.endDate);

            const periodLines = lines.filter(line => 
                new Date(line.entry.date) >= start && new Date(line.entry.date) <= end
            );

            let totalRevenue = 0;
            let totalExpense = 0;

            for (const line of periodLines) {
                const amount = Number(line.credit) - Number(line.debit);
                if (line.account.account_type.name === 'Revenue') {
                    totalRevenue += amount;
                } else if (line.account.account_type.name === 'Expenses') {
                    // Expenses have normal debit balance, so debit - credit
                    totalExpense += (Number(line.debit) - Number(line.credit));
                }
            }

            period.netIncome = Number((totalRevenue - totalExpense).toFixed(2));
        }

        return calendar;
    }
    
    static async updatePeriodStatus(year: number, periodNumber: number, status: PeriodStatus, userId: string): Promise<void> {
        let setting = await prisma.systemSetting.findFirst();
        if (!setting) {
            setting = await prisma.systemSetting.create({ data: {} });
        }
        
        let allPeriods: AccountingPeriod[] = [];
        if (setting.accounting_calendar) {
            try {
                allPeriods = JSON.parse(setting.accounting_calendar);
            } catch (e) {
                console.error("Failed to parse accounting_calendar JSON:", e);
            }
        }
        
        // Ensure standard bounds for the requested period if missing
        let period = allPeriods.find(p => p.year === year && p.periodNumber === periodNumber);
        if (!period) {
            const startMonth = (setting.fiscal_year_start_month || 1) - 1;
            const monthOffset = startMonth + (periodNumber - 1);
            const actualYear = year + Math.floor(monthOffset / 12);
            const actualMonth = monthOffset % 12;
            const startDate = new Date(actualYear, actualMonth, 1);
            const endDate = new Date(actualYear, actualMonth + 1, 0, 23, 59, 59, 999);
            period = {
                year,
                periodNumber,
                name: startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + actualYear,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                status: 'OPEN'
            };
            allPeriods.push(period);
        }
        
        period.status = status;
        if (status === 'CLOSED') {
            period.closedAt = new Date().toISOString();
            period.closedBy = userId;
        } else {
            period.closedAt = undefined;
            period.closedBy = undefined;
            period.closingEntryId = undefined;
        }
        
        await prisma.systemSetting.update({
            where: { id: setting.id },
            data: { accounting_calendar: JSON.stringify(allPeriods) }
        });
        
        await AuditService.logAction(userId, 'PERIOD_MANAGEMENT', `Updated period ${periodNumber} of ${year} to ${status}`);
    }

    static async isDateInClosedPeriod(date: Date): Promise<boolean> {
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        const setting = await prisma.systemSetting.findFirst();
        const startMonth = (setting?.fiscal_year_start_month || 1) - 1;
        
        let fiscalYear = year;
        let periodNumber = 0;
        
        if (month >= startMonth) {
            fiscalYear = year;
            periodNumber = month - startMonth + 1;
        } else {
            fiscalYear = year - 1;
            periodNumber = (12 - startMonth) + month + 1;
        }

        if (setting?.accounting_calendar) {
            try {
                const allPeriods: AccountingPeriod[] = JSON.parse(setting.accounting_calendar);
                const period = allPeriods.find(p => p.year === fiscalYear && p.periodNumber === periodNumber);
                if (period && period.status === 'CLOSED') {
                    return true;
                }
            } catch (e) {
                console.error("Failed to parse accounting_calendar JSON:", e);
            }
        }
        return false;
    }
    static async closePeriod(year: number, periodNumber: number, userId: string): Promise<void> {
        const calendar = await this.getCalendar(year);
        const period = calendar.find(p => p.periodNumber === periodNumber);
        
        if (!period) throw new Error('Period not found');
        if (period.status === 'CLOSED') throw new Error('Period is already closed');

        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);

        // Fetch all lines in the period for Revenue/Expense
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' },
                account: { account_type: { name: { in: ['Revenue', 'Expenses'] } } }
            },
            include: { account: { include: { account_type: true } } }
        });

        // Calculate balances per account
        const accountBalances: Record<string, { type: string; balance: number }> = {};
        let totalRevenue = 0;
        let totalExpense = 0;

        for (const line of lines) {
            const accId = line.account_id;
            if (!accountBalances[accId]) {
                accountBalances[accId] = { type: line.account.account_type.name, balance: 0 };
            }
            if (line.account.account_type.name === 'Revenue') {
                const amt = Number(line.credit) - Number(line.debit);
                accountBalances[accId].balance += amt;
                totalRevenue += amt;
            } else if (line.account.account_type.name === 'Expenses') {
                const amt = Number(line.debit) - Number(line.credit);
                accountBalances[accId].balance += amt;
                totalExpense += amt;
            }
        }

        const netIncome = totalRevenue - totalExpense;

        const closingLines: { accountId: string; debit: number; credit: number }[] = [];
        let totalDebits = 0;
        let totalCredits = 0;

        for (const [accId, data] of Object.entries(accountBalances)) {
            if (data.balance === 0) continue;

            if (data.type === 'Revenue') {
                if (data.balance > 0) {
                    closingLines.push({ accountId: accId, debit: data.balance, credit: 0 });
                    totalDebits += data.balance;
                } else {
                    closingLines.push({ accountId: accId, debit: 0, credit: Math.abs(data.balance) });
                    totalCredits += Math.abs(data.balance);
                }
            } else if (data.type === 'Expenses') {
                if (data.balance > 0) {
                    closingLines.push({ accountId: accId, debit: 0, credit: data.balance });
                    totalCredits += data.balance;
                } else {
                    closingLines.push({ accountId: accId, debit: Math.abs(data.balance), credit: 0 });
                    totalDebits += Math.abs(data.balance);
                }
            }
        }

        // Close to Retained Earnings (Owner's Capital '3010')
        if (netIncome > 0) {
            closingLines.push({ accountId: '3010', debit: 0, credit: netIncome });
            totalCredits += netIncome;
        } else if (netIncome < 0) {
            closingLines.push({ accountId: '3010', debit: Math.abs(netIncome), credit: 0 });
            totalDebits += Math.abs(netIncome);
        }

        // Strict balance check (allowing small floating point diffs just in case, but should be exact)
        if (Math.abs(totalDebits - totalCredits) > 0.005) {
            throw new Error(`Closing entries do not balance: Debits ${totalDebits} vs Credits ${totalCredits}`);
        }

        let entryId: string | undefined;

        if (closingLines.length > 0) {
            const entry = await prisma.journalEntry.create({
                data: {
                    date: endDate,
                    reference_no: `CLOSE-${year}-P${periodNumber}`,
                    description: `Period-End Closing Entry for Period ${periodNumber} (${year})`,
                    user_id: userId,
                    vat_type: 'EXEMPT',
                    lines: {
                        create: closingLines.map(l => ({
                            account_id: l.accountId,
                            debit: l.debit,
                            credit: l.credit
                        }))
                    }
                }
            });
            entryId = entry.id;
        }

        // Update period status
        let setting = await prisma.systemSetting.findFirst();
        if (!setting) {
            setting = await prisma.systemSetting.create({ data: {} });
        }
        
        let allPeriods: AccountingPeriod[] = setting.accounting_calendar ? JSON.parse(setting.accounting_calendar) : [];
        let p = allPeriods.find(p => p.year === year && p.periodNumber === periodNumber);
        if (!p) {
            p = { ...period };
            allPeriods.push(p);
        }
        
        p.status = 'CLOSED';
        p.closedAt = new Date().toISOString();
        p.closedBy = userId;
        p.closingEntryId = entryId;
        
        await prisma.systemSetting.update({
            where: { id: setting.id },
            data: { accounting_calendar: JSON.stringify(allPeriods) }
        });
        
        await AuditService.logAction(userId, 'PERIOD_MANAGEMENT', `Closed period ${periodNumber} of ${year} with net income ${netIncome}`);
    }

    static async reopenPeriod(year: number, periodNumber: number, userId: string, managerPin: string): Promise<void> {
        const { LedgerService } = require('./ledger.service');
        const pinCheck = await LedgerService.verifyManagerPin(managerPin);
        if (!pinCheck.success) {
            throw new Error(pinCheck.error);
        }

        const setting = await prisma.systemSetting.findFirst();
        if (!setting || !setting.accounting_calendar) {
            throw new Error('No accounting calendar found');
        }

        const allPeriods: AccountingPeriod[] = JSON.parse(setting.accounting_calendar);
        const period = allPeriods.find(p => p.year === year && p.periodNumber === periodNumber);

        if (!period) throw new Error('Period not found');
        if (period.status !== 'CLOSED') throw new Error('Period is not closed');

        if (period.closingEntryId) {
            // Delete the closing entry completely
            await prisma.journalLine.deleteMany({ where: { entry_id: period.closingEntryId } });
            await prisma.journalEntry.delete({ where: { id: period.closingEntryId } });
        }

        period.status = 'OPEN';
        period.closedAt = undefined;
        period.closedBy = undefined;
        period.closingEntryId = undefined;

        await prisma.systemSetting.update({
            where: { id: setting.id },
            data: { accounting_calendar: JSON.stringify(allPeriods) }
        });

        await AuditService.logAction(userId, 'REOPEN_PERIOD', `Reopened period ${periodNumber} of ${year}`);
    }
}
