// src/main/services/analytics.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsService {
    static async getDashboardMetrics() {
        // 1. Get all accounts to filter by type
        const accounts = await prisma.account.findMany({
            include: { account_type: true },
        });

        let totalRevenue = 0;
        let totalExpenses = 0;
        let netCash = 0;
        const expenseBreakdown: { name: string; value: number }[] = [];

        // Running monthly buckets keyed by "YYYY-M" for the trend chart
        const monthlyRevenue: Record<string, number> = {};
        const monthlyExpenses: Record<string, number> = {};
        let latestEntryDate: Date | null = null;

        // 2. Fetch all journal lines, each with its parent entry's date so we
        //    can bucket real transactions into their real posting month.
        for (const acc of accounts) {
            const lines = await prisma.journalLine.findMany({
                where: { account_id: acc.code },
                include: { entry: { select: { date: true } } },
            });

            const sumDebits = lines.reduce((sum, ln) => sum + Number(ln.debit), 0);
            const sumCredits = lines.reduce((sum, ln) => sum + Number(ln.credit), 0);

            // Revenue Calculation
            if (acc.account_type.name === 'Revenue') {
                const net = sumCredits - sumDebits;
                if (net > 0) totalRevenue += net;

                for (const ln of lines) {
                    const d = ln.entry.date;
                    if (!latestEntryDate || d > latestEntryDate) latestEntryDate = d;
                    const key = `${d.getFullYear()}-${d.getMonth()}`;
                    const lineNet = Number(ln.credit) - Number(ln.debit);
                    monthlyRevenue[key] = (monthlyRevenue[key] || 0) + lineNet;
                }
            }

            // Expense Calculation & Breakdown for Donut Chart
            if (acc.account_type.name === 'Expense') {
                const net = sumDebits - sumCredits;
                if (net > 0) {
                    totalExpenses += net;
                    expenseBreakdown.push({ name: acc.name, value: net });
                }

                for (const ln of lines) {
                    const d = ln.entry.date;
                    if (!latestEntryDate || d > latestEntryDate) latestEntryDate = d;
                    const key = `${d.getFullYear()}-${d.getMonth()}`;
                    const lineNet = Number(ln.debit) - Number(ln.credit);
                    monthlyExpenses[key] = (monthlyExpenses[key] || 0) + lineNet;
                }
            }

            // Cash Calculation (1010)
            if (acc.code === '1010') {
                netCash = sumDebits - sumCredits;
            }
        }

        // 3. Real 6-Month Trend Data for the Bar Chart.
        //    Ends at the month of the most recent transaction (so seeded demo
        //    data from an earlier period is still visible), falling back to
        //    the current calendar month if there's no data at all.
        const windowEnd = latestEntryDate ? new Date(latestEntryDate) : new Date();
        const labels: string[] = [];
        const revenueSeries: number[] = [];
        const expensesSeries: number[] = [];

        for (let i = 5; i >= 0; i--) {
            const bucket = new Date(windowEnd.getFullYear(), windowEnd.getMonth() - i, 1);
            const key = `${bucket.getFullYear()}-${bucket.getMonth()}`;
            labels.push(bucket.toLocaleString('default', { month: 'short', year: 'numeric' }));
            revenueSeries.push(Number((monthlyRevenue[key] || 0).toFixed(2)));
            expensesSeries.push(Number((monthlyExpenses[key] || 0).toFixed(2)));
        }

        const trendData = {
            labels,
            revenue: revenueSeries,
            expenses: expensesSeries,
        };

        return {
            kpi: {
                revenue: Number(totalRevenue.toFixed(2)),
                expenses: Number(totalExpenses.toFixed(2)),
                netCash: Number(netCash.toFixed(2)),
                margin: totalRevenue > 0 ? Number(((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1)) : 0
            },
            expenseBreakdown,
            trendData
        };
    }
}