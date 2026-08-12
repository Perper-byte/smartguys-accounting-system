// src/main/services/tax.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const TaxService = {
  
  async generate2550Q(year: number, quarter: number) {
    let startDate: Date;
    let endDate: Date;

    // ---> NEW: If quarter is 0, fetch the entire year! <---
    if (quarter === 0) {
        startDate = new Date(year, 0, 1); // Jan 1
        endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31
    } else {
        const startMonth = (quarter - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 0, 23, 59, 59);
    }

    const entries = await prisma.journalEntry.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { lines: true, payee: true } 
    });

    let outputVat = 0;
    let inputVat = 0;
    let exemptSales = 0;
    let creditableVatWithheld = 0;
    let ewtWithheld = 0;
    
    const qapList: any[] = [];

    entries.forEach(entry => {
      let hasEwt = false;
      let ewtAmount = 0;
      let grossPayout = 0;

      entry.lines.forEach(line => {
        const credit = Number(line.credit);
        const debit = Number(line.debit);

        if (line.account_id === '2020' && credit > 0) outputVat += credit;
        if (line.account_id === '1300' && debit > 0) inputVat += debit;
        if (line.account_id === '1310' && debit > 0) creditableVatWithheld += debit;
        if (entry.vat_type === 'EXEMPT' && line.account_id.startsWith('40') && credit > 0) {
            exemptSales += credit;
        }

        if (line.account_id === '2050' && credit > 0) {
            ewtWithheld += credit;
            hasEwt = true;
            ewtAmount += credit;
        }
        if (line.account_id === '2010' && debit > 0) {
            grossPayout += debit; 
        }
      });

      if (hasEwt && entry.payee) {
         const taxRate = Math.round((ewtAmount / grossPayout) * 100);
         let atcCode = taxRate === 5 ? 'WI011' : 'WI157';

         qapList.push({
            date: entry.date,
            payeeName: entry.payee.name,
            tin: entry.payee.tin || '000-000-000-000',
            atc: atcCode,
            grossAmount: grossPayout,
            taxWithheld: ewtAmount
         });
      }
    });

    const vatableSales = outputVat / 0.12;
    const vatablePurchases = inputVat / 0.12;
    const netVatPayable = outputVat - inputVat - creditableVatWithheld;

    return {
      year,
      quarter,
      vatableSales,
      exemptSales,
      outputVat,
      vatablePurchases,
      inputVat,
      creditableVatWithheld,
      netVatPayable,
      ewtWithheld,
      qapList 
    };
  },

  async generateReliefAnnexes(year: number, quarter: number) {
    let startDate: Date;
    let endDate: Date;

    // ---> NEW: If quarter is 0, fetch the entire year! <---
    if (quarter === 0) {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
    } else {
        const startMonth = (quarter - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 0, 23, 59, 59);
    }

    const entries = await prisma.journalEntry.findMany({
      where: { date: { gte: startDate, lte: endDate }, payee_id: { not: null } },
      include: { lines: true, payee: true }
    });

    const annexB_Purchases: any[] = [];

    entries.forEach(entry => {
      let hasInputVat = false;
      let inputVatAmount = 0;
      let grossAmount = 0;

      entry.lines.forEach(line => {
        if (line.account_id === '1300' && Number(line.debit) > 0) {
            hasInputVat = true;
            inputVatAmount = Number(line.debit);
        }
        if (Number(line.credit) > 0 && line.account_id === '1010') {
            grossAmount += Number(line.credit);
        }
      });

      if (hasInputVat && entry.payee) {
        annexB_Purchases.push({
            date: entry.date,
            supplierName: entry.payee.name,
            tin: entry.payee.tin || '000-000-000-000',
            grossAmount: grossAmount,
            tax: inputVatAmount
        });
      }
    });

    return { annexB_Purchases };
  }
};