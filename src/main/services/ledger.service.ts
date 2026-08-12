// src/main/services/ledger.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const LedgerService = {
  
  async getAccounts() {
    return await prisma.account.findMany({
      include: { account_type: true },
      orderBy: { code: 'asc' }
    });
  },

  async getPayees() {
    return await prisma.payee.findMany({
      orderBy: { name: 'asc' }
    });
  },

  async createPayee(name: string) {
    return await prisma.payee.create({
      data: { name }
    });
  },

  async getPayeeBalance(payeeId: string) {
    const idAsInt = parseInt(payeeId, 10);
    const lines = await prisma.journalLine.findMany({
        where: { 
            entry: { payee_id: idAsInt }, 
            account_id: { in: ['1200', '2010'] } // 1200 A/R, 2010 A/P
        }
    });

    let receivable = 0;
    let payable = 0;

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
          user_id: parseInt(data.userId, 10),
          payee_id: data.payeeId ? parseInt(data.payeeId, 10) : null,
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
    const account = await prisma.account.findUnique({ 
        where: { code: accountId }, 
        include: { account_type: true } 
    });
    
    if (!account) throw new Error("Account not found");
    
    const lines = await prisma.journalLine.findMany({
        where: { account_id: accountId },
        include: { entry: true },
        orderBy: { entry: { date: 'asc' } }
    });

    let balance = 0;
    const normalBalance = account.account_type.normal_balance;
    
    const transactions = lines.map(line => {
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        
        if (normalBalance === 'DEBIT') balance += (debit - credit);
        else balance += (credit - debit);
        
        return {
            id: line.id,
            date: line.entry.date,
            referenceNo: line.entry.reference_no,
            description: line.entry.description,
            debit,
            credit,
            balance
        };
    });

    return {
        accountCode: account.code,
        accountName: account.name,
        normalBalance,
        transactions,
        currentBalance: balance
    };
  },

  // ==========================================
  // ---> NEW: AUTO-SEQUENCE GENERATOR <---
  // ==========================================
  async getNextReferenceSequence(prefix: string) {
    // 1. Find the newest entry with this exact prefix
    const lastEntry = await prisma.journalEntry.findFirst({
        where: { reference_no: { startsWith: prefix } },
        orderBy: { date: 'desc' } // Uses 'date' to prevent the created_at error!
    });

    // 2. If no entries exist yet, start at 001
    if (!lastEntry) return '001';

    // 3. Extract the number: "JV-005" -> "005"
    const lastSeqString = lastEntry.reference_no.replace(prefix, '');
    const lastSeqNum = parseInt(lastSeqString, 10);

    if (isNaN(lastSeqNum)) return '001'; // Fallback

    // 4. Add 1 and pad with zeros -> "006"
    const nextSeq = (lastSeqNum + 1).toString().padStart(3, '0');
    return nextSeq;
  }, // <---- THIS COMMA IS CRITICAL!

  // ==========================================
  // ---> NEW: PAYOUT HISTORY QUERY <---
  // ==========================================
  async getPayoutHistory() {
    // 1. Fetch all Check Vouchers with a Payee
    const entries = await prisma.journalEntry.findMany({
        where: {
            reference_no: { startsWith: 'CV-' },
            payee_id: { not: null }
        },
        include: { payee: true, lines: true },
        orderBy: { date: 'desc' }
    });

    // 2. Filter and map only the ones that are actual A/P Settlements
    const history: any[] = [];

    entries.forEach(entry => {
        let gross = 0;
        let tax = 0;
        let net = 0;

        entry.lines.forEach(line => {
            if (line.account_id === '2010' && Number(line.debit) > 0) gross += Number(line.debit);
            if (line.account_id === '2050' && Number(line.credit) > 0) tax += Number(line.credit);
            if (line.account_id === '1010' && Number(line.credit) > 0) net += Number(line.credit);
        });

        // If it paid off A/P, it's a Doctor/Vendor payout!
        if (gross > 0) {
            history.push({
                id: entry.id,
                date: entry.date,
                referenceNo: entry.reference_no,
                payee: entry.payee,
                description: entry.description,
                gross,
                tax,
                net
            });
        }
    });

    return history;
  }
};