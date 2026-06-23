// src/main/services/tax.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TaxService {
    /**
     * Helper function to get the start and end dates of a specific quarter
     */
    private static getQuarterDates(year: number, quarter: number) {
        const startMonth = (quarter - 1) * 3; // Q1 = 0 (Jan), Q2 = 3 (Apr), etc.
        const startDate = new Date(year, startMonth, 1);
        const endDate = new Date(year, startMonth + 3, 0); // Last day of the 3rd month
        return { startDate, endDate };
    }

    /**
     * Generates data for BIR Form 2550Q (Quarterly Value-Added Tax Return)
     */
    static async generate2550Q(year: number, quarter: number) {
        const { startDate, endDate } = this.getQuarterDates(year, quarter);

        // 1. Fetch all journal entries within the selected quarter
        const entries = await prisma.journalEntry.findMany({
            where: {
                date: { gte: startDate, lte: endDate }
            },
            include: {
                lines: { include: { account: { include: { account_type: true } } } }
            }
        });

        let vatableSales = 0;
        let vatablePurchases = 0;

        // 2. Aggregate Sales and Purchases
        for (const entry of entries) {
            for (const line of entry.lines) {
                // Sales/Revenue (Credit balance)
                if (line.account.account_type.name === 'Revenue') {
                    vatableSales += Number(line.credit);
                }
                // Purchases/Expenses (Debit balance, excluding payroll since salaries have no VAT)
                if (line.account.account_type.name === 'Expense' && line.account.name !== 'Salaries Expense') {
                    vatablePurchases += Number(line.debit);
                }
            }
        }

        // 3. Philippine VAT Calculation (12%)
        // Assuming ledger amounts are Gross (VAT Inclusive). 
        // Net of VAT = Gross / 1.12. Output VAT = Gross - Net.
        const netSales = vatableSales / 1.12;
        const outputVat = vatableSales - netSales;

        const netPurchases = vatablePurchases / 1.12;
        const inputVat = vatablePurchases - netPurchases;

        const netVatPayable = outputVat - inputVat;

        return {
            year,
            quarter,
            grossSales: Number(vatableSales.toFixed(2)),
            netSales: Number(netSales.toFixed(2)),
            outputVat: Number(outputVat.toFixed(2)),

            grossPurchases: Number(vatablePurchases.toFixed(2)),
            netPurchases: Number(netPurchases.toFixed(2)),
            inputVat: Number(inputVat.toFixed(2)),

            netVatPayable: Number(netVatPayable.toFixed(2))
        };
    }

    /**
     * Generates data for BIR Relief Annexes (Summary List of Sales and Purchases)
     */
    static async generateReliefAnnexes(year: number, quarter: number) {
        const { startDate, endDate } = this.getQuarterDates(year, quarter);

        // Fetch entries with Payees (since Annexes require TINs)
        const entries = await prisma.journalEntry.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                payee_id: { not: null } // Only get transactions with recorded payees/clients
            },
            include: {
                payee: true,
                lines: { include: { account: { include: { account_type: true } } } }
            }
        });

        const annexA_Sales: any[] = [];
        const annexB_Purchases: any[] = [];

        for (const entry of entries) {
            for (const line of entry.lines) {
                if (line.account.account_type.name === 'Revenue' && Number(line.credit) > 0) {
                    const gross = Number(line.credit);
                    annexA_Sales.push({
                        date: entry.date,
                        refNo: entry.reference_no,
                        customerName: entry.payee?.name,
                        tin: entry.payee?.tin || '000-000-000-000',
                        grossAmount: gross,
                        netAmount: Number((gross / 1.12).toFixed(2)),
                        tax: Number((gross - (gross / 1.12)).toFixed(2))
                    });
                }
                if (line.account.account_type.name === 'Expense' && Number(line.debit) > 0 && line.account.name !== 'Salaries Expense') {
                    const gross = Number(line.debit);
                    annexB_Purchases.push({
                        date: entry.date,
                        refNo: entry.reference_no,
                        supplierName: entry.payee?.name,
                        tin: entry.payee?.tin || '000-000-000-000',
                        grossAmount: gross,
                        netAmount: Number((gross / 1.12).toFixed(2)),
                        tax: Number((gross - (gross / 1.12)).toFixed(2))
                    });
                }
            }
        }

        return { annexA_Sales, annexB_Purchases };
    }
}