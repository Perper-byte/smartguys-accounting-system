import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { AuditService } from './audit.service'
import { ReportsService } from './reports.service'
import { LedgerService } from './ledger.service'

export type PeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

export interface AccountingPeriod {
    year: number;
    periodNumber: number;
    name: string;
    periodName?: string;
    startDate: string;
    endDate: string;
    status: PeriodStatus;
    closedAt?: string;
    closedBy?: string;
    closingEntryId?: string;
    totalRevenue?: number;
    totalExpenses?: number;
    netIncome?: number;
}

export class AccountingPeriodService {
    static async getCalendar(year?: number): Promise<AccountingPeriod[]> {
        const targetYear = year || new Date().getFullYear();
        const setting = await prisma.systemSetting.findFirst();
        
        let storedPeriods: AccountingPeriod[] = [];
        if (setting?.accounting_calendar) {
            try {
                storedPeriods = JSON.parse(setting.accounting_calendar);
            } catch (e) {
                console.error("Failed to parse accounting_calendar JSON:", e);
            }
        }

        const startMonth = (setting?.fiscal_year_start_month || 1) - 1;

        // Generate exactly 12 deterministic months based on startMonth and targetYear
        const calendar: AccountingPeriod[] = Array.from({ length: 12 }).map((_, i) => {
            const monthOffset = startMonth + i;
            const actualYear = targetYear + Math.floor(monthOffset / 12);
            const actualMonth = monthOffset % 12;
            const startDate = new Date(actualYear, actualMonth, 1);
            const endDate = new Date(actualYear, actualMonth + 1, 0, 23, 59, 59, 999);
            const periodName = startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + actualYear;

            // Match stored period by actual month & year (or fallback to periodNumber for legacy/mock data)
            const match = storedPeriods.find(p => {
                if (p.startDate) {
                    const pStart = new Date(p.startDate);
                    return pStart.getFullYear() === actualYear && pStart.getMonth() === actualMonth;
                }
                return p.periodNumber === i + 1 && (!p.year || p.year === targetYear);
            });

            return {
                year: targetYear,
                periodNumber: i + 1,
                name: periodName,
                periodName: periodName,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                status: match?.status || 'OPEN',
                closedAt: match?.closedAt,
                closedBy: match?.closedBy,
                closingEntryId: match?.closingEntryId,
                totalRevenue: 0,
                totalExpenses: 0,
                netIncome: 0
            } as AccountingPeriod;
        });

        const fiscalStart = new Date(targetYear + Math.floor(startMonth / 12), startMonth % 12, 1);
        const endMonthOffset = startMonth + 11;
        const endYear = targetYear + Math.floor(endMonthOffset / 12);
        const endMonth = endMonthOffset % 12;
        const fiscalEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59, 999);

        // Fetch all revenue and expense lines for the target year (exclude voided entries & closing entries)
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: {
                    date: {
                        gte: fiscalStart,
                        lte: fiscalEnd
                    },
                    status: 'ACTIVE',
                    NOT: {
                        reference_no: { startsWith: 'CLOSE-' }
                    }
                },
                account: {
                    account_type: {
                        name: { in: ['Revenue', 'Expense', 'Expenses'] }
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

            const periodLines = lines.filter(line => {
                const rawDate = line.entry?.date || line.date;
                if (!rawDate) return false;
                const d = new Date(rawDate);
                return d >= start && d <= end;
            });

            let totalRevenue = 0;
            let totalExpense = 0;

            for (const line of periodLines) {
                const amount = Number(line.credit) - Number(line.debit);
                const typeName = (line.account?.account_type?.name || '').toLowerCase();
                if (typeName === 'revenue') {
                    totalRevenue += amount;
                } else if (typeName === 'expense' || typeName === 'expenses') {
                    // Expenses have normal debit balance, so debit - credit
                    totalExpense += (Number(line.debit) - Number(line.credit));
                }
            }

            const formattedName = period.name || period.periodName || `${start.toLocaleString('en-US', { month: 'long' })} ${period.year}`;
            period.name = formattedName;
            period.periodName = formattedName;
            period.totalRevenue = Number(totalRevenue.toFixed(2));
            period.totalExpenses = Number(totalExpense.toFixed(2));
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
    static async ensureIncomeSummaryAccount(): Promise<void> {
        if (typeof (prisma as any).account?.findUnique === 'function') {
            const existing = await prisma.account.findUnique({ where: { code: '3999' } });
            if (!existing) {
                let equityType = typeof (prisma as any).accountType?.findFirst === 'function'
                    ? await prisma.accountType.findFirst({
                        where: { name: { in: ['Equity', 'equity'] } }
                    })
                    : null;
                if (!equityType && typeof (prisma as any).accountType?.findFirst === 'function') {
                    equityType = await prisma.accountType.findFirst();
                }
                if (typeof (prisma as any).account?.create === 'function') {
                    await prisma.account.create({
                        data: {
                            code: '3999',
                            name: 'Income Summary',
                            type_id: equityType ? equityType.id : 'type-equity'
                        }
                    });
                }
            }
        }
    }

    static async validatePreClose(year: number, periodNumber: number): Promise<{
        canClose: boolean;
        unmatchedBankCount: number;
        pendingVoidCount: number;
        isLedgerBalanced: boolean;
        unbalancedDifference: number;
        warnings: string[];
        errors: string[];
    }> {
        const calendar = await this.getCalendar(year);
        const period = calendar.find(p => p.periodNumber === periodNumber);
        if (!period) throw new Error('Period not found');

        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);

        const unmatchedBankCount = typeof (prisma as any).bankTransaction?.count === 'function' ? await (prisma as any).bankTransaction.count({
            where: {
                status: 'UNMATCHED',
                transaction_date: { gte: startDate, lte: endDate },
                removed_at: null
            }
        }) : 0;

        const pendingVoidCount = typeof (prisma as any).journalEntry?.count === 'function' ? await (prisma as any).journalEntry.count({
            where: {
                status: 'VOID_REQUESTED',
                date: { gte: startDate, lte: endDate }
            }
        }) : 0;

        const tb = typeof ReportsService?.getTrialBalance === 'function'
            ? await ReportsService.getTrialBalance(undefined, endDate)
            : { isBalanced: true, totalDebits: 0, totalCredits: 0 };
        const isLedgerBalanced = !!tb.isBalanced;
        const unbalancedDifference = Math.abs((tb.totalDebits || 0) - (tb.totalCredits || 0));

        const warnings: string[] = [];
        const errors: string[] = [];

        if (!isLedgerBalanced) {
            errors.push(`Pre-closing trial balance is out of balance by ₱${unbalancedDifference.toFixed(2)} (Debits: ₱${tb.totalDebits.toFixed(2)} vs Credits: ₱${tb.totalCredits.toFixed(2)})`);
        }

        if (pendingVoidCount > 0) {
            errors.push(`There are ${pendingVoidCount} pending void requests in this period awaiting decision`);
        }

        const priorOpenPeriod = calendar
            .filter(p => p.year === year && p.periodNumber < periodNumber)
            .find(p => p.status !== 'CLOSED');
        if (priorOpenPeriod) {
            errors.push(`Prior period ${priorOpenPeriod.periodNumber} (${priorOpenPeriod.periodName || priorOpenPeriod.name}) must be closed before closing period ${periodNumber}.`);
        }

        const subsequentClosedPeriod = calendar
            .filter(p => p.year === year && p.periodNumber > periodNumber)
            .find(p => p.status === 'CLOSED');
        if (subsequentClosedPeriod) {
            errors.push(`Cannot close period ${periodNumber} because a later period (${subsequentClosedPeriod.periodNumber} - ${subsequentClosedPeriod.periodName || subsequentClosedPeriod.name}) is already closed.`);
        }

        if (unmatchedBankCount > 0) {
            warnings.push(`There are ${unmatchedBankCount} unmatched bank transactions in this period`);
        }

        return {
            canClose: errors.length === 0,
            unmatchedBankCount,
            pendingVoidCount,
            isLedgerBalanced,
            unbalancedDifference,
            warnings,
            errors
        };
    }

    static async closePeriod(year: number, periodNumber: number, userId: string, options?: { forceUnmatchedBank?: boolean }): Promise<void> {
        const calendar = await this.getCalendar(year);
        const period = calendar.find(p => p.periodNumber === periodNumber);
        
        if (!period) throw new Error('Period not found');
        if (period.status === 'CLOSED') throw new Error('Period is already closed');

        // Pre-Closing Integrity Validations
        const validation = await this.validatePreClose(year, periodNumber);
        if (!validation.canClose) {
            throw new Error(`PRE-CLOSE VALIDATION FAILED: ${validation.errors.join('; ')}`);
        }
        if (validation.unmatchedBankCount > 0 && !options?.forceUnmatchedBank) {
            throw new Error(`PRE-CLOSE WARNING: There are ${validation.unmatchedBankCount} unmatched bank transactions in this period. Reconcile bank transactions before closing or confirm override.`);
        }

        await this.ensureIncomeSummaryAccount();

        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);

        // Fetch all lines up to period endDate for Revenue/Expense to close all unclosed cumulative balances
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: { 
                    date: { lte: endDate }, 
                    status: 'ACTIVE',
                    NOT: {
                        reference_no: `CLOSE-${year}-P${periodNumber}`
                    }
                },
                account: { account_type: { name: { in: ['Revenue', 'Expense', 'Expenses'] } } }
            },
            include: { account: { include: { account_type: true } } }
        });

        // Calculate balances per account
        const accountBalances: Record<string, { type: string; balance: number }> = {};
        let totalRevenue = 0;
        let totalExpense = 0;

        for (const line of lines) {
            const accId = line.account_id;
            const accType = (line.account?.account_type?.name || '').toLowerCase();
            if (!accountBalances[accId]) {
                accountBalances[accId] = { type: accType, balance: 0 };
            }
            if (accType === 'revenue') {
                const amt = Number(line.credit) - Number(line.debit);
                accountBalances[accId].balance += amt;
                totalRevenue += amt;
            } else if (accType === 'expense' || accType === 'expenses') {
                const amt = Number(line.debit) - Number(line.credit);
                accountBalances[accId].balance += amt;
                totalExpense += amt;
            }
        }

        const netIncome = Number((totalRevenue - totalExpense).toFixed(2));

        const closingLines: { accountId: string; debit: number; credit: number }[] = [];
        let totalDebits = 0;
        let totalCredits = 0;

        // Step 1: Close Revenues to 3999 Income Summary
        // Step 2: Close Expenses to 3999 Income Summary
        for (const [accId, data] of Object.entries(accountBalances)) {
            if (data.balance === 0) continue;

            if (data.type === 'revenue') {
                if (data.balance > 0) {
                    closingLines.push({ accountId: accId, debit: data.balance, credit: 0 });
                    closingLines.push({ accountId: '3999', debit: 0, credit: data.balance });
                    totalDebits += data.balance;
                    totalCredits += data.balance;
                } else {
                    closingLines.push({ accountId: accId, debit: 0, credit: Math.abs(data.balance) });
                    closingLines.push({ accountId: '3999', debit: Math.abs(data.balance), credit: 0 });
                    totalDebits += Math.abs(data.balance);
                    totalCredits += Math.abs(data.balance);
                }
            } else if (data.type === 'expense' || data.type === 'expenses') {
                if (data.balance > 0) {
                    closingLines.push({ accountId: '3999', debit: data.balance, credit: 0 });
                    closingLines.push({ accountId: accId, debit: 0, credit: data.balance });
                    totalDebits += data.balance;
                    totalCredits += data.balance;
                } else {
                    closingLines.push({ accountId: '3999', debit: 0, credit: Math.abs(data.balance) });
                    closingLines.push({ accountId: accId, debit: Math.abs(data.balance), credit: 0 });
                    totalDebits += Math.abs(data.balance);
                    totalCredits += Math.abs(data.balance);
                }
            }
        }

        // Step 3: Close 3999 Income Summary to Retained Earnings (Owner's Capital '3010')
        if (netIncome > 0) {
            closingLines.push({ accountId: '3999', debit: netIncome, credit: 0 });
            closingLines.push({ accountId: '3010', debit: 0, credit: netIncome });
            totalDebits += netIncome;
            totalCredits += netIncome;
        } else if (netIncome < 0) {
            closingLines.push({ accountId: '3999', debit: 0, credit: Math.abs(netIncome) });
            closingLines.push({ accountId: '3010', debit: Math.abs(netIncome), credit: 0 });
            totalDebits += Math.abs(netIncome);
            totalCredits += Math.abs(netIncome);
        }

        // Step 4: Year-End Close (Period 12) - Close 3020 Owner's Drawings to 3010 Owner's Capital
        if (periodNumber === 12) {
            const drawingsLines = await prisma.journalLine.findMany({
                where: {
                    account_id: '3020',
                    entry: {
                        date: { lte: endDate },
                        status: 'ACTIVE',
                        NOT: { reference_no: { startsWith: 'CLOSE-' } }
                    }
                }
            });
            let drawingsBalance = 0;
            for (const dl of drawingsLines) {
                drawingsBalance += Number(dl.debit) - Number(dl.credit);
            }
            if (Math.abs(drawingsBalance) > 0.005) {
                if (drawingsBalance > 0) {
                    closingLines.push({ accountId: '3010', debit: drawingsBalance, credit: 0 });
                    closingLines.push({ accountId: '3020', debit: 0, credit: drawingsBalance });
                    totalDebits += drawingsBalance;
                    totalCredits += drawingsBalance;
                } else {
                    closingLines.push({ accountId: '3020', debit: Math.abs(drawingsBalance), credit: 0 });
                    closingLines.push({ accountId: '3010', debit: 0, credit: Math.abs(drawingsBalance) });
                    totalDebits += Math.abs(drawingsBalance);
                    totalCredits += Math.abs(drawingsBalance);
                }
            }
        }

        // Strict balance check
        if (Math.abs(totalDebits - totalCredits) > 0.005) {
            throw new Error(`Closing entries do not balance: Debits ${totalDebits} vs Credits ${totalCredits}`);
        }

        let entryId: string | undefined;

        if (closingLines.length > 0) {
            const entry = await prisma.journalEntry.create({
                data: {
                    date: endDate,
                    reference_no: `CLOSE-${year}-P${periodNumber}`,
                    description: `Period-End Closing Entry for Period ${periodNumber} (${year})${periodNumber === 12 ? ' - Annual Fiscal Year-End Close' : ''}`,
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

            // Step 5: Post-Closing Integrity Verification
            const postCloseTb = typeof ReportsService?.getPostClosingTrialBalance === 'function'
                ? await ReportsService.getPostClosingTrialBalance(year, periodNumber, undefined, endDate)
                : { isBalanced: true, closedPeriodValid: true, unclosedTemporaryAccounts: [], totalDebits: 0, totalCredits: 0 };
            if (!postCloseTb.isBalanced) {
                // Rollback closing entry
                await prisma.journalLine.deleteMany({ where: { entry_id: entry.id } });
                await prisma.journalEntry.delete({ where: { id: entry.id } });
                throw new Error(`POST-CLOSE INTEGRITY FAILURE: Post-closing trial balance failed debit-credit equilibrium check (Debits: ${postCloseTb.totalDebits} vs Credits: ${postCloseTb.totalCredits}).`);
            }
            if (!postCloseTb.closedPeriodValid) {
                // Rollback closing entry
                await prisma.journalLine.deleteMany({ where: { entry_id: entry.id } });
                await prisma.journalEntry.delete({ where: { id: entry.id } });
                throw new Error(`POST-CLOSE INTEGRITY FAILURE: The following temporary accounts failed to reset to exactly $0.00: ${postCloseTb.unclosedTemporaryAccounts.join(', ')}`);
            }
        }

        // Update period status
        let setting = await prisma.systemSetting.findFirst();
        if (!setting) {
            setting = await prisma.systemSetting.create({ data: {} });
        }
        
        let allPeriods: AccountingPeriod[] = setting.accounting_calendar ? JSON.parse(setting.accounting_calendar) : [];
        const periodStart = new Date(period.startDate);
        let p = allPeriods.find(existing => {
            const d = new Date(existing.startDate);
            return d.getFullYear() === periodStart.getFullYear() && d.getMonth() === periodStart.getMonth();
        });
        if (!p) {
            p = { ...period };
            allPeriods.push(p);
        }
        
        p.status = 'CLOSED';
        p.closedAt = new Date().toISOString();
        p.closedBy = userId;
        p.closingEntryId = entryId;
        p.startDate = period.startDate;
        p.endDate = period.endDate;
        p.name = period.name;
        p.periodName = period.periodName;
        p.year = year;
        p.periodNumber = periodNumber;
        
        await prisma.systemSetting.update({
            where: { id: setting.id },
            data: { accounting_calendar: JSON.stringify(allPeriods) }
        });
        
        await AuditService.logAction(userId, 'PERIOD_MANAGEMENT', `Closed period ${periodNumber} of ${year} with net income ${netIncome}`);
    }

    static async reopenPeriod(year: number, periodNumber: number, userId: string, managerPin: string): Promise<void> {
        const pinCheck = await LedgerService.verifyManagerPin(managerPin);
        if (!pinCheck.success) {
            throw new Error(pinCheck.error);
        }

        const calendar = await this.getCalendar(year);
        const targetPeriod = calendar.find(p => p.periodNumber === periodNumber);
        if (!targetPeriod) throw new Error('Period not found');
        if (targetPeriod.status !== 'CLOSED') throw new Error('Period is not closed');

        const subsequentClosedPeriod = calendar
            .filter(p => p.year === year && p.periodNumber > periodNumber)
            .find(p => p.status === 'CLOSED');
        if (subsequentClosedPeriod) {
            throw new Error(`Cannot reopen period ${periodNumber} because a later period (${subsequentClosedPeriod.periodNumber} - ${subsequentClosedPeriod.periodName || subsequentClosedPeriod.name}) is currently closed. Reopen subsequent periods first.`);
        }

        const setting = await prisma.systemSetting.findFirst();
        if (!setting || !setting.accounting_calendar) {
            throw new Error('No accounting calendar found');
        }

        const allPeriods: AccountingPeriod[] = JSON.parse(setting.accounting_calendar);
        const periodStart = new Date(targetPeriod.startDate);
        const period = allPeriods.find(existing => {
            if (existing.startDate) {
                const d = new Date(existing.startDate);
                return d.getFullYear() === periodStart.getFullYear() && d.getMonth() === periodStart.getMonth();
            }
            return existing.periodNumber === periodNumber && (!existing.year || existing.year === year);
        });

        const closingId = targetPeriod.closingEntryId || period?.closingEntryId;
        if (closingId) {
            // Delete the closing entry completely
            await prisma.journalLine.deleteMany({ where: { entry_id: closingId } });
            try {
                await prisma.journalEntry.delete({ where: { id: closingId } });
            } catch {}
        } else {
            const fallbackEntry = await prisma.journalEntry.findFirst({
                where: { reference_no: `CLOSE-${year}-P${periodNumber}` }
            });
            if (fallbackEntry) {
                await prisma.journalLine.deleteMany({ where: { entry_id: fallbackEntry.id } });
                await prisma.journalEntry.delete({ where: { id: fallbackEntry.id } });
            }
        }

        if (period) {
            period.status = 'OPEN';
            period.closedAt = undefined;
            period.closedBy = undefined;
            period.closingEntryId = undefined;
        }

        await prisma.systemSetting.update({
            where: { id: setting.id },
            data: { accounting_calendar: JSON.stringify(allPeriods) }
        });

        await AuditService.logAction(userId, 'REOPEN_PERIOD', `Reopened period ${periodNumber} of ${year}`);
    }
}
