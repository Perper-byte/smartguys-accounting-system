// src/main/services/ledger.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const LedgerService = {
  
  async getAccounts() {
    return await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });
  },

  async getPayees() {
    return await prisma.payee.findMany({ orderBy: { name: 'asc' } });
  },

  async createPayee(name: string) {
    return await prisma.payee.create({ data: { name } });
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

  async getNextReferenceSequence(prefix: string) {
    const lastEntry = await prisma.journalEntry.findFirst({ where: { reference_no: { startsWith: prefix } }, orderBy: { date: 'desc' } });
    if (!lastEntry) return '001';
    const lastSeqString = lastEntry.reference_no.replace(prefix, '');
    const lastSeqNum = parseInt(lastSeqString, 10);
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

  // ---> THE FIX: Formatting the Decimals before sending to Electron! <---
  async getPendingVoids() {
    const entries = await prisma.journalEntry.findMany({
        where: { status: 'PENDING_VOID' },
        include: { user: true, payee: true, lines: { include: { account: true } } },
        orderBy: { date: 'desc' }
    });

    return entries.map(entry => ({
        id: entry.id,
        date: entry.date,
        reference_no: entry.reference_no,
        description: entry.description,
        void_reason: entry.void_reason,
        user: { username: entry.user?.username || 'Unknown' },
        payee: entry.payee ? { name: entry.payee.name } : null,
        lines: entry.lines.map(line => ({
            accountCode: line.account.code,
            accountName: line.account.name,
            debit: Number(line.debit),
            credit: Number(line.credit)
        }))
    }));
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
                    debit: line.credit, // FLIPPED TO REVERSE!
                    credit: line.debit  // FLIPPED TO REVERSE!
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