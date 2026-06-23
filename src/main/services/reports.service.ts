// src/main/services/reports.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportsService {
    /**
     * Generates a Trial Balance: Lists all accounts with their net Debit or Credit balance.
     */
    static async getTrialBalance() {
        const accounts = await prisma.account.findMany({
            include: { account_type: true },
        });

        const trialBalanceLines = [];
        let totalDebits = 0;
        let totalCredits = 0;

        for (const acc of accounts) {
            const lines = await prisma.journalLine.findMany({
                where: { account_id: acc.code },
            });

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
     * Generates an Income Statement (Profit & Loss): Revenue - Expenses
     */
    static async getIncomeStatement() {
        const trialBalance = await this.getTrialBalance();

        const revenueLines: any[] = [];
        const expenseLines: any[] = [];
        let totalRevenue = 0;
        let totalExpenses = 0;

        for (const line of trialBalance.lines) {
            if (line.accountType === 'Revenue') {
                // Revenue has a credit balance
                const amount = line.credit - line.debit;
                revenueLines.push({ name: line.accountName, amount });
                totalRevenue += amount;
            } else if (line.accountType === 'Expense') {
                // Expenses have a debit balance
                const amount = line.debit - line.credit;
                expenseLines.push({ name: line.accountName, amount });
                totalExpenses += amount;
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
     * Generates a Balance Sheet: Assets, Liabilities, and Equity
     */
    static async getBalanceSheet() {
        const trialBalance = await this.getTrialBalance();
        const incomeStatement = await this.getIncomeStatement();

        const assetLines: any[] = [];
        const liabilityLines: any[] = [];
        const equityLines: any[] = [];

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        for (const line of trialBalance.lines) {
            if (line.accountType === 'Asset') {
                // Assets are normally debits. If an asset has a credit balance (like overdrawn cash), it is negative.
                const amount = line.debit - line.credit;
                assetLines.push({ name: line.accountName, amount });
                totalAssets += amount;
            } else if (line.accountType === 'Liability') {
                // Liabilities are normally credits.
                const amount = line.credit - line.debit;
                liabilityLines.push({ name: line.accountName, amount });
                totalLiabilities += amount;
            } else if (line.accountType === 'Equity') {
                // Equity is normally credits.
                const amount = line.credit - line.debit;
                equityLines.push({ name: line.accountName, amount });
                totalEquity += amount;
            }
        }

        // Retained Earnings (Equity) is increased by Net Income
        const netIncome = incomeStatement.netIncome;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netIncome;

        return {
            assets: assetLines,
            liabilities: liabilityLines,
            equity: equityLines,
            totalAssets: Number(totalAssets.toFixed(2)),
            totalLiabilities: Number(totalLiabilities.toFixed(2)),
            totalEquity: Number(totalEquity.toFixed(2)),
            netIncome: Number(netIncome.toFixed(2)),
            totalLiabilitiesAndEquity: Number(totalLiabilitiesAndEquity.toFixed(2)),
            isEquationBalanced: totalAssets.toFixed(2) === totalLiabilitiesAndEquity.toFixed(2),
        };
    }
}