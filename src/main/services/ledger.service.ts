import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface JournalLineInput {
    accountId: string; 
    debit: number;
    credit: number;
}

export interface JournalEntryInput {
    date: Date;
    referenceNo: string;
    description: string;
    vatType: string;  
    payeeId?: string; 
    userId: string;
    lines: JournalLineInput[];
}

export class LedgerService {
    
    // =====================================
    // ACCOUNTS & BANK RECONCILIATION
    // =====================================
    static async getAccounts() {
        return await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });
    }

    static async getBankAccounts() {
        return await prisma.bankAccount.findMany({ include: { ledger_account_ref: true }, orderBy: { name: 'asc' } });
    }

    static async createBankAccount(data: { name: string; accountNumber?: string; ledgerAccount: string }) {
        return await prisma.bankAccount.create({ data: {
            name: data.name,
            account_number: data.accountNumber || null,
            ledger_account: data.ledgerAccount
        }, include: { ledger_account_ref: true } });
    }

    static async getReconciliationData(bankAccountId: string, startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
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
                ...transaction, amount: Number(transaction.amount), matchedEntry: transaction.reconciliation?.journal_entry || null
            })),
            entries: entries.map(entry => ({
                id: entry.id, date: entry.date, referenceNo: entry.reference_no, description: entry.description,
                amount: entry.lines.filter(line => line.account_id === bankAccount.ledger_account).reduce((total, line) => total + Number(line.debit) - Number(line.credit), 0)
            }))
        };
    }

    static async createBankTransaction(data: { bankAccountId: string; date: string; description: string; referenceNo?: string; amount: number }) {
        const transaction = await prisma.bankTransaction.create({ data: {
            bank_account_id: data.bankAccountId, transaction_date: new Date(data.date),
            description: data.description, reference_no: data.referenceNo || null, amount: data.amount
        }});
        return { ...transaction, amount: Number(transaction.amount) };
    }

    static async importBankTransactions(data: { bankAccountId: string; transactions: Array<{ date: string; description: string; referenceNo?: string; amount: number }> }) {
        if (!data.transactions.length) throw new Error('No bank transactions to import');
        
        let count = 0;
        for (const transaction of data.transactions) {
            await prisma.bankTransaction.create({
                data: {
                    bank_account_id: data.bankAccountId, transaction_date: new Date(transaction.date),
                    description: transaction.description, reference_no: transaction.referenceNo || null, amount: transaction.amount
                }
            });
            count++;
        }
        return { success: true, count };
    }

    // =====================================
    // PAYEES / PATIENTS / VENDORS
    // =====================================
    static async getPayees(typeFilter?: string) {
        return await prisma.payee.findMany({ 
            where: typeFilter ? { type: typeFilter } : undefined,
            orderBy: { name: 'asc' } 
        });
    }

    static async createPayee(
        name: string,
        type?: string,
        tin?: string,
        email?: string,
        phone?: string,
        address?: string
    ) {
        try {
            const newPayee = await prisma.payee.create({
                data: {
                    name,
                    type: type || 'VENDOR',
                    tin: tin || null,
                    email: email || null,
                    phone_number: phone || null,
                    address: address || null
                }
            });
            return { success: true, payee: newPayee };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    static async updatePayeeTin(payeeId: string, tin: string) {
        await prisma.payee.update({ where: { id: payeeId }, data: { tin } });
    }

    static async getPayeeBalance(payeeId: string) {
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: { payee_id: payeeId, status: { not: 'VOIDED' } },
                account_id: { in: ['1200', '2010'] }
            }
        });

        let arBalance = 0; let apBalance = 0; 
        for (const line of lines) {
            if (line.account_id === '1200') arBalance += Number(line.debit) - Number(line.credit);
            else if (line.account_id === '2010') apBalance += Number(line.credit) - Number(line.debit);
        }
        return { receivable: arBalance, payable: apBalance };
    }

    static async getContactsWithBalances() {
        const [payees, lines] = await Promise.all([
            prisma.payee.findMany({ orderBy: { name: 'asc' } }),
            prisma.journalLine.findMany({
                where: {
                    account_id: { in: ['1200', '2010'] },
                    entry: { payee_id: { not: null }, status: { not: 'VOIDED' } }
                },
                select: {
                    account_id: true,
                    debit: true,
                    credit: true,
                    entry: { select: { payee_id: true } }
                }
            })
        ]);

        const balances = new Map<string, { youOwe: number; theyOwe: number }>();
        for (const line of lines) {
            const payeeId = line.entry.payee_id;
            if (!payeeId) continue;

            const balance = balances.get(payeeId) || { youOwe: 0, theyOwe: 0 };
            if (line.account_id === '1200') {
                balance.theyOwe += Number(line.debit) - Number(line.credit);
            } else {
                balance.youOwe += Number(line.credit) - Number(line.debit);
            }
            balances.set(payeeId, balance);
        }

        return payees.map((payee) => ({
            id: payee.id,
            name: payee.name,
            type: payee.type,
            tin: payee.tin,
            email: payee.email,
            phone: payee.phone_number,
            address: payee.address,
            youOwe: balances.get(payee.id)?.youOwe || 0,
            theyOwe: balances.get(payee.id)?.theyOwe || 0
        }));
    }

    // =====================================
    // JOURNAL ENTRIES
    // =====================================
    static async createJournalEntry(input: JournalEntryInput) {
        return await prisma.$transaction(async (tx) => {
            const entry = await tx.journalEntry.create({
                data: {
                    date: input.date, reference_no: input.referenceNo, description: input.description,
                    vat_type: input.vatType, payee_id: input.payeeId || null, user_id: input.userId,
                }
            });

            const linesData = input.lines.map((line) => ({
                entry_id: entry.id, account_id: line.accountId, debit: line.debit, credit: line.credit,
            }));

            await tx.journalLine.createMany({ data: linesData });
            return { success: true, entryId: entry.id, referenceNo: entry.reference_no };
        });
    }

    static async getAllJournalEntries() {
        return await prisma.journalEntry.findMany({
            orderBy: { date: 'desc' },
            select: { id: true, reference_no: true, description: true, date: true }
        });
    }

    static async getNextReferenceSequence(prefix: string) {
        const lastEntry = await prisma.journalEntry.findFirst({ where: { reference_no: { startsWith: prefix } }, orderBy: { date: 'desc' } });
        if (!lastEntry) return '001';
        const lastSeqNum = parseInt(lastEntry.reference_no.replace(prefix, ''), 10);
        if (isNaN(lastSeqNum) || lastSeqNum > 999999) return '001'; 
        return (lastSeqNum + 1).toString().padStart(3, '0');
    }

    // =====================================
    // LEDGER REPORTS
    // =====================================
    static async getAccountLedger(accountId: string) {
        const account = await prisma.account.findUnique({
            where: { code: accountId }, include: { account_type: true }
        });
        if (!account) throw new Error("Account not found");

        const normalBalance = account.account_type.normal_balance; 
        const lines = await prisma.journalLine.findMany({
            where: { account_id: accountId, entry: { status: 'ACTIVE' } },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } } 
        });

        let runningBalance = 0;
        const transactions = lines.map(line => {
            const debit = Number(line.debit); const credit = Number(line.credit);
            if (normalBalance === 'DEBIT') runningBalance += (debit - credit);
            else runningBalance += (credit - debit);

            return {
                id: line.id, date: line.entry.date, referenceNo: line.entry.reference_no,
                description: line.entry.description, vatType: line.entry.vat_type, 
                payee: line.entry.payee?.name || '-', debit, credit, balance: runningBalance
            };
        });

        return { accountCode: account.code, accountName: account.name, normalBalance, transactions };
    }

    static async getFullLedgerReport(startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr); startDate.setHours(0,0,0,0);
        const endDate = new Date(endDateStr); endDate.setHours(23,59,59,999);

        const accounts = await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });
        const priorLines = await prisma.journalLine.findMany({ where: { entry: { date: { lt: startDate }, status: 'ACTIVE' } } });
        const periodLines = await prisma.journalLine.findMany({
            where: { entry: { date: { gte: startDate, lte: endDate } } },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } }
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
                if (l.entry.status === 'ACTIVE') {
                    totalDebit += deb; totalCredit += cred;
                    if (normalBalance === 'DEBIT') runningBalance += (deb - cred);
                    else runningBalance += (cred - deb);
                }
                return {
                    id: l.id, entryId: l.entry.id, date: l.entry.date, referenceNo: l.entry.reference_no,
                    description: l.entry.description, payeeName: l.entry.payee?.name || '-',
                    debit: deb, credit: cred, balance: l.entry.status === 'ACTIVE' ? runningBalance : 0, status: l.entry.status
                };
            });

            report.push({
                accountCode: acc.code, accountName: acc.name, normalBalance,
                openingBalance, transactions, totalDebit, totalCredit, closingBalance: runningBalance
            });
        }
        return report;
    }

    // =====================================
    // TRANSACTION HISTORIES
    // =====================================
    static async getPayoutHistory() {
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
    }

    static async getAllRecentTransactions() {
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
    }

    static async getUserSalesHistory(userId: string) {
        const entries = await prisma.journalEntry.findMany({
            where: { user_id: userId, OR: [ { reference_no: { startsWith: 'INV-' } }, { reference_no: { startsWith: 'OR-' } } ] },
            orderBy: { date: 'desc' }, take: 100, include: { payee: true, lines: { include: { account: true } } }
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

    // =====================================
    // VOIDS & REVERSALS
    // =====================================
    static async requestVoid(entryId: string, reason: string) {
        return await prisma.journalEntry.update({
            where: { id: entryId }, data: { status: 'PENDING_VOID', void_reason: reason }
        });
    }

    static async getPendingVoids() {
        return await prisma.journalEntry.findMany({
            where: { status: 'PENDING_VOID' },
            include: { user: true, payee: true, lines: { include: { account: true } } },
            orderBy: { date: 'desc' }
        });
    }

    static async rejectVoid(entryId: string) {
        return await prisma.journalEntry.update({
            where: { id: entryId }, data: { status: 'ACTIVE', void_reason: null }
        });
    }

    static async approveVoid(entryId: string, managerId: string) {
        const original = await prisma.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true } });
        if (!original) throw new Error("Entry not found.");

        await prisma.journalEntry.create({
            data: {
                date: new Date(), reference_no: `RVS-${original.reference_no}`, description: `VOID REVERSAL: ${original.reference_no} - Reason: ${original.void_reason}`,
                vat_type: original.vat_type, user_id: managerId, payee_id: original.payee_id, status: 'ACTIVE',
                lines: {
                    create: original.lines.map(line => ({
                        account_id: line.account_id, debit: line.credit, credit: line.debit  
                    }))
                }
            }
        });

        await prisma.journalEntry.update({ where: { id: entryId }, data: { status: 'VOIDED' } });
        return { success: true };
    }
}
