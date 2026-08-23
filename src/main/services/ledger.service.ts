// src/main/services/ledger.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type JournalEntryInput = {
    date: Date;
    referenceNo: string;
    description: string;
    userId: string;
    payeeId?: string;
    vatType?: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
};

export const LedgerService = {
  
    async getAccounts() {
        return await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });
    },

    async getBankAccounts() {
        return await prisma.bankAccount.findMany({ include: { ledger_account_ref: true }, orderBy: { name: 'asc' } });
    },

    async createBankAccount(data: { name: string; accountNumber?: string; ledgerAccount: string }) {
        try {
            const bankAccount = await prisma.bankAccount.create({ 
                data: {
                    name: data.name,
                    account_number: data.accountNumber || null,
                    ledger_account: data.ledgerAccount
                }, 
                include: { ledger_account_ref: true } 
            });
            return { success: true, data: bankAccount };
        } catch (error: any) {
            console.error("Bank Account Creation Error:", error);
            return { success: false, error: error.message };
        }
    },

    async getReconciliationData(bankAccountId: string, startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
        if (!bankAccount) throw new Error('Bank account not found');

        const transactions = await prisma.bankTransaction.findMany({
            where: { bank_account_id: bankAccountId, status: { not: 'DELETED' }, transaction_date: { gte: startDate, lte: endDate } },
            include: { reconciliation: { include: { journal_entry: true } } },
            orderBy: { transaction_date: 'desc' }
        });
        const entries = await prisma.journalEntry.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                status: 'ACTIVE',
                NOT: { reference_no: { startsWith: 'RVS-' } },
                lines: { some: { account_id: bankAccount.ledger_account } },
                reconciliation: null
            },
            include: { lines: true },
            orderBy: { date: 'desc' }
        });
        return {
            bankAccount,
            transactions: transactions.map(transaction => ({
                ...transaction,
                amount: Number(transaction.amount),
                matchedEntry: transaction.reconciliation?.journal_entry || null
            })),
            entries: entries.map(entry => ({
                id: entry.id,
                date: entry.date,
                referenceNo: entry.reference_no,
                description: entry.description,
                amount: entry.lines
                    .filter(line => line.account_id === bankAccount.ledger_account)
                    .reduce((total, line) => total + Number(line.debit) - Number(line.credit), 0)
            }))
        };
    },

    async createBankTransaction(data: { bankAccountId: string; date: string; description: string; referenceNo?: string; amount: number }) {
        const transaction = await prisma.bankTransaction.create({ data: {
            bank_account_id: data.bankAccountId,
            transaction_date: new Date(data.date),
            description: data.description,
            reference_no: data.referenceNo || null,
            amount: data.amount
        } });
        return {
            id: transaction.id,
            bank_account_id: transaction.bank_account_id,
            transaction_date: transaction.transaction_date.toISOString(),
            description: transaction.description,
            reference_no: transaction.reference_no,
            amount: Number(transaction.amount),
            status: transaction.status,
            created_at: transaction.created_at.toISOString()
        };
    },

    async importBankTransactions(data: { bankAccountId: string; transactions: Array<{ date: string; description: string; referenceNo?: string; amount: number }> }) {
        if (!data.transactions.length) throw new Error('No bank transactions to import');
        if (!data.bankAccountId) throw new Error('Bank account is required');

        const bankAccount = await prisma.bankAccount.findUnique({ where: { id: data.bankAccountId } });
        if (!bankAccount) throw new Error('Bank account not found');

        for (const transaction of data.transactions) {
            if (!transaction.description?.trim()) throw new Error('Every imported row needs a description');
            if (!Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) === 0) throw new Error('Every imported row needs a non-zero amount');
            if (Number.isNaN(new Date(transaction.date).getTime())) throw new Error('Every imported row needs a valid date');
        }

        const dates = data.transactions.map(transaction => new Date(transaction.date));
        const earliestDate = new Date(Math.min(...dates.map(date => date.getTime())));
        const latestDate = new Date(Math.max(...dates.map(date => date.getTime())));
        latestDate.setHours(23, 59, 59, 999);
        
        const existingTransactions = await prisma.bankTransaction.findMany({
            where: {
                bank_account_id: data.bankAccountId,
                status: { not: 'DELETED' },
                transaction_date: { gte: earliestDate, lte: latestDate }
            },
            select: { transaction_date: true, description: true, reference_no: true, amount: true }
        });
        
        const duplicateKey = (transaction: { date: string; description: string; referenceNo?: string; amount: number }) =>
            `${new Date(transaction.date).toISOString().slice(0, 10)}|${transaction.description.trim().toLowerCase()}|${transaction.referenceNo?.trim().toLowerCase() || ''}|${Number(transaction.amount).toFixed(2)}`;
            
        const existingKeys = new Set(existingTransactions.map(transaction => duplicateKey({
            date: transaction.transaction_date.toISOString(),
            description: transaction.description,
            referenceNo: transaction.reference_no || undefined,
            amount: Number(transaction.amount)
        })));
        
        const importKeys = new Set<string>();
        const newTransactions = data.transactions.filter(transaction => {
            const key = duplicateKey(transaction);
            if (existingKeys.has(key) || importKeys.has(key)) return false;
            importKeys.add(key);
            return true;
        });
        
        const skippedCount = data.transactions.length - newTransactions.length;
        if (!newTransactions.length) return { count: 0, skippedCount };

        const result = await prisma.bankTransaction.createMany({
            data: newTransactions.map(transaction => ({
                bank_account_id: data.bankAccountId,
                transaction_date: new Date(transaction.date),
                description: transaction.description.trim(),
                reference_no: transaction.referenceNo?.trim() || null,
                amount: Number(transaction.amount)
            }))
        });
        return { count: result.count, skippedCount };
    },

    async matchBankTransaction(bankTxId: string, journalEntryId: string, userId: string) {
        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Create the link between the bank record and the journal entry
                const recon = await tx.reconciliation.create({
                    data: {
                        bank_transaction_id: bankTxId,
                        journal_entry_id: journalEntryId,
                        matched_by: userId
                    }
                });
                
                // 2. Mark the bank transaction as MATCHED
                await tx.bankTransaction.update({
                    where: { id: bankTxId },
                    data: { status: 'MATCHED' }
                });

                return { success: true, reconciliation: recon };
            });
        } catch (error: any) {
            console.error("Match Error:", error);
            return { success: false, error: error.message };
        }
    },

    async unmatchBankTransaction(bankTxId: string) {
        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Destroy the link (Using deleteMany so it doesn't crash if already deleted!)
                await tx.reconciliation.deleteMany({
                    where: { bank_transaction_id: bankTxId }
                });
                
                // 2. Revert the bank transaction status to UNMATCHED
                await tx.bankTransaction.update({
                    where: { id: bankTxId },
                    data: { status: 'UNMATCHED' }
                });

                return { success: true };
            });
        } catch (error: any) {
            console.error("Unmatch Error:", error);
            return { success: false, error: error.message };
        }
    },

    async removeBankTransaction(bankTxId: string, userId: string) {
        try {
            // Soft delete so it hides from the UI but stays in the DB audit trail
            await prisma.bankTransaction.update({
                where: { id: bankTxId },
                data: { status: 'DELETED' }
            });
            return { success: true };
        } catch (error: any) {
            console.error("Remove Error:", error);
            return { success: false, error: error.message };
        }
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

     async getPendingVoids() {
        const entries = await prisma.journalEntry.findMany({
            where: { status: 'PENDING_VOID' },
            include: { user: true, payee: true, lines: { include: { account: true } } },
            orderBy: { date: 'desc' }
        });

        // 🔥 THE FIX: Convert Prisma Decimal objects into standard Numbers so Electron can clone them!
        return entries.map(entry => ({
            ...entry,
            lines: entry.lines.map(line => ({
                ...line,
                debit: Number(line.debit),
                credit: Number(line.credit)
            }))
        }));
    },

    async createJournalEntry(data: JournalEntryInput) {
        const validLines = data.lines.filter(line => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0));
        if (data.lines.some(line => Number(line.debit) < 0 || Number(line.credit) < 0)) {
            throw new Error('Validation Error: Debit and Credit values cannot be negative');
        }
        const totalDebit = validLines.reduce((sum, line) => sum + Number(line.debit), 0);
        const totalCredit = validLines.reduce((sum, line) => sum + Number(line.credit), 0);
        if (!validLines.length || Math.abs(totalDebit - totalCredit) > 0.005) {
            throw new Error('Validation Error: Journal entry must be balanced');
        }
        const entry = await prisma.journalEntry.create({
            data: {
                date: new Date(data.date),
                reference_no: data.referenceNo,
                description: data.description,
                vat_type: data.vatType || 'EXEMPT',
                user_id: data.userId, 
                payee_id: data.payeeId || null, 
                lines: {
                    create: validLines.map((l) => ({
                        account_id: l.accountId,
                        debit: l.debit,
                        credit: l.credit
                    }))
                }
            }
        });
        return { success: true, referenceNo: entry.reference_no, entryId: entry.id };
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