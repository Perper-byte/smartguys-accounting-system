// src/main/services/analytics.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsService {
    static async getDashboardMetrics(timeframe: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly') {
        const now = new Date();

        const trendLabels: string[] = [];
        const trendRevenue: number[] = [];
        const trendExpenses: number[] = [];

        let currentPeriodRevenue = 0;
        let currentPeriodExpenses = 0;

        let periods = 6;
        if (timeframe === 'daily') periods = 7;     // 7 days
        if (timeframe === 'weekly') periods = 4;    // 4 weeks
        if (timeframe === 'quarterly') periods = 4; // 4 quarters
        if (timeframe === 'yearly') periods = 5;    // 5 years

        let overallStartOfTrend: Date | null = null;

        // 1. GENERATE THE DYNAMIC HISTORICAL TREND
        for (let i = periods - 1; i >= 0; i--) {
            let startOfPeriod: Date, endOfPeriod: Date, label: string;

            if (timeframe === 'daily') {
                startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);
                label = startOfPeriod.toLocaleString('default', { weekday: 'short', day: 'numeric' });
            }
            else if (timeframe === 'weekly') {
                startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7) - 6);
                endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7), 23, 59, 59);
                label = `${startOfPeriod.getMonth() + 1}/${startOfPeriod.getDate()} - ${endOfPeriod.getMonth() + 1}/${endOfPeriod.getDate()}`;
            }
            else if (timeframe === 'quarterly') {
                const currentQ = Math.floor(now.getMonth() / 3);
                const targetQ = currentQ - i;
                const yearAdjust = Math.floor(targetQ / 4);
                const normalizedQ = ((targetQ % 4) + 4) % 4;
                const targetYear = now.getFullYear() + yearAdjust;
                startOfPeriod = new Date(targetYear, normalizedQ * 3, 1);
                endOfPeriod = new Date(targetYear, normalizedQ * 3 + 3, 0, 23, 59, 59);
                label = `Q${normalizedQ + 1} ${targetYear}`;
            }
            else if (timeframe === 'yearly') {
                startOfPeriod = new Date(now.getFullYear() - i, 0, 1);
                endOfPeriod = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
                label = `${now.getFullYear() - i}`;
            }
            else { // 'monthly'
                startOfPeriod = new Date(now.getFullYear(), now.getMonth() - i, 1);
                endOfPeriod = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
                label = startOfPeriod.toLocaleString('default', { month: 'short', year: '2-digit' });
            }

            // Capture the earliest date boundary for the selected timeframe
            if (i === periods - 1) {
                overallStartOfTrend = startOfPeriod;
            }

            trendLabels.push(label);

            // Fetch Revenue precisely for this interval
            const revLines = await prisma.journalLine.findMany({
                where: { account: { account_type: { name: 'Revenue' } }, entry: { date: { gte: startOfPeriod, lte: endOfPeriod } } }
            });
            const intervalRev = revLines.reduce((sum, ln) => sum + Number(ln.credit) - Number(ln.debit), 0);
            trendRevenue.push(Number(intervalRev.toFixed(2)));

            // Fetch Expenses precisely for this interval
            const expLines = await prisma.journalLine.findMany({
                where: { account: { account_type: { name: 'Expense' } }, entry: { date: { gte: startOfPeriod, lte: endOfPeriod } } }
            });
            const intervalExp = expLines.reduce((sum, ln) => sum + Number(ln.debit) - Number(ln.credit), 0);
            trendExpenses.push(Number(intervalExp.toFixed(2)));

            // Save the most recent period for KPIs
            if (i === 0) {
                currentPeriodRevenue = intervalRev;
                currentPeriodExpenses = intervalExp;
            }
        }

        // 2. GENERATE DYNAMIC EXPENSE BREAKDOWN (Now matched to the timeframe!)
        const expenseAccounts = await prisma.account.findMany({ where: { account_type: { name: 'Expense' } } });
        const expenseBreakdown: { name: string; value: number }[] = [];

        for (const acc of expenseAccounts) {
            const lines = await prisma.journalLine.findMany({
                where: {
                    account_id: acc.code,
                    entry: { date: { gte: overallStartOfTrend || new Date(0) } }
                }
            });
            const netBalance = lines.reduce((sum, ln) => sum + Number(ln.debit) - Number(ln.credit), 0);
            if (netBalance > 0) {
                expenseBreakdown.push({ name: acc.name, value: Number(netBalance.toFixed(2)) });
            }
        }

        // 3. CALCULATE LIQUIDITY (Total All-Time Cash)
        const cashLines = await prisma.journalLine.findMany({ where: { account_id: '1010' } });
        const netCash = cashLines.reduce((sum, ln) => sum + Number(ln.debit) - Number(ln.credit), 0);

        // Calculate Operating Margin KPI
        const margin = currentPeriodRevenue > 0
            ? ((currentPeriodRevenue - currentPeriodExpenses) / currentPeriodRevenue) * 100
            : 0;

        // 4. GENERATE NARRATIVE
        let narrative = `For the current ${timeframe} reporting period, the clinic has generated ₱${currentPeriodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} in revenue and incurred ₱${currentPeriodExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} in operating expenses. `;
        if (margin > 0) narrative += `This yields a healthy positive margin of ${margin.toFixed(1)}%. `;
        else if (margin < 0) narrative += `This results in a negative margin (loss) of ${Math.abs(margin).toFixed(1)}%. `;
        else narrative += `The clinic is currently breaking even. `;

        // 5. FETCH RECENT TRANSACTIONS
        const recentEntries = await prisma.journalEntry.findMany({
            orderBy: { date: 'desc' }, take: 5,
            include: { payee: true, lines: { include: { account: { include: { account_type: true } } } } }
        });

        const recentTransactions = recentEntries.map(entry => {
            const primaryLine = entry.lines.find(l => l.account.account_type.name === 'Revenue' || l.account.account_type.name === 'Expense') || entry.lines[0];
            const amount = Math.max(...entry.lines.map(l => Number(l.debit)));
            return {
                id: entry.id, date: entry.date,
                category: primaryLine ? primaryLine.account.name : 'General Transfer',
                payee: entry.payee?.name || 'Walk-in / General',
                amount: Number(amount.toFixed(2))
            };
        });

        return {
            kpi: { revenue: currentPeriodRevenue, expenses: currentPeriodExpenses, netCash, margin },
            expenseBreakdown,
            trendData: { labels: trendLabels, revenue: trendRevenue, expenses: trendExpenses },
            narrative,
            recentTransactions
        };
    }
}