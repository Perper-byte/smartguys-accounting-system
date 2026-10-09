import { prisma } from '../env'
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

        // Generate 12 months if missing
        if (calendar.length === 0) {
            calendar = Array.from({ length: 12 }).map((_, i) => {
                const month = i;
                const startDate = new Date(targetYear, month, 1);
                const endDate = new Date(targetYear, month + 1, 0, 23, 59, 59, 999);
                return {
                    year: targetYear,
                    periodNumber: i + 1,
                    name: startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + targetYear,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    status: 'OPEN'
                } as AccountingPeriod;
            });
        } else if (calendar.length < 12) {
            // Fill in missing periods if calendar exists but is incomplete
            for (let i = 0; i < 12; i++) {
                if (!calendar.find(p => p.periodNumber === i + 1)) {
                    const month = i;
                    const startDate = new Date(targetYear, month, 1);
                    const endDate = new Date(targetYear, month + 1, 0, 23, 59, 59, 999);
                    calendar.push({
                        year: targetYear,
                        periodNumber: i + 1,
                        name: startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + targetYear,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        status: 'OPEN'
                    });
                }
            }
            calendar.sort((a, b) => a.periodNumber - b.periodNumber);
        }

        // Fetch all revenue and expense lines for the target year
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: {
                    date: {
                        gte: new Date(targetYear, 0, 1),
                        lte: new Date(targetYear, 11, 31, 23, 59, 59, 999)
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
            const startDate = new Date(year, periodNumber - 1, 1);
            const endDate = new Date(year, periodNumber, 0, 23, 59, 59, 999);
            period = {
                year,
                periodNumber,
                name: startDate.toLocaleString('en-US', { month: 'long' }) + ' ' + year,
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
        const month = date.getMonth() + 1; // 1-12
        const setting = await prisma.systemSetting.findFirst();
        if (setting?.accounting_calendar) {
            try {
                const allPeriods: AccountingPeriod[] = JSON.parse(setting.accounting_calendar);
                const period = allPeriods.find(p => p.year === year && p.periodNumber === month);
                if (period && period.status === 'CLOSED') {
                    return true;
                }
            } catch (e) {
                console.error("Failed to parse accounting_calendar JSON:", e);
            }
        }
        return false;
    }
}
