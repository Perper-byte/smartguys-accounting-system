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

        // 2. Fetch all journal lines
        for (const acc of accounts) {
            const lines = await prisma.journalLine.findMany({
                where: { account_id: acc.code },
            });

            const sumDebits = lines.reduce((sum, ln) => sum + Number(ln.debit), 0);
            const sumCredits = lines.reduce((sum, ln) => sum + Number(ln.credit), 0);

            // Revenue Calculation
            if (acc.account_type.name === 'Revenue') {
                const net = sumCredits - sumDebits;
                if (net > 0) totalRevenue += net;
            }

            // Expense Calculation & Breakdown for Donut Chart
            if (acc.account_type.name === 'Expense') {
                const net = sumDebits - sumCredits;
                if (net > 0) {
                    totalExpenses += net;
                    expenseBreakdown.push({ name: acc.name, value: net });
                }
            }

            // Cash Calculation (1010)
            if (acc.code === '1010') {
                netCash = sumDebits - sumCredits;
            }
        }

        // 3. Mock 6-Month Trend Data for Bar Chart (Using current totals for the current month)
        const currentMonth = new Date().toLocaleString('default', { month: 'short' });
        const trendData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', currentMonth],
            revenue: [0, 0, 0, 0, 0, totalRevenue],
            expenses: [0, 0, 0, 0, 0, totalExpenses],
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