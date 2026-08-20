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
            where: { 
                user_id: userId, 
                // ---> FIX: Changed 'created_at' to 'date' here! <---
                date: { gte: startOfDay, lte: endOfDay }, 
                description: { startsWith: 'POS Billing' } 
            },
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

    static async getBooksOfAccounts(bookType: string, startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        let whereClause: any = { date: { gte: startDate, lte: endDate } };

        if (bookType === 'SJ') whereClause.reference_no = { startsWith: 'INV-' };      
        else if (bookType === 'CRJ') whereClause.reference_no = { startsWith: 'OR-' }; 
        else if (bookType === 'CDJ') whereClause.reference_no = { startsWith: 'CV-' }; 
        else if (bookType === 'PJ') whereClause.reference_no = { startsWith: 'PJ-' };  
        else if (bookType === 'GJ') {                                                  
            whereClause.OR = [
                { reference_no: { startsWith: 'JV-' } },
                { reference_no: { startsWith: 'ADJ-' } },
                { reference_no: { startsWith: 'OPENING-' } }
            ];
        }

        const entries = await prisma.journalEntry.findMany({
            where: whereClause,
            include: { lines: { include: { account: true } }, payee: true },
            orderBy: { date: 'asc' }
        });

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

    // ==========================================
    // ---> NEW: AGED RECEIVABLES (HMO TRACKER) <---
    // ==========================================
    static async getAgedReceivables() {
        const lines = await prisma.journalLine.findMany({
            where: { account_id: '1200', entry: { payee_id: { not: null } } },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } } // Sort oldest to newest for FIFO
        });

        const payeeMap: Record<string, { name: string, invoices: any[], totalPayments: number }> = {};

        for (const line of lines) {
            const payeeId = line.entry.payee_id!.toString();
            if (!payeeMap[payeeId]) {
                payeeMap[payeeId] = { name: line.entry.payee!.name, invoices: [], totalPayments: 0 };
            }
            if (Number(line.debit) > 0) payeeMap[payeeId].invoices.push({ date: line.entry.date, amount: Number(line.debit) });
            if (Number(line.credit) > 0) payeeMap[payeeId].totalPayments += Number(line.credit);
        }

        const today = new Date();
        today.setHours(0,0,0,0);
        const report: any[] = [];

        for (const payeeId in payeeMap) {
            const p = payeeMap[payeeId];
            let remainingPayments = p.totalPayments;
            let current = 0; let days30 = 0; let days60 = 0; let days90 = 0;

            for (const inv of p.invoices) {
                if (remainingPayments >= inv.amount) {
                    remainingPayments -= inv.amount;
                    continue; 
                }
                
                const unpaidAmount = inv.amount - remainingPayments;
                remainingPayments = 0; 
                
                const invDate = new Date(inv.date);
                invDate.setHours(0,0,0,0);
                const diffTime = today.getTime() - invDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 30) current += unpaidAmount;
                else if (diffDays <= 60) days30 += unpaidAmount;
                else if (diffDays <= 90) days60 += unpaidAmount;
                else days90 += unpaidAmount;
            }

            const total = current + days30 + days60 + days90;
            if (total > 0) report.push({ payeeName: p.name, current, days30, days60, days90, total });
        }

        return report.sort((a, b) => b.total - a.total);
    }

    static async getInvoiceTracker() {
        // 1. Fetch ALL Invoices from oldest to newest
        const invoices = await prisma.journalEntry.findMany({
            where: { reference_no: { startsWith: 'INV-' }, status: { not: 'VOIDED' } },
            include: { lines: true, payee: true },
            orderBy: { date: 'asc' } 
        });

        // 2. Fetch ALL Payments/Collections (Credits to Account 1200)
        const arCreditLines = await prisma.journalLine.findMany({
            where: { account_id: '1200', credit: { gt: 0 }, entry: { payee_id: { not: null }, status: { not: 'VOIDED' } } },
            include: { entry: true }
        });

        // 3. Group the payments by Patient/Payee
        const payeeCredits: Record<string, number> = {};
        for (const line of arCreditLines) {
            const pId = line.entry.payee_id!.toString();
            payeeCredits[pId] = (payeeCredits[pId] || 0) + Number(line.credit);
        }

        const results: any[] = [];

        // 4. Apply payments to invoices sequentially (FIFO)
        for (const inv of invoices) {
            const totalAmount = inv.lines.reduce((sum, l) => sum + Number(l.debit), 0);
            const isAR = inv.lines.some(l => l.account_id === '1200'); 

            let paid = 0; let balance = 0; let status = 'Unpaid';

            if (!isAR) {
                // Paid in Cash/GCash instantly
                paid = totalAmount; balance = 0; status = 'Fully Paid';
            } else {
                // Charged to HMO/Credit
                const pId = inv.payee_id?.toString();
                if (pId && payeeCredits[pId] !== undefined) {
                    let availableCredit = payeeCredits[pId];
                    if (availableCredit >= totalAmount) {
                        paid = totalAmount; balance = 0; status = 'Fully Paid';
                        payeeCredits[pId] -= totalAmount; 
                    } else if (availableCredit > 0) {
                        paid = availableCredit; balance = totalAmount - availableCredit; status = 'Partially Paid';
                        payeeCredits[pId] = 0; 
                    } else {
                        paid = 0; balance = totalAmount; status = 'Unpaid';
                    }
                } else {
                    paid = 0; balance = totalAmount; status = 'Unpaid';
                }
            }

            results.push({
                id: inv.id,
                date: inv.date,
                referenceNo: inv.reference_no,
                payeeName: inv.payee?.name || 'Walk-in / Cash',
                total: totalAmount,
                paid: paid,
                balance: balance,
                status: status
            });
        }

        return results.sort((a,b) => b.date.getTime() - a.date.getTime());
    }
}