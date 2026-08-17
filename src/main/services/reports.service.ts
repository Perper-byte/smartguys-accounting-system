// src/main/services/reports.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportsService {
    /**
     * Generates a Trial Balance. 
     * If startDate/endDate are provided, it filters transactions within that range.
     */
    static async getTrialBalance(startDate?: Date, endDate?: Date) {
        const accounts = await prisma.account.findMany({
            include: { account_type: true },
        });

        const trialBalanceLines = [];
        let totalDebits = 0;
        let totalCredits = 0;

        for (const acc of accounts) {
            const whereClause: any = { account_id: acc.code };

            // Apply date filters if requested
            if (startDate || endDate) {
                whereClause.entry = { date: {} };
                if (startDate) whereClause.entry.date.gte = startDate;
                if (endDate) whereClause.entry.date.lte = endDate;
            }

            const lines = await prisma.journalLine.findMany({ where: whereClause });

            const sumDebits = lines.reduce((sum, ln) => sum + Number(ln.debit), 0);
            const sumCredits = lines.reduce((sum, ln) => sum + Number(ln.credit), 0);

            const normalBalance = acc.account_type.normal_balance;
            let netDebit = 0;
            let netCredit = 0;

            if (normalBalance === 'DEBIT') {
                const net = sumDebits - sumCredits;
                if (net > 0) netDebit = net;
                else if (net < 0) netCredit = Math.abs(net);
            } else {
                const net = sumCredits - sumDebits;
                if (net > 0) netCredit = net;
                else if (net < 0) netDebit = Math.abs(net);
            }

            if (netDebit > 0 || netCredit > 0) {
                trialBalanceLines.push({
                    accountCode: acc.code,
                    accountName: acc.name,
                    accountType: acc.account_type.name,
                    debit: netDebit,
                    credit: netCredit,
                });

                totalDebits += netDebit;
                totalCredits += netCredit;
            }
        }

        return {
            lines: trialBalanceLines,
            totalDebits: Number(totalDebits.toFixed(2)),
            totalCredits: Number(totalCredits.toFixed(2)),
            isBalanced: totalDebits.toFixed(2) === totalCredits.toFixed(2),
        };
    }

    /**
     * Income Statement: Revenue - Expenses (Strictly for the selected month)
     */
    static async getIncomeStatement(year?: number, month?: number) {
        let startDate, endDate;
        if (year && month) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
        }

        // Get balances ONLY for the selected month
        const trialBalance = await this.getTrialBalance(startDate, endDate);

        const revenueLines: any[] = [];
        const expenseLines: any[] = [];
        let totalRevenue = 0;
        let totalExpenses = 0;

        for (const line of trialBalance.lines) {
            if (line.accountType === 'Revenue') {
                revenueLines.push({ name: line.accountName, amount: line.credit });
                totalRevenue += line.credit;
            } else if (line.accountType === 'Expense') {
                expenseLines.push({ name: line.accountName, amount: line.debit });
                totalExpenses += line.debit;
            }
        }

        const netIncome = totalRevenue - totalExpenses;

        return {
            revenue: revenueLines,
            expenses: expenseLines,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            netIncome: Number(netIncome.toFixed(2)),
        };
    }

    /**
     * Balance Sheet: Assets, Liabilities, and Equity (Cumulative up to the end of the month)
     */
    static async getBalanceSheet(year?: number, month?: number) {
        let endDate;
        if (year && month) endDate = new Date(year, month, 0, 23, 59, 59);

        // Balance Sheet relies on ALL historical data up to the selected date
        const trialBalance = await this.getTrialBalance(undefined, endDate);

        const assetLines: any[] = [];
        const liabilityLines: any[] = [];
        const equityLines: any[] = [];
        let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;
        let cumulativeRevenue = 0, cumulativeExpenses = 0;

        for (const line of trialBalance.lines) {
            if (line.accountType === 'Asset') {
                const amount = line.debit - line.credit;
                assetLines.push({ name: line.accountName, amount });
                totalAssets += amount;
            } else if (line.accountType === 'Liability') {
                const amount = line.credit - line.debit;
                liabilityLines.push({ name: line.accountName, amount });
                totalLiabilities += amount;
            } else if (line.accountType === 'Equity') {
                const amount = line.credit - line.debit;
                equityLines.push({ name: line.accountName, amount });
                totalEquity += amount;
            } else if (line.accountType === 'Revenue') {
                cumulativeRevenue += line.credit;
            } else if (line.accountType === 'Expense') {
                cumulativeExpenses += line.debit;
            }
        }

        const cumulativeNetIncome = cumulativeRevenue - cumulativeExpenses;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + cumulativeNetIncome;

        return {
            assets: assetLines,
            liabilities: liabilityLines,
            equity: equityLines,
            totalAssets: Number(totalAssets.toFixed(2)),
            totalLiabilities: Number(totalLiabilities.toFixed(2)),
            totalEquity: Number(totalEquity.toFixed(2)),
            netIncome: Number(cumulativeNetIncome.toFixed(2)),
            totalLiabilitiesAndEquity: Number(totalLiabilitiesAndEquity.toFixed(2)),
            isEquationBalanced: totalAssets.toFixed(2) === totalLiabilitiesAndEquity.toFixed(2),
        };
    }

    /**
     * Cash Flow Statement (Strictly for the selected month)
     */
    static async getCashFlowStatement(year?: number, month?: number) {
        let startDate, endDate;
        if (year && month) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
        }

        const whereClause: any = { lines: { some: { account_id: '1010' } } };
        if (startDate || endDate) {
            whereClause.date = {};
            if (startDate) whereClause.date.gte = startDate;
            if (endDate) whereClause.date.lte = endDate;
        }

        const cashEntries = await prisma.journalEntry.findMany({
            where: whereClause,
            include: { lines: { include: { account: { include: { account_type: true } } } } },
            orderBy: { date: 'asc' }
        });

        let operatingNet = 0, investingNet = 0, financingNet = 0;
        const operatingDetails: any[] = [], investingDetails: any[] = [], financingDetails: any[] = [];

        for (const entry of cashEntries) {
            const cashLine = entry.lines.find(l => l.account_id === '1010');
            if (!cashLine) continue;

            const netCashChange = Number(cashLine.debit) - Number(cashLine.credit);
            if (netCashChange === 0) continue;

            const offsetLine = entry.lines.find(l => l.account_id !== '1010' && (Number(l.debit) > 0 || Number(l.credit) > 0)) || entry.lines[0];
            const offsetAccount = offsetLine.account;

            const detail = { id: entry.id, date: entry.date, description: entry.description, amount: netCashChange };

            if (offsetAccount.code === '1500' || offsetAccount.name.includes('Equipment')) {
                investingDetails.push(detail);
                investingNet += netCashChange;
            } else if (offsetAccount.account_type.name === 'Equity' || offsetAccount.name.includes('Capital')) {
                financingDetails.push(detail);
                financingNet += netCashChange;
            } else {
                operatingDetails.push(detail);
                operatingNet += netCashChange;
            }
        }

        const netIncreaseInCash = operatingNet + investingNet + financingNet;

        return {
            operating: { details: operatingDetails, net: Number(operatingNet.toFixed(2)) },
            investing: { details: investingDetails, net: Number(investingNet.toFixed(2)) },
            financing: { details: financingDetails, net: Number(financingNet.toFixed(2)) },
            netIncreaseInCash: Number(netIncreaseInCash.toFixed(2)),
        };
    }
}