// src/main/services/analytics.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const AnalyticsService = {
  async getDashboardMetrics() {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        // 1. Fetch Month-to-Date (MTD) Lines for Revenue & Expenses
        const mtdLines = await prisma.journalLine.findMany({
            where: { entry: { date: { gte: startOfMonth, lte: endOfMonth }, status: 'ACTIVE' } },
            include: { account: { include: { account_type: true } } }
        });

        let revenue = 0;
        let expenses = 0;
        const expenseBreakdownMap: Record<string, number> = {};

        mtdLines.forEach(line => {
            const type = line.account.account_type.name;
            const debit = Number(line.debit);
            const credit = Number(line.credit);

            if (type === 'Revenue') {
                revenue += (credit - debit);
            } else if (type === 'Expense') {
                const expAmount = (debit - credit);
                expenses += expAmount;
                // Accumulate for the Donut Chart! (This catches 5100 Salaries!)
                if (expAmount > 0) {
                    expenseBreakdownMap[line.account.name] = (expenseBreakdownMap[line.account.name] || 0) + expAmount;
                }
            }
        });

        // Calculate Operating Margin: (Revenue - Expenses) / Revenue * 100
        let margin = 0;
        if (revenue > 0) {
            margin = ((revenue - expenses) / revenue) * 100;
        }

        // 2. Fetch Live Total Cash (Bank + Petty Cash)
        const cashLines = await prisma.journalLine.findMany({
            where: { account_id: { in: ['1010', '1020'] }, entry: { status: 'ACTIVE' } }
        });
        
        let netCash = 0;
        cashLines.forEach(line => {
            netCash += (Number(line.debit) - Number(line.credit));
        });

        // 3. Format Expense Breakdown for ECharts Pie/Donut Chart
        const expenseBreakdown = Object.entries(expenseBreakdownMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Sort biggest expenses first

        // 4. Generate 6-Month Trend Data for Bar Chart
        const labels: string[] = [];
        const trendRevenue: number[] = [];
        const trendExpenses: number[] = [];

        // Loop backward 5 months + current month
        for (let i = 5; i >= 0; i--) {
            const mStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const mEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59);
            const monthName = mStart.toLocaleString('default', { month: 'short' }); // e.g. "Aug"
            
            const mLines = await prisma.journalLine.findMany({
                where: { entry: { date: { gte: mStart, lte: mEnd }, status: 'ACTIVE' } },
                include: { account: { include: { account_type: true } } }
            });

            let mRev = 0; let mExp = 0;
            mLines.forEach(l => {
                if (l.account.account_type.name === 'Revenue') mRev += (Number(l.credit) - Number(l.debit));
                if (l.account.account_type.name === 'Expense') mExp += (Number(l.debit) - Number(l.credit));
            });
            
            labels.push(monthName);
            trendRevenue.push(mRev);
            trendExpenses.push(mExp);
        }

        // Return the exact structure DashboardView.tsx is expecting!
        return {
            kpi: {
                revenue,
                expenses,
                netCash,
                margin: Number(margin.toFixed(1)) // 1 decimal place (e.g., 65.5)
            },
            trendData: {
                labels,
                revenue: trendRevenue,
                expenses: trendExpenses
            },
            expenseBreakdown
        };

    } catch (error) {
        console.error("Analytics Error:", error);
        return { error: "Failed to compute analytics." };
    }
  }
};