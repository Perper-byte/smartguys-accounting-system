// src/main/services/tax.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TaxService {
    
    // 1. VAT REPORT (Form 2550Q)
    static async generate2550Q(year: number, quarter: number) {
        try {
            const startMonth = (quarter - 1) * 3;
            const startDate = new Date(year, startMonth, 1);
            const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);

            const outputVatLines = await prisma.journalLine.findMany({
                where: { account_id: '2020', credit: { gt: 0 }, entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' } }
            });
            const outputVat = outputVatLines.reduce((sum, line) => sum + Number(line.credit), 0);

            let vatableSales = 0; let exemptSales = 0;
            const salesEntries = await prisma.journalEntry.findMany({
                where: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE', lines: { some: { account_id: { in: ['4010', '4020', '4040'] } } } },
                include: { lines: true }
            });

            salesEntries.forEach(entry => {
                const isVatable = entry.lines.some(l => l.account_id === '2020');
                const revenueLines = entry.lines.filter(l => ['4010', '4020', '4040'].includes(l.account_id));
                const revenueAmount = revenueLines.reduce((sum, l) => sum + Number(l.credit), 0);

                if (isVatable) vatableSales += revenueAmount;
                else exemptSales += revenueAmount;
            });

            const netSales = vatableSales + exemptSales;
            const grossSales = netSales + outputVat;

            const inputVatLines = await prisma.journalLine.findMany({
                where: { account_id: '1140', debit: { gt: 0 }, entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' } }
            });
            const inputVat = inputVatLines.reduce((sum, line) => sum + Number(line.debit), 0);

            const purchaseEntries = await prisma.journalEntry.findMany({
                where: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE', lines: { some: { account_id: '1140' } } },
                include: { lines: true }
            });

            let vatablePurchases = 0;
            purchaseEntries.forEach(entry => {
                const expenseLines = entry.lines.filter(l => l.account_id !== '1140' && l.account_id !== '1010' && l.account_id !== '2010' && Number(l.debit) > 0);
                vatablePurchases += expenseLines.reduce((sum, l) => sum + Number(l.debit), 0);
            });

            const netPurchases = vatablePurchases;
            const grossPurchases = netPurchases + inputVat;

            const cwtLines = await prisma.journalLine.findMany({
                where: { account_id: '1150', debit: { gt: 0 }, entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' } }
            });
            const creditableVatWithheld = cwtLines.reduce((sum, line) => sum + Number(line.debit), 0);
            const netVatPayable = outputVat - inputVat - creditableVatWithheld;

            return { grossSales, netSales, vatableSales, exemptSales, outputVat, grossPurchases, netPurchases, vatablePurchases, inputVat, creditableVatWithheld, netVatPayable };
        } catch (error: any) { return { error: error.message }; }
    }

    // 2. RELIEF / DAT FILE GENERATOR (Annex B)
    static async generateReliefAnnexes(year: number, quarter: number) {
        try {
            const startMonth = (quarter - 1) * 3;
            const startDate = new Date(year, startMonth, 1);
            const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);

            const purchaseEntries = await prisma.journalEntry.findMany({
                where: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE', lines: { some: { account_id: '1140' } } },
                include: { lines: true, payee: true }
            });

            const annexB_Purchases: any[] = [];
            purchaseEntries.forEach(entry => {
                const inputVatLine = entry.lines.find(l => l.account_id === '1140');
                if (!inputVatLine) return;
                const tax = Number(inputVatLine.debit);
                const expenseLines = entry.lines.filter(l => l.account_id !== '1140' && Number(l.debit) > 0);
                const netAmount = expenseLines.reduce((sum, l) => sum + Number(l.debit), 0);

                annexB_Purchases.push({ date: entry.date, supplierName: entry.payee?.name || 'Unknown Supplier', tin: entry.payee?.tin || '000-000-000-000', netAmount: netAmount, tax: tax, grossAmount: netAmount + tax });
            });
            return { annexB_Purchases };
        } catch (error: any) { return { error: error.message }; }
    }

    // 3. MONTHLY EXPANDED WITHHOLDING TAX (Form 0619-E)
    static async generate0619E(year: number, month: number) {
        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);

            const ewtLines = await prisma.journalLine.findMany({
                where: { account_id: '2050', credit: { gt: 0 }, entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' } },
                // 🔥 THE FIX: Added `lines: true` below to prevent the crash
                include: { entry: { include: { payee: true, lines: true } } }
            });

            let ewtWithheld = 0; const qapList: any[] = [];
            for (const line of ewtLines) {
                ewtWithheld += Number(line.credit);
                const expenseLine = line.entry.lines.find(l => Number(l.debit) > 0);
                qapList.push({
                    date: line.entry.date, payeeName: line.entry.payee?.name || 'Unknown', tin: line.entry.payee?.tin || '000-000-000-000',
                    atc: 'WI010', grossAmount: expenseLine ? Number(expenseLine.debit) : 0, taxWithheld: Number(line.credit)
                });
            }
            return { ewtWithheld, qapList };
        } catch (error: any) { return { error: error.message }; }
    }

    // 4. QUARTERLY EXPANDED WITHHOLDING TAX (Form 1601-EQ / 1604-E)
    static async generate1601EQ(year: number, quarter: number) {
        try {
            let startDate, endDate;
            if (quarter === 0) { // Annual Form 1604-E
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31, 23, 59, 59, 999);
            } else {
                const startMonth = (quarter - 1) * 3;
                startDate = new Date(year, startMonth, 1);
                endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
            }

            const ewtLines = await prisma.journalLine.findMany({
                where: { account_id: '2050', credit: { gt: 0 }, entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' } },
                include: { entry: { include: { payee: true, lines: true } } }
            });

            let ewtWithheld = 0; const qapList: any[] = [];
            for (const line of ewtLines) {
                ewtWithheld += Number(line.credit);
                const expenseLine = line.entry.lines.find(l => Number(l.debit) > 0);
                qapList.push({
                    date: line.entry.date, payeeName: line.entry.payee?.name || 'Unknown', tin: line.entry.payee?.tin || '000-000-000-000',
                    atc: 'WI010', grossAmount: expenseLine ? Number(expenseLine.debit) : 0, taxWithheld: Number(line.credit)
                });
            }
            return { ewtWithheld, qapList };
        } catch (error: any) { return { error: error.message }; }
    }
}