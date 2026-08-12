// src/main/services/reports.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportsService {
    
    static async getTrialBalance(startDateStr?: string, endDateStr?: string) {
        const accounts = await prisma.account.findMany({
            include: { account_type: true },
        });

        const startDate = startDateStr ? new Date(startDateStr) : new Date(0);
        if (startDateStr) startDate.setHours(0, 0, 0, 0);

        const endDate = endDateStr ? new Date(endDateStr) : new Date();
        if (endDateStr) endDate.setHours(23, 59, 59, 999);

        const lines = await prisma.journalLine.findMany({
            where: { entry: { date: { lte: endDate } } },
            include: { entry: true }
        });

        let priorRevenue = 0;
        let priorExpense = 0;

        const tbMap: any = {};
        for (const acc of accounts) {
            tbMap[acc.code] = { ...acc, sumDebits: 0, sumCredits: 0 };
        }

        for (const line of lines) {
            const acc = tbMap[line.account_id];
            if (!acc) continue;
            
            const txDate = new Date(line.entry.date);
            const isPrior = txDate < startDate;
            const isRevenue = acc.account_type.name === 'Revenue';
            const isExpense = acc.account_type.name === 'Expense';
            
            const debit = Number(line.debit);
            const credit = Number(line.credit);

            if (isPrior) {
                if (isRevenue) priorRevenue += (credit - debit);
                if (isExpense) priorExpense += (debit - credit);
                if (!isRevenue && !isExpense) {
                    acc.sumDebits += debit;
                    acc.sumCredits += credit;
                }
            } else {
                acc.sumDebits += debit;
                acc.sumCredits += credit;
            }
        }

        const priorNetIncome = priorRevenue - priorExpense;
        if (priorNetIncome !== 0) {
            const equityAccCode = accounts.find(a => a.account_type.name === 'Equity')?.code;
            if (equityAccCode && tbMap[equityAccCode]) {
                if (priorNetIncome > 0) tbMap[equityAccCode].sumCredits += priorNetIncome;
                else tbMap[equityAccCode].sumDebits += Math.abs(priorNetIncome);
            }
        }

        const trialBalanceLines: any[] = [];
        let totalDebits = 0;
        let totalCredits = 0;

        for (const code in tbMap) {
            const acc = tbMap[code];
            const normalBalance = acc.account_type.normal_balance;
            let netDebit = 0;
            let netCredit = 0;

            if (normalBalance === 'DEBIT') {
                const net = acc.sumDebits - acc.sumCredits;
                if (net > 0) netDebit = net;
                else if (net < 0) netCredit = Math.abs(net);
            } else {
                const net = acc.sumCredits - acc.sumDebits;
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
        
        trialBalanceLines.sort((a,b) => a.accountCode.localeCompare(b.accountCode));

        return {
            lines: trialBalanceLines,
            totalDebits: Number(totalDebits.toFixed(2)),
            totalCredits: Number(totalCredits.toFixed(2)),
            isBalanced: totalDebits.toFixed(2) === totalCredits.toFixed(2),
        };
    }

    static async getIncomeStatement(startDateStr?: string, endDateStr?: string) {
        const trialBalance = await this.getTrialBalance(startDateStr, endDateStr);
        const revenueLines: any[] = [];
        const expenseLines: any[] = [];
        let totalRevenue = 0;
        let totalExpenses = 0;

        for (const line of trialBalance.lines) {
            if (line.accountType === 'Revenue') {
                const amount = line.credit - line.debit;
                revenueLines.push({ name: line.accountName, amount });
                totalRevenue += amount;
            } else if (line.accountType === 'Expense') {
                const amount = line.debit - line.credit;
                expenseLines.push({ name: line.accountName, amount });
                totalExpenses += amount;
            }
        }

        return {
            revenue: revenueLines,
            expenses: expenseLines,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            netIncome: Number((totalRevenue - totalExpenses).toFixed(2)),
        };
    }

    static async getBalanceSheet(startDateStr?: string, endDateStr?: string) {
        const trialBalance = await this.getTrialBalance(startDateStr, endDateStr);
        const incomeStatement = await this.getIncomeStatement(startDateStr, endDateStr);

        const assetLines: any[] = [];
        const liabilityLines: any[] = [];
        const equityLines: any[] = [];
        let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;

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
            }
        }

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

    static async getShiftReport(userId: string) {
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        const entries = await prisma.journalEntry.findMany({
            where: { user_id: userId, created_at: { gte: startOfDay, lte: endOfDay }, description: { startsWith: 'POS Billing' } },
            include: { lines: true }
        });

        let totalCash = 0, totalGCash = 0, totalHMO = 0, totalSales = 0;
        entries.forEach(entry => {
            entry.lines.forEach(line => {
                const debit = Number(line.debit);
                if (debit > 0) {
                    if (line.account_id === '1020') totalCash += debit;
                    else if (line.account_id === '1010') totalGCash += debit;
                    else if (line.account_id === '1200') totalHMO += debit;
                    totalSales += debit;
                }
            });
        });
        return { transactionsCount: entries.length, totalCash, totalGCash, totalHMO, totalSales };
    }

    // ==========================================
    // ---> 5 BOOKS OF ACCOUNTS LOGIC <---
    // ==========================================
    static async getBooksOfAccounts(bookType: string, startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        let whereClause: any = { date: { gte: startDate, lte: endDate } };

        // Route transactions based on their assigned Reference No. prefixes
        if (bookType === 'SJ') whereClause.reference_no = { startsWith: 'INV-' };      // Sales Journal
        else if (bookType === 'CRJ') whereClause.reference_no = { startsWith: 'OR-' }; // Cash Receipts
        else if (bookType === 'CDJ') whereClause.reference_no = { startsWith: 'CV-' }; // Cash Disbursements
        else if (bookType === 'PJ') whereClause.reference_no = { startsWith: 'PJ-' };  // Purchase Journal
        else if (bookType === 'GJ') {                                                  // General Journal
            whereClause.OR = [
                { reference_no: { startsWith: 'JV-' } },
                { reference_no: { startsWith: 'ADJ-' } },
                { reference_no: { startsWith: 'OPENING-' } }
            ];
        }

        const entries = await prisma.journalEntry.findMany({
            where: whereClause,
            include: { 
                lines: { include: { account: true } }, 
                payee: true 
            },
            orderBy: { date: 'asc' }
        });

        // Flatten data for the tabular journal view
        const formattedData: any[] = [];
        for (const entry of entries) {
            for (const line of entry.lines) {
                formattedData.push({
                    date: entry.date,
                    referenceNo: entry.reference_no,
                    description: entry.description,
                    payeeName: entry.payee?.name || '',
                    accountCode: line.account_id,
                    accountName: line.account.name,
                    debit: Number(line.debit),
                    credit: Number(line.credit)
                });
            }
        }
        return formattedData;
    }
}