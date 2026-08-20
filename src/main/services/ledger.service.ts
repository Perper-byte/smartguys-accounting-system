// src/main/services/ledger.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const LedgerService = {
  
  async getAccounts() {
    return await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });
  },

  async getPayees(typeFilter?: string) {
    let whereClause = {};
    if (typeFilter) {
        const types = typeFilter.split(',');
        whereClause = { type: { in: types } };
    }
    return await prisma.payee.findMany({ where: whereClause, orderBy: { name: 'asc' } });
  },

 async createPayee(name: string, type: string = 'PATIENT', tin?: string, email?: string, phone?: string, address?: string) {
    return await prisma.payee.create({
      data: { 
          name, 
          type,
          tin: tin || null,
          email: email || null,
          phone_number: phone || null,
          address: address || null
      }
    });
  },
  async updatePayeeTin(payeeId: string, tin: string) {
    return await prisma.payee.update({
        where: { id: payeeId },
        data: { tin: tin }
    });
  },

  async getPayeeBalance(payeeId: string) {
    const lines = await prisma.journalLine.findMany({
        where: { entry: { payee_id: payeeId }, account_id: { in: ['1200', '2010'] } }
    });
    let receivable = 0; let payable = 0;
    for (const line of lines) {
        if (line.account_id === '1200') receivable += Number(line.debit) - Number(line.credit);
        if (line.account_id === '2010') payable += Number(line.credit) - Number(line.debit);
    }
    return { receivable, payable };
  },

  async createJournalEntry(data: any) {
    const entry = await prisma.journalEntry.create({
      data: {
          date: new Date(data.date),
          reference_no: data.referenceNo,
          description: data.description,
          vat_type: data.vatType || 'EXEMPT',
          user_id: data.userId, 
          payee_id: data.payeeId || null, 
          lines: {
              create: data.lines.map((l: any) => ({
                  account_id: l.accountId,
                  debit: l.debit,
                  credit: l.credit
              }))
          }
      }
    });
    return { success: true, referenceNo: entry.reference_no };
  },

  async getAccountLedger(accountId: string) {
    const account = await prisma.account.findUnique({ where: { code: accountId }, include: { account_type: true } });
    if (!account) throw new Error("Account not found");
    
    const lines = await prisma.journalLine.findMany({
        where: { account_id: accountId }, include: { entry: true }, orderBy: { entry: { date: 'asc' } }
    });

    let balance = 0;
    const normalBalance = account.account_type.normal_balance;
    const transactions = lines.map(line => {
        const debit = Number(line.debit); const credit = Number(line.credit);
        if (normalBalance === 'DEBIT') balance += (debit - credit); else balance += (credit - debit);
        return {
            id: line.id, entryId: line.entry.id, date: line.entry.date, referenceNo: line.entry.reference_no,
            description: line.entry.description, debit, credit, balance, status: line.entry.status
        };
    });
    return { accountCode: account.code, accountName: account.name, normalBalance, transactions, currentBalance: balance };
  },

    async getContactsWithBalances() {
    // 1. Fetch all contacts
    const payees = await prisma.payee.findMany({ orderBy: { name: 'asc' } });
    
    // 2. Fetch all A/R (1200) and A/P (2010) lines
    const lines = await prisma.journalLine.findMany({
        where: { 
            account_id: { in: ['1200', '2010'] }, 
            entry: { payee_id: { not: null }, status: 'ACTIVE' } 
        },
        include: { entry: true }
    });

    // 3. Group the balances by Payee
    const balances: Record<string, { receivable: number, payable: number }> = {};
    for (const line of lines) {
        const pId = line.entry.payee_id as string;
        if (!balances[pId]) balances[pId] = { receivable: 0, payable: 0 };
        
        if (line.account_id === '1200') balances[pId].receivable += (Number(line.debit) - Number(line.credit));
        if (line.account_id === '2010') balances[pId].payable += (Number(line.credit) - Number(line.debit));
    }

    // 4. Merge and return
    return payees.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        email: p.email,
        phone: p.phone_number,
        tin: p.tin,
        youOwe: balances[p.id]?.payable || 0,   // Accounts Payable
        theyOwe: balances[p.id]?.receivable || 0 // Accounts Receivable
    }));
  },


  async getFullLedgerReport(startDateStr: string, endDateStr: string) {
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const accounts = await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });
    
    const periodLines = await prisma.journalLine.findMany({
        where: { entry: { date: { gte: startDate, lte: endDate } } },
        include: { entry: { include: { payee: true } } },
        orderBy: { entry: { date: 'asc' } }
    });

    const priorLines = await prisma.journalLine.findMany({
        where: { entry: { date: { lt: startDate } } }
    });

    const report: any[] = [];

    for (const acc of accounts) {
        const normalBalance = acc.account_type.normal_balance;
        
        const accPriorLines = priorLines.filter(l => l.account_id === acc.code);
        let openingBalance = 0;
        for (const l of accPriorLines) {
            if (normalBalance === 'DEBIT') openingBalance += (Number(l.debit) - Number(l.credit));
            else openingBalance += (Number(l.credit) - Number(l.debit));
        }

        const accPeriodLines = periodLines.filter(l => l.account_id === acc.code);
        
        if (openingBalance === 0 && accPeriodLines.length === 0) continue;

        let runningBalance = openingBalance;
        let totalDebit = 0; let totalCredit = 0;

        const transactions = accPeriodLines.map(l => {
            const deb = Number(l.debit); const cred = Number(l.credit);
            totalDebit += deb; totalCredit += cred;

            if (normalBalance === 'DEBIT') runningBalance += (deb - cred);
            else runningBalance += (cred - deb);

            return {
                id: l.id, entryId: l.entry.id, date: l.entry.date, referenceNo: l.entry.reference_no,
                description: l.entry.description, payeeName: l.entry.payee?.name || '-',
                debit: deb, credit: cred, balance: runningBalance, status: l.entry.status
            };
        });

        report.push({
            accountCode: acc.code, accountName: acc.name, normalBalance: normalBalance,
            openingBalance: openingBalance, transactions: transactions,
            totalDebit: totalDebit, totalCredit: totalCredit, closingBalance: runningBalance
        });
    }

    return report;
  },

  async getNextReferenceSequence(prefix: string) {
    const lastEntry = await prisma.journalEntry.findFirst({ where: { reference_no: { startsWith: prefix } }, orderBy: { date: 'desc' } });
    if (!lastEntry) return '001';
    const lastSeqNum = parseInt(lastEntry.reference_no.replace(prefix, ''), 10);
    if (isNaN(lastSeqNum) || lastSeqNum > 999999) return '001'; 
    return (lastSeqNum + 1).toString().padStart(3, '0');
  },

  async getPayoutHistory() {
    const entries = await prisma.journalEntry.findMany({
        where: { reference_no: { startsWith: 'CV-' }, payee_id: { not: null } },
        include: { payee: true, lines: true }, orderBy: { date: 'desc' }
    });
    const history: any[] = [];
    entries.forEach(entry => {
        let gross = 0; let tax = 0; let net = 0;
        entry.lines.forEach(line => {
            if (line.account_id === '2010' && Number(line.debit) > 0) gross += Number(line.debit);
            if (line.account_id === '2050' && Number(line.credit) > 0) tax += Number(line.credit);
            if (line.account_id === '1010' && Number(line.credit) > 0) net += Number(line.credit);
        });
        if (gross > 0) history.push({ id: entry.id, date: entry.date, referenceNo: entry.reference_no, payee: entry.payee, description: entry.description, gross, tax, net });
    });
    return history;
  },

  async getAllRecentTransactions() {
    try {
        const entries = await prisma.journalEntry.findMany({ take: 50, orderBy: { date: 'desc' }, include: { lines: { include: { account: true } } } });
        const recentLines: any[] = [];
        entries.forEach(entry => {
            entry.lines.forEach(line => {
                recentLines.push({
                    id: line.id, entryId: entry.id, date: entry.date, referenceNo: entry.reference_no,
                    accountCode: line.account.code, accountName: line.account.name,
                    description: entry.description, debit: Number(line.debit), credit: Number(line.credit), status: entry.status
                });
            });
        });
        return recentLines.slice(0, 50);
    } catch (err) { return []; }
  },

  async requestVoid(entryId: string, reason: string) {
    return await prisma.journalEntry.update({
        where: { id: entryId },
        data: { status: 'PENDING_VOID', void_reason: reason }
    });
  },

  async getPendingVoids() {
    return await prisma.journalEntry.findMany({
        where: { status: 'PENDING_VOID' },
        include: { user: true, payee: true, lines: { include: { account: true } } },
        orderBy: { date: 'desc' }
    });
  },

  async rejectVoid(entryId: string) {
    return await prisma.journalEntry.update({
        where: { id: entryId },
        data: { status: 'ACTIVE', void_reason: null }
    });
  },

  async approveVoid(entryId: string, managerId: string) {
    const original = await prisma.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true } });
    if (!original) throw new Error("Entry not found.");

    await prisma.journalEntry.create({
        data: {
            date: new Date(),
            reference_no: `RVS-${original.reference_no}`,
            description: `VOID REVERSAL: ${original.reference_no} - Reason: ${original.void_reason}`,
            vat_type: original.vat_type,
            user_id: managerId,
            payee_id: original.payee_id,
            status: 'ACTIVE',
            lines: {
                create: original.lines.map(line => ({
                    account_id: line.account_id,
                    debit: line.credit, 
                    credit: line.debit  
                }))
            }
        }
    });

    await prisma.journalEntry.update({ where: { id: entryId }, data: { status: 'VOIDED' } });
    return { success: true };
  },

  async getUserSalesHistory(userId: string) {
    const entries = await prisma.journalEntry.findMany({
        where: {
            user_id: userId,
            OR: [ { reference_no: { startsWith: 'INV-' } }, { reference_no: { startsWith: 'OR-' } } ]
        },
        orderBy: { date: 'desc' },
        take: 100,
        include: { payee: true, lines: { include: { account: true } } }
    });

    return entries.map(entry => {
        const totalAmount = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
        return {
            id: entry.id, date: entry.date, referenceNo: entry.reference_no, description: entry.description,
            payeeName: entry.payee?.name || 'Walk-in / Cash', totalAmount: totalAmount, status: entry.status,
            lines: entry.lines.map(l => ({ accountCode: l.account.code, accountName: l.account.name, debit: Number(l.debit), credit: Number(l.credit) }))
        };
    });
  }
};