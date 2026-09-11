// src/main/services/reports.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportsService {
    static async getTrialBalance(startDate?: Date, endDate?: Date) {
        const accounts = await prisma.account.findMany({
            include: { account_type: true },
        });

        // Use the passed endDate, or default to right now if not provided
        const effectiveEndDate = endDate || new Date();

        const lines = await prisma.journalLine.findMany({
            where: { entry: { date: { lte: effectiveEndDate } } },
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
            // Safely check if txDate is before startDate (if a startDate was provided)
            const isPrior = startDate ? (txDate < startDate) : false;
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

        trialBalanceLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

        return {
            lines: trialBalanceLines,
            totalDebits: Number(totalDebits.toFixed(2)),
            totalCredits: Number(totalCredits.toFixed(2)),
            isBalanced: totalDebits.toFixed(2) === totalCredits.toFixed(2),
        };
    }

    static async getIncomeStatement(year?: number, month?: number) {
        let startDate, endDate;
        if (year && month) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
        }

        const trialBalance = await this.getTrialBalance(startDate, endDate);
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

    static async getBalanceSheet(year?: number, month?: number) {
        let endDate;
        if (year && month) {
            endDate = new Date(year, month, 0, 23, 59, 59);
        }

        const trialBalance = await this.getTrialBalance(undefined, endDate);
        const incomeStatement = await this.getIncomeStatement(year, month);

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

        const netIncome = incomeStatement.netIncome;
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

    static async getShiftReport(userId: string) {
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

        const entries = await prisma.journalEntry.findMany({
            where: {
                user_id: userId,
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

        if (bookType === 'SJ') {
            whereClause.OR = [
                { reference_no: { startsWith: 'INV-' } },
                { reference_no: { startsWith: 'SYS-' } }
            ];
        }
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

    static async getAgedReceivables() {
        const lines = await prisma.journalLine.findMany({
            where: {
                account_id: '1200',
                entry: {
                    payee_id: { not: null },
                    status: { not: 'VOIDED' }
                }
            },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } }
        });

        const payeeMap: Record<string, {
            name: string,
            invoices: any[],
            payments: any[]
        }> = {};

        for (const line of lines) {
            const payeeId = line.entry.payee_id!.toString();
            if (!payeeMap[payeeId]) {
                payeeMap[payeeId] = {
                    name: line.entry.payee!.name,
                    invoices: [],
                    payments: []
                };
            }
            if (Number(line.debit) > 0) {
                payeeMap[payeeId].invoices.push({
                    invoiceNo: line.entry.reference_no || 'N/A',
                    description: line.entry.description || '',
                    date: line.entry.date,
                    originalAmount: Number(line.debit),
                    amount: Number(line.debit),
                    paidAmount: 0,
                    dueDate: new Date(new Date(line.entry.date).getTime() + (30 * 24 * 60 * 60 * 1000))
                });
            }
            if (Number(line.credit) > 0) {
                payeeMap[payeeId].payments.push({
                    referenceNo: line.entry.reference_no || '',
                    description: line.entry.description || '',
                    amount: Number(line.credit),
                    remainingAmount: Number(line.credit)
                });
            }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const report: any[] = [];

        for (const payeeId in payeeMap) {
            const p = payeeMap[payeeId];

            // PASS 1: Exact Explicit Match
            for (const pmt of p.payments) {
                if (pmt.remainingAmount <= 0) continue;
                for (const inv of p.invoices) {
                    if (inv.amount <= 0) continue;
                    const desc = (pmt.description || '').toUpperCase();
                    const ref = (pmt.referenceNo || '').toUpperCase();
                    const invNo = inv.invoiceNo.toUpperCase();

                    if (desc.includes(invNo) || ref.includes(invNo)) {
                        const deduction = Math.min(pmt.remainingAmount, inv.amount);
                        inv.amount -= deduction;
                        inv.paidAmount += deduction;
                        pmt.remainingAmount -= deduction;
                    }
                }
            }

            // PASS 2: Exact Amount
            for (const pmt of p.payments) {
                if (pmt.remainingAmount <= 0) continue;
                for (const inv of p.invoices) {
                    if (inv.amount <= 0) continue;
                    if (Math.abs(inv.amount - pmt.remainingAmount) < 0.01) {
                        inv.paidAmount += pmt.remainingAmount;
                        inv.amount = 0;
                        pmt.remainingAmount = 0;
                        break;
                    }
                }
            }

            // PASS 3: FIFO
            for (const pmt of p.payments) {
                if (pmt.remainingAmount <= 0) continue;
                for (const inv of p.invoices) {
                    if (inv.amount <= 0) continue;
                    const deduction = Math.min(pmt.remainingAmount, inv.amount);
                    inv.amount -= deduction;
                    inv.paidAmount += deduction;
                    pmt.remainingAmount -= deduction;
                    if (pmt.remainingAmount <= 0) break;
                }
            }

            let current = 0; let days30 = 0; let days60 = 0; let days90 = 0;
            const invoiceDetails: any[] = [];

            for (const inv of p.invoices) {
                const unpaidAmount = Number(inv.amount.toFixed(2));
                let status = 'Unpaid';
                if (unpaidAmount <= 0) {
                    status = 'Paid';
                } else if (inv.paidAmount > 0) {
                    status = 'Partially Paid';
                }

                if (unpaidAmount > 0) {
                    const invDate = new Date(inv.date);
                    invDate.setHours(0, 0, 0, 0);
                    const diffTime = today.getTime() - invDate.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 30) current += unpaidAmount;
                    else if (diffDays <= 60) days30 += unpaidAmount;
                    else if (diffDays <= 90) days60 += unpaidAmount;
                    else days90 += unpaidAmount;
                }

                invoiceDetails.push({
                    invoiceNo: inv.invoiceNo,
                    date: inv.date,
                    dueDate: inv.dueDate,
                    amount: unpaidAmount,
                    originalAmount: inv.originalAmount,
                    status: status
                });
            }

            const total = Number((current + days30 + days60 + days90).toFixed(2));
            if (total > 0 || invoiceDetails.length > 0) {
                report.push({
                    payeeName: p.name,
                    current: Number(current.toFixed(2)),
                    days30: Number(days30.toFixed(2)),
                    days60: Number(days60.toFixed(2)),
                    days90: Number(days90.toFixed(2)),
                    total,
                    invoices: invoiceDetails
                });
            }
        }

        return report.sort((a, b) => b.total - a.total);
    }

    static async getInvoiceTracker() {
        // 1. Fetch BOTH manual INV- invoices AND automated SYS- POS transactions (Exclude voided)
        const invoices = await prisma.journalEntry.findMany({
            where: {
                OR: [
                    { reference_no: { startsWith: 'INV-' } },
                    { reference_no: { startsWith: 'SYS-' } }
                ],
                status: { not: 'VOIDED' }
            },
            include: { lines: true, payee: true },
            orderBy: { date: 'asc' }
        });

        // 2. Fetch ALL Payments/Collections (Credits to Account 1200)
        // Fixed: We no longer restrict by `payee_id: { not: null }` so we can catch unassigned payments!
        const arCreditLines = await prisma.journalLine.findMany({
            where: {
                account_id: '1200',
                credit: { gt: 0 },
                entry: {
                    status: { not: 'VOIDED' }
                }
            },
            include: { entry: true },
            orderBy: { entry: { date: 'asc' } }
        });

        // Format Payments
        const allPayments = arCreditLines.map(line => ({
            id: line.id,
            payeeId: line.entry.payee_id?.toString() || 'NO_PAYEE',
            amount: Number(line.credit),
            remaining: Number(line.credit),
            description: (line.entry.description || '').toUpperCase(),
            referenceNo: (line.entry.reference_no || '').toUpperCase()
        }));

        // 3. Prepare robust invoice models
        const invoiceObjects = invoices.map(inv => {
            // Find specific Receivables debits
            const arAmount = inv.lines
                .filter(l => l.account_id === '1200' && Number(l.debit) > 0)
                .reduce((sum, l) => sum + Number(l.debit), 0);

            const isAR = arAmount > 0;

            // Explicitly track actual Cash (1020) and GCash (1010) debited upon creation
            const cashAmount = inv.lines
                .filter(l => ['1010', '1020'].includes(l.account_id) && Number(l.debit) > 0)
                .reduce((sum, l) => sum + Number(l.debit), 0);

            // Total properly equals expected collection (Cash upfront + AR pending)
            const totalAmount = arAmount + cashAmount;

            return {
                id: inv.id,
                date: inv.date,
                referenceNo: inv.reference_no || '',
                description: inv.description,
                payeeId: inv.payee_id?.toString() || 'NO_PAYEE',
                payeeName: inv.payee?.name || 'Walk-in / Cash',
                payeeType: inv.payee?.type || 'PATIENT',
                total: totalAmount,
                isAR,
                arAmount,
                cashAmount,
                allocatedPayments: 0
            };
        });

        // 4. Smart match Engine

        // 🎯 PASS 1: GLOBAL Explicit Reference Match (Catches missing Payees from user errors)
        for (const pmt of allPayments) {
            if (pmt.remaining <= 0) continue;
            for (const inv of invoiceObjects) {
                if (!inv.isAR) continue;
                const remainingBalance = inv.arAmount - inv.allocatedPayments;
                if (remainingBalance <= 0) continue;

                const invRef = inv.referenceNo.toUpperCase();
                if (!invRef) continue; // Skip if no reference exists

                if (pmt.description.includes(invRef) || pmt.referenceNo.includes(invRef)) {
                    const deduction = Math.min(pmt.remaining, remainingBalance);
                    inv.allocatedPayments += deduction;
                    pmt.remaining -= deduction;
                }
            }
        }

        // 🎯 PASS 2: Exact Amount Match (Grouped strictly by exact Payee)
        for (const pmt of allPayments) {
            if (pmt.remaining <= 0 || pmt.payeeId === 'NO_PAYEE') continue;
            for (const inv of invoiceObjects) {
                if (!inv.isAR || inv.payeeId !== pmt.payeeId) continue;
                const remainingBalance = inv.arAmount - inv.allocatedPayments;
                if (remainingBalance <= 0) continue;

                if (Math.abs(remainingBalance - pmt.remaining) < 0.01) {
                    inv.allocatedPayments += pmt.remaining;
                    pmt.remaining = 0;
                    break;
                }
            }
        }

        // 🎯 PASS 3: FIFO / Chronological (Grouped strictly by exact Payee)
        for (const pmt of allPayments) {
            if (pmt.remaining <= 0 || pmt.payeeId === 'NO_PAYEE') continue;
            for (const inv of invoiceObjects) {
                if (!inv.isAR || inv.payeeId !== pmt.payeeId) continue;
                const remainingBalance = inv.arAmount - inv.allocatedPayments;
                if (remainingBalance <= 0) continue;

                const deduction = Math.min(pmt.remaining, remainingBalance);
                inv.allocatedPayments += deduction;
                pmt.remaining -= deduction;

                if (pmt.remaining <= 0) break;
            }
        }

        // 5. Build final status and balances
        const results = invoiceObjects.map(inv => {
            let paid = 0;
            let balance = 0;
            let status = 'Unpaid';

            if (!inv.isAR) {
                paid = inv.total;
                balance = 0;
                status = 'Fully Paid';
            } else {
                paid = inv.cashAmount + inv.allocatedPayments;
                balance = Math.max(0, inv.arAmount - inv.allocatedPayments);

                if (balance <= 0.009) {
                    balance = 0;
                    status = 'Fully Paid';
                } else if (inv.allocatedPayments > 0 || inv.cashAmount > 0) {
                    status = 'Partially Paid';
                } else {
                    status = 'Unpaid';
                }
            }

            return {
                id: inv.id,
                date: inv.date,
                referenceNo: inv.referenceNo,
                description: inv.description,
                payeeName: inv.payeeName,
                payeeType: inv.payeeType,
                total: inv.total,
                paid: Number(paid.toFixed(2)),
                balance: Number(balance.toFixed(2)),
                status
            };
        });

        return results.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

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