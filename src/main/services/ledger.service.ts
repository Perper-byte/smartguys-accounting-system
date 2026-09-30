import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { cleanDescription } from '../../shared/formatters';

const prisma = new PrismaClient();

function verifyPinMatch(inputPin?: string | null, storedPinOrHash?: string | null): boolean {
    if (!inputPin || !storedPinOrHash) return false;
    const cleanInput = inputPin.trim();
    const cleanStored = storedPinOrHash.trim();
    if (!cleanInput || !cleanStored) return false;

    if (cleanStored.startsWith('$2')) {
        try {
            return bcrypt.compareSync(cleanInput, cleanStored);
        } catch {
            return false;
        }
    }

    const hashA = crypto.createHash('sha256').update(cleanInput).digest();
    const hashB = crypto.createHash('sha256').update(cleanStored).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

export type JournalEntryInput = {
    date: Date;
    referenceNo: string;
    description: string;
    userId: string;
    payeeId?: string;
    vatType?: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
    attachments?: Array<{ name?: string; type?: string; size?: number; data?: string; fileName?: string; fileType?: string; fileData?: string }>;
    overridePin?: string; // 🔥 NEW
};

export const LedgerService = {

    async evaluateAutoLock() {
        const setting = await prisma.systemSetting.findFirst();
        if (!setting || !setting.auto_lock_day) return;

        const today = new Date();
        const currentDay = today.getDate();

        if (currentDay > setting.auto_lock_day) {
            const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            if (!setting.lock_date || setting.lock_date < lastDayOfPrevMonth) {
                await prisma.systemSetting.update({
                    where: { id: setting.id },
                    data: { lock_date: lastDayOfPrevMonth }
                });
            }
        }
    },

    async getLockDate() {
        await this.evaluateAutoLock();
        const setting = await prisma.systemSetting.findFirst();
        return {
            lockDate: setting?.lock_date ? setting.lock_date.toISOString() : null,
            autoLockDay: setting?.auto_lock_day || null,
            hasOverridePin: !!setting?.override_pin
        };
    },

    async setLockDate(data: { lockDate: string | null, autoLockDay: number | null, overridePin: string | null }) {
        let setting = await prisma.systemSetting.findFirst();
        let pinToStore = setting?.override_pin || null;

        if (data.overridePin !== undefined) {
            if (!data.overridePin || !data.overridePin.trim()) {
                pinToStore = null;
            } else if (data.overridePin.trim().startsWith('$2')) {
                pinToStore = data.overridePin.trim();
            } else {
                pinToStore = await bcrypt.hash(data.overridePin.trim(), 10);
            }
        }

        if (!setting) {
            setting = await prisma.systemSetting.create({
                data: {
                    lock_date: data.lockDate ? new Date(data.lockDate) : null,
                    auto_lock_day: data.autoLockDay,
                    override_pin: pinToStore
                }
            });
        } else {
            setting = await prisma.systemSetting.update({
                where: { id: setting.id },
                data: {
                    lock_date: data.lockDate ? new Date(data.lockDate) : null,
                    auto_lock_day: data.autoLockDay,
                    override_pin: pinToStore
                }
            });
        }
        return { success: true };
    },

    async verifyManagerPin(pin: string) {
        const setting = await prisma.systemSetting.findFirst();
        if (!setting || !setting.override_pin) {
            return {
                success: false,
                error: 'No Manager Override PIN has been set up in System Settings. Please configure it first under System Settings.'
            };
        }
        if (!verifyPinMatch(pin, setting.override_pin)) {
            return {
                success: false,
                error: 'Incorrect Manager Override PIN. Access denied.'
            };
        }
        return { success: true };
    },

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
            include: { reconciliations: { include: { journal_entry: true } } },
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
                matchedEntry: transaction.reconciliations?.[0]?.journal_entry || null
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
        const transaction = await prisma.bankTransaction.create({
            data: {
                bank_account_id: data.bankAccountId,
                transaction_date: new Date(data.date),
                description: data.description,
                reference_no: data.referenceNo || null,
                amount: data.amount
            }
        });
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

    // --- RECONCILIATION MATCHING FUNCTIONS ---
    async matchBankTransaction(bankTxId: string, journalEntryIds: string | string[], userId: string) {
        try {
            const ids = Array.isArray(journalEntryIds) ? journalEntryIds : [journalEntryIds];

            return await prisma.$transaction(async (tx) => {
                // Loop through and attach all selected ledger items to the single bank transaction
                for (const jId of ids) {
                    await tx.reconciliation.create({
                        data: {
                            bank_transaction_id: bankTxId,
                            journal_entry_id: jId,
                            matched_by: userId
                        }
                    });
                }
                await tx.bankTransaction.update({
                    where: { id: bankTxId },
                    data: { status: 'MATCHED' }
                });
                return { success: true };
            });
        } catch (error: any) {
            console.error("Match Error:", error);
            return { success: false, error: error.message };
        }
    },

    async unmatchBankTransaction(bankTxId: string) {
        try {
            return await prisma.$transaction(async (tx) => {
                await tx.reconciliation.deleteMany({
                    where: { bank_transaction_id: bankTxId }
                });
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
        let whereClause: any = { is_active: true }; // Only show active contacts in dropdowns
        if (typeFilter) {
            const types = typeFilter.split(',');
            whereClause.type = { in: types };
        }
        return await prisma.payee.findMany({ where: whereClause, orderBy: { name: 'asc' } });
    },

     async archivePayee(payeeId: string) {
        try {
            await prisma.payee.update({
                where: { id: payeeId },
                data: { is_active: false }
            });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async restorePayee(payeeId: string) {
        try {
            await prisma.payee.update({
                where: { id: payeeId },
                data: { is_active: true }
            });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async createPayee(name: string, type: string = 'PATIENT', tin?: string, email?: string, phone?: string, address?: string, hmoAffiliation?: string, hmoCardNo?: string, hmoExpiryDate?: string) {
        try {
            const newPayee = await prisma.payee.create({
                data: {
                    name,
                    type,
                    tin: tin || null,
                    email: email || null,
                    phone_number: phone || null,
                    address: address || null,
                    hmo_affiliation: hmoAffiliation || null,
                    hmo_card_no: hmoCardNo || null,
                    hmo_expiry_date: hmoExpiryDate ? new Date(hmoExpiryDate) : null
                }
            });
            return { success: true, payee: newPayee };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
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

    // 🔥 UPGRADED: Added Month-End Lock Security Check
    async createJournalEntry(data: JournalEntryInput) {
        const entryDate = new Date(data.date);

        // 1. Check Lock Date & PIN
        const setting = await prisma.systemSetting.findFirst();
        if (setting?.lock_date && entryDate <= setting.lock_date) {
            if (!verifyPinMatch(data.overridePin, setting.override_pin)) {
                throw new Error(`PERIOD LOCKED: You cannot post transactions on or before ${setting.lock_date.toISOString().split('T')[0]}. Invalid or missing Override PIN.`);
            }
        }

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
                date: entryDate,
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
                },
                attachments: data.attachments && data.attachments.length > 0 ? {
                    create: data.attachments.map((att) => ({
                        fileName: att.fileName || att.name || 'Attachment',
                        fileType: att.fileType || att.type || 'image/jpeg',
                        fileData: att.fileData || att.data || ''
                    }))
                } : undefined
            }
        });

        return { success: true, referenceNo: entry.reference_no, entryId: entry.id };
    },

    async updateJournalEntry(entryId: string, data: JournalEntryInput) {
        try {
            const setting = await prisma.systemSetting.findFirst();
            const entryDate = new Date(data.date);
            if (setting?.lock_date && entryDate <= setting.lock_date) {
                if (!verifyPinMatch(data.overridePin, setting.override_pin)) {
                    throw new Error(`PERIOD LOCKED: Transaction is from a locked period on or before ${setting.lock_date.toISOString().split('T')[0]}. Invalid or missing Override PIN.`);
                }
            }

            return await prisma.$transaction(async (tx) => {
                // Delete old lines
                await tx.journalLine.deleteMany({ where: { entry_id: entryId } });

                // Update attachments if provided
                if (data.attachments !== undefined) {
                    await tx.attachment.deleteMany({ where: { journalEntryId: entryId } });
                    if (data.attachments && data.attachments.length > 0) {
                        for (const att of data.attachments) {
                            const fileData = att.data || att.fileData;
                            if (fileData) {
                                await tx.attachment.create({
                                    data: {
                                        journalEntryId: entryId,
                                        fileName: att.name || att.fileName || 'Attachment',
                                        fileType: att.type || att.fileType || 'image/jpeg',
                                        fileData: fileData
                                    }
                                });
                            }
                        }
                    }
                }

                const updated = await tx.journalEntry.update({
                    where: { id: entryId },
                    data: {
                        date: new Date(data.date),
                        reference_no: data.referenceNo,
                        description: data.description,
                        user_id: data.userId,
                        payee_id: data.payeeId || null,
                        vat_type: data.vatType || 'EXEMPT',
                        lines: {
                            create: data.lines.map(l => ({
                                account_id: l.accountId,
                                debit: l.debit,
                                credit: l.credit
                            }))
                        }
                    }
                });

                return {
                    success: true,
                    referenceNo: updated.reference_no,
                    entryId: updated.id
                };
            });
        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    },

    async getAccountLedger(accountId: string) {
        const account = await prisma.account.findUnique({ where: { code: accountId }, include: { account_type: true } });
        if (!account) throw new Error("Account not found");

        const lines = await prisma.journalLine.findMany({
            where: { account_id: accountId, entry: { status: 'ACTIVE' } },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } }
        });

        let balance = 0;
        const normalBalance = account.account_type.normal_balance;
        const transactions = lines.map(line => {
            const debit = Number(line.debit); const credit = Number(line.credit);
            if (normalBalance === 'DEBIT') balance += (debit - credit); else balance += (credit - debit);
            return {
                id: line.id, entryId: line.entry.id, date: line.entry.date, referenceNo: line.entry.reference_no,
                description: cleanDescription(line.entry.description), rawDescription: line.entry.description, debit, credit, balance, status: line.entry.status, payee: line.entry.payee?.name || '-'
            };
        });
        return { accountCode: account.code, accountName: account.name, normalBalance, transactions, currentBalance: balance };
    },

    async getContactsWithBalances() {
        const payees = await prisma.payee.findMany({ orderBy: { name: 'asc' } });
        const lines = await prisma.journalLine.findMany({
            where: { account_id: { in: ['1200', '2010'] }, entry: { payee_id: { not: null }, status: 'ACTIVE' } },
            include: { entry: true }
        });

        // Also query entries for HMO / Corporate payees to find patients and claims
        const hmoEntries = await prisma.journalEntry.findMany({
            where: {
                status: 'ACTIVE',
                payee: { type: { in: ['HMO', 'CORPORATE'] } }
            },
            include: {
                lines: true
            },
            orderBy: { date: 'desc' }
        });

        const balances: Record<string, { receivable: number, payable: number }> = {};
        for (const line of lines) {
            const pId = line.entry.payee_id as string;
            if (!balances[pId]) balances[pId] = { receivable: 0, payable: 0 };

            if (line.account_id === '1200') balances[pId].receivable += (Number(line.debit) - Number(line.credit));
            if (line.account_id === '2010') balances[pId].payable += (Number(line.credit) - Number(line.debit));
        }

        return payees.map(p => {
            let affiliatedPatients: any[] = [];

            if (p.type === 'HMO' || p.type === 'CORPORATE') {
                const patientMap = new Map<string, any>();

                // 1. Registered patients whose hmo_affiliation matches this HMO's name
                const registered = payees.filter(pt =>
                    pt.type === 'PATIENT' &&
                    pt.hmo_affiliation &&
                    pt.hmo_affiliation.trim().toLowerCase() === p.name.trim().toLowerCase()
                );

                for (const reg of registered) {
                    const key = reg.name.toLowerCase().trim();
                    patientMap.set(key, {
                        id: reg.id,
                        name: reg.name,
                        cardNo: reg.hmo_card_no || '',
                        expiryDate: reg.hmo_expiry_date || null,
                        phone: reg.phone_number || '',
                        email: reg.email || '',
                        isRegistered: true,
                        loaNumbers: [],
                        transactionCount: 0,
                        totalBilled: 0,
                        lastVisit: null,
                        recentRefNo: null
                    });
                }

                // 2. Patients from journal entries billed to this HMO
                const entries = hmoEntries.filter(e => e.payee_id === p.id);
                for (const entry of entries) {
                    const pMatch = entry.description.match(/Patient:\s*([^|\n[\]]+)/i);
                    const pName = pMatch && pMatch[1] ? pMatch[1].trim() : '';
                    if (!pName || pName.toLowerCase() === 'walk-in' || pName.toLowerCase() === 'walk-in / cash' || pName.toLowerCase() === 'unknown patient') continue;

                    const key = pName.toLowerCase().trim();
                    const loaMatch = entry.description.match(/LOA:\s*([^)\n]+)/i);
                    const loa = loaMatch && loaMatch[1] ? loaMatch[1].trim() : '';

                    const amt = entry.lines
                        .filter(l => Number(l.credit) > 0 && l.account_id !== '2020')
                        .reduce((s, l) => s + Number(l.credit), 0) ||
                        entry.lines.filter(l => l.account_id === '1200').reduce((s, l) => s + Number(l.debit), 0);

                    if (!patientMap.has(key)) {
                        patientMap.set(key, {
                            id: null,
                            name: pName,
                            cardNo: loa,
                            expiryDate: null,
                            phone: '',
                            email: '',
                            isRegistered: false,
                            loaNumbers: loa ? [loa] : [],
                            transactionCount: 1,
                            totalBilled: amt,
                            lastVisit: entry.date,
                            recentRefNo: entry.reference_no
                        });
                    } else {
                        const existing = patientMap.get(key);
                        existing.transactionCount += 1;
                        existing.totalBilled += amt;
                        if (loa && !existing.loaNumbers.includes(loa)) {
                            existing.loaNumbers.push(loa);
                        }
                        if (!existing.cardNo && loa) {
                            existing.cardNo = loa;
                        }
                        if (!existing.lastVisit || new Date(entry.date) > new Date(existing.lastVisit)) {
                            existing.lastVisit = entry.date;
                            existing.recentRefNo = entry.reference_no;
                        }
                    }
                }

                affiliatedPatients = Array.from(patientMap.values());
            }

            return {
                id: p.id,
                name: p.name,
                type: p.type,
                email: p.email,
                phone: p.phone_number,
                tin: p.tin,
                address: p.address,
                hmo_affiliation: p.hmo_affiliation,
                hmo_card_no: p.hmo_card_no,
                hmo_expiry_date: p.hmo_expiry_date,
                status: p.is_active ? 'ACTIVE' : 'ARCHIVED',

                youOwe: balances[p.id]?.payable || 0,
                theyOwe: balances[p.id]?.receivable || 0,

                affiliatedPatients,
                affiliatedPatientCount: affiliatedPatients.length
            };
        });
    },

    async getFullLedgerReport(startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);

        const accounts = await prisma.account.findMany({ include: { account_type: true }, orderBy: { code: 'asc' } });

        const periodLines = await prisma.journalLine.findMany({
            where: { entry: { date: { gte: startDate, lte: endDate } } },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } }
        });

        const priorLines = await prisma.journalLine.findMany({ where: { entry: { date: { lt: startDate } } } });

        const report: any[] = [];

        for (const acc of accounts) {
            const normalBalance = acc.account_type.normal_balance;

            const accPriorLines = priorLines.filter(l => l.account_id === acc.code && (l as any).entry?.status === 'ACTIVE');
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
                    description: cleanDescription(l.entry.description), rawDescription: l.entry.description, payeeName: l.entry.payee?.name || '-',
                    debit: deb, credit: cred, balance: l.entry.status === 'ACTIVE' ? runningBalance : 0, status: l.entry.status
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
        const lastEntry = await prisma.journalEntry.findFirst({
            where: { reference_no: { startsWith: prefix } },
            orderBy: { created_at: 'desc' }
        });

        if (!lastEntry) return '001';

        const lastSeqNum = parseInt(lastEntry.reference_no.replace(prefix, ''), 10);
        if (isNaN(lastSeqNum) || lastSeqNum > 999999) return '001';

        return (lastSeqNum + 1).toString().padStart(3, '0');
    },

    async getPayoutHistory() {
        const entries = await prisma.journalEntry.findMany({
            where: {
                payee_id: { not: null },
                lines: { some: { account_id: '2050' } }
            },
            include: { payee: true, lines: true },
            orderBy: { date: 'desc' }
        });
        const history: any[] = [];
        entries.forEach(entry => {
            let gross = 0; let tax = 0; let net = 0;
            entry.lines.forEach(line => {
                if ((line.account_id === '2010' || line.account_id === '5040') && Number(line.debit) > 0) {
                    gross += Number(line.debit);
                }
                if (line.account_id === '2050' && Number(line.credit) > 0) {
                    tax += Number(line.credit);
                }
                if (['1010', '1020', '1030'].includes(line.account_id) && Number(line.credit) > 0) {
                    net += Number(line.credit);
                }
            });
            if (gross > 0 || tax > 0) {
                history.push({
                    id: entry.id,
                    date: entry.date,
                    referenceNo: entry.reference_no,
                    payee: entry.payee,
                    description: cleanDescription(entry.description),
                    rawDescription: entry.description,
                    gross: gross > 0 ? gross : (net + tax),
                    tax,
                    net: net > 0 ? net : (gross - tax)
                });
            }
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
                        description: cleanDescription(entry.description), rawDescription: entry.description, debit: Number(line.debit), credit: Number(line.credit), status: entry.status
                    });
                });
            });
            return recentLines.slice(0, 50);
        } catch (err) { return []; }
    },

    async getAllJournalEntries() {
        const entries = await prisma.journalEntry.findMany({
            // 🔥 FIXED: Sorts by the transaction date first, then by the exact time it was processed
            orderBy: [
                { date: 'desc' },
                { created_at: 'desc' }
            ],
            include: {
                payee: true,
                lines: { include: { account: true } },
                attachments: true
            }
        });

        return entries.map(entry => ({
            ...entry,
            lines: entry.lines.map(line => ({
                ...line,
                debit: Number(line.debit),
                credit: Number(line.credit)
            }))
        }));
    },

    async requestVoid(entryId: string, reason: string) {
        return await prisma.journalEntry.update({
            where: { id: entryId },
            data: { status: 'PENDING_VOID', void_reason: reason }
        });
    },

    async getPendingVoids() {
        const entries = await prisma.journalEntry.findMany({
            where: { status: 'PENDING_VOID' },
            include: { user: true, payee: true, lines: { include: { account: true } } },
            orderBy: { date: 'desc' }
        });

        // Decimal Fix for Electron IPC
        return entries.map(entry => ({
            ...entry,
            lines: entry.lines.map(line => ({
                ...line,
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

    // 🔥 UPGRADED: Added Month-End Lock Security Check
    async approveVoid(entryId: string, managerId: string, overridePin?: string) {
        // 🔥 Includes reconciliation to check if it's matched to a bank feed
        const original = await prisma.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true, reconciliation: true } });
        if (!original) throw new Error("Entry not found.");

        // 🔥 SAFEGUARD 1: RECONCILIATION LOCK
        if (original.reconciliation) {
            throw new Error("RECONCILIATION LOCK: This transaction is already matched to a Bank Statement. You must unmatch it in the Bank Reconciliation screen before you can void it.");
        }

        // 🔥 SAFEGUARD 2: PERIOD LOCK
        const setting = await prisma.systemSetting.findFirst();
        if (setting?.lock_date && original.date <= setting.lock_date) {
            if (!verifyPinMatch(overridePin, setting.override_pin)) {
                throw new Error(`PERIOD LOCKED: Transaction is from a locked period. Invalid or missing Override PIN.`);
            }
        }

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

    async getServiceItems() {
        const items = await prisma.serviceItem.findMany({
            where: { is_active: true },
            orderBy: [{ category: 'asc' }, { name: 'asc' }]
        });
        return items.map(item => ({ ...item, price: Number(item.price) }));
    },

    async getAllServiceItems() {
        const items = await prisma.serviceItem.findMany({
            orderBy: [{ category: 'asc' }, { name: 'asc' }]
        });
        return items.map(item => ({ ...item, price: Number(item.price) }));
    },

    async createServiceItem(data: { category: string, name: string, price: number }) {
        try {
            const item = await prisma.serviceItem.create({
                data: {
                    category: data.category,
                    name: data.name,
                    price: data.price,
                    is_active: true
                }
            });
            // Cast the Decimal price to a normal Number!
            return { success: true, data: { ...item, price: Number(item.price) } };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async updateServiceItem(id: number, data: { price?: number, is_active?: boolean, name?: string }) {
        try {
            const item = await prisma.serviceItem.update({
                where: { id },
                data: data
            });
            // Cast the Decimal price to a normal Number!
            return { success: true, data: { ...item, price: Number(item.price) } };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async getAccountTypes() {
        return await prisma.accountType.findMany({ orderBy: { name: 'asc' } });
    },

    async importPayees(payees: Array<{ name: string, type: string, tin?: string, email?: string, phone?: string, address?: string }>) {
        try {
            let count = 0;
            for (const p of payees) {
                // Prevent duplicate names
                const exists = await prisma.payee.findFirst({ where: { name: p.name } });
                if (!exists) {
                    await prisma.payee.create({
                        data: {
                            name: p.name,
                            type: p.type || 'PATIENT',
                            tin: p.tin || null,
                            email: p.email || null,
                            phone_number: p.phone || null,
                            address: p.address || null
                        }
                    });
                    count++;
                }
            }
            return { success: true, count };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async createAccount(data: { code: string, name: string, type_id: string, tax_category?: string }) {
        try {
            // Check if account code already exists to prevent crashes
            const existing = await prisma.account.findUnique({ where: { code: data.code } });
            if (existing) throw new Error(`Account code ${data.code} already exists.`);

            const account = await prisma.account.create({
                data: {
                    code: data.code,
                    name: data.name,
                    type_id: data.type_id,
                    tax_category: data.tax_category || null
                }
            });
            return { success: true, data: account };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async updateReferenceNumber(entryId: string, newReferenceNo: string) {
        try {
            await prisma.journalEntry.update({
                where: { id: entryId },
                data: { reference_no: newReferenceNo }
            });
            return { success: true };
        } catch (error: any) {
            console.error("Update Ref Error:", error);
            return { success: false, error: error.message };
        }
    },

    async getUserSalesHistory(userId: string) {
        try {
            console.log('[Transaction History] Loading for user:', userId);

            if (!userId) {
                console.warn('[Transaction History] Missing userId prop from frontend.');
                return [];
            }

            const entries = await prisma.journalEntry.findMany({
                where: {
                    NOT: [
                        { reference_no: { startsWith: 'JV' } },
                        { reference_no: { startsWith: 'ADJ' } },
                        { reference_no: { startsWith: 'PJ' } },
                        { reference_no: { startsWith: 'PY' } }
                    ]
                },
                orderBy: [
                    { date: 'desc' },
                    { created_at: 'desc' }
                ],
                take: 200,
                include: {
                    payee: true,
                    attachments: true,
                    lines: {
                        include: {
                            account: true
                        }
                    }
                }
            });

            console.log('[Transaction History] Found:', entries.length);

            return entries
                .filter((entry) => {
                    const ref = (entry.reference_no || '').trim().toUpperCase();
                    return !ref.startsWith('JV') && !ref.startsWith('ADJ') && !ref.startsWith('PJ') && !ref.startsWith('PY');
                })
                .map((entry) => {
                    const creditSum = entry.lines
                        .filter((l) => Number(l.credit) > 0)
                        .reduce((sum, line) => sum + Number(line.credit), 0);
                    const debitSum = entry.lines.reduce(
                        (sum, line) => sum + Number(line.debit),
                        0
                    );
                    const totalAmount = creditSum > 0 ? creditSum : debitSum;

                    let patientName = entry.payee?.name || 'Walk-in / Cash';
                    const patientMatch = entry.description.match(/Patient:\s*([^|\n[\]]+)/i);

                    if (patientMatch && patientMatch[1]) {
                        patientName = patientMatch[1].trim();
                    }

                    return {
                        id: entry.id,
                        date: entry.date,
                        createdAt: entry.created_at,
                        referenceNo: entry.reference_no,
                        description: cleanDescription(entry.description),
                        rawDescription: entry.description,
                        patientName,
                        payeeName: patientName,
                        payeeId: entry.payee_id,
                        billedEntity: entry.payee?.name || null,
                        totalAmount,
                        status: entry.status,
                        attachments: (entry.attachments || []).map((a) => ({
                            id: a.id,
                            name: a.fileName,
                            fileName: a.fileName,
                            type: a.fileType,
                            fileType: a.fileType,
                            data: a.fileData,
                            fileData: a.fileData
                        })),
                        lines: entry.lines.map((line) => ({
                            accountCode: line.account.code,
                            accountName: line.account.name,
                            debit: Number(line.debit),
                            credit: Number(line.credit)
                        }))
                    };
                });

        } catch (error) {
            console.error('[Transaction History] Failed:', error);
            throw error;
        }
    },

    async getCashierDisbursements(limit = 100) {
        try {
            const entries = await prisma.journalEntry.findMany({
                where: {
                    reference_no: { startsWith: 'PCV-' }
                },
                include: {
                    payee: true,
                    user: true,
                    lines: {
                        include: { account: true }
                    },
                    attachments: true
                },
                orderBy: [
                    { date: 'desc' },
                    { created_at: 'desc' }
                ],
                take: limit
            });

            return entries.map((entry) => {
                const expenseLine = entry.lines.find(l => l.account.code.startsWith('5') || l.account.code.startsWith('6')) || entry.lines[0];
                const cashLine = entry.lines.find(l => l.account.code.startsWith('10')) || entry.lines[1];
                const amount = expenseLine ? Number(expenseLine.debit) : entry.lines.reduce((s, l) => s + Number(l.debit), 0);

                const isAck = (entry.description || '').includes('[ACKNOWLEDGED');
                const ackMatch = (entry.description || '').match(/\[ACKNOWLEDGED[^\]]*\]/);
                const ackText = ackMatch ? ackMatch[0].replace(/^\[ACKNOWLEDGED:?\s*/i, '').replace(/\]$/, '') : '';

                return {
                    id: entry.id,
                    date: entry.date,
                    createdAt: entry.created_at,
                    referenceNo: entry.reference_no,
                    payeeName: entry.payee?.name || '',
                    payeeId: entry.payee_id,
                    description: cleanDescription(entry.description),
                    rawDescription: entry.description,
                    isAcknowledged: isAck,
                    acknowledgedInfo: ackText,
                    expenseAccountCode: expenseLine?.account.code || '',
                    expenseAccountName: expenseLine?.account.name || '',
                    sourceAccountCode: cashLine?.account.code || '1020',
                    sourceAccountName: cashLine?.account.name || 'Petty Cash Fund',
                    amount: amount,
                    cashierName: entry.user?.username || 'Cashier',
                    status: entry.status,
                    attachments: (entry.attachments || []).map((a) => ({
                        id: a.id,
                        name: a.fileName,
                        type: a.fileType,
                        data: a.fileData
                    }))
                };
            });
        } catch (error) {
            console.error('[Cashier Disbursements] Failed:', error);
            return [];
        }
    },

    async acknowledgeCashierDisbursement(entryId: string, acknowledgedBy: string = 'Accountant', note?: string) {
        try {
            const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
            if (!entry) throw new Error("Voucher not found");

            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const ackTag = ` [ACKNOWLEDGED by ${acknowledgedBy} on ${dateStr}${note ? `: ${note}` : ''}]`;

            let newDesc = entry.description || '';
            if (newDesc.includes('[ACKNOWLEDGED')) {
                newDesc = newDesc.replace(/\[ACKNOWLEDGED[^\]]*\]/g, ackTag.trim());
            } else {
                newDesc = `${newDesc}${ackTag}`;
            }

            await prisma.journalEntry.update({
                where: { id: entryId },
                data: { description: newDesc }
            });

            return { success: true };
        } catch (error: any) {
            console.error('[Acknowledge Disbursement] Failed:', error);
            return { success: false, error: error.message };
        }
    },

    async updateDisbursementAttachment(entryId: string, attachment: { name: string; type: string; data: string }) {
        try {
            if (!attachment?.data) throw new Error("Attachment data is required");
            // Delete old attachments
            await prisma.attachment.deleteMany({ where: { journalEntryId: entryId } });
            // Insert replacement attachment with full longtext
            const newAtt = await prisma.attachment.create({
                data: {
                    journalEntryId: entryId,
                    fileName: attachment.name || 'Receipt.jpg',
                    fileType: attachment.type || 'image/jpeg',
                    fileData: attachment.data
                }
            });
            return { success: true, attachmentId: newAtt.id };
        } catch (error: any) {
            console.error('[Update Disbursement Attachment] Failed:', error);
            return { success: false, error: error.message };
        }
    },

    async getRecentDisbursements(limit = 20) {
        try {
            const entries = await prisma.journalEntry.findMany({
                where: {
                    OR: [
                        { reference_no: { startsWith: 'CV-' } },
                        { reference_no: { startsWith: 'DV-' } },
                        { reference_no: { startsWith: 'REF-' } }
                    ]
                },
                include: {
                    payee: true,
                    lines: { include: { account: true } },
                    attachments: true
                },
                orderBy: [
                    { date: 'desc' },
                    { created_at: 'desc' }
                ],
                take: limit
            });
            return entries.map((entry) => {
                const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
                return {
                    id: entry.id,
                    date: entry.date,
                    referenceNo: entry.reference_no,
                    payeeName: entry.payee?.name,
                    amount: totalDebit,
                    description: cleanDescription(entry.description),
                    rawDescription: entry.description,
                    attachments: (entry.attachments || []).map((a) => ({
                        id: a.id,
                        name: a.fileName,
                        fileName: a.fileName,
                        type: a.fileType,
                        fileType: a.fileType,
                        data: a.fileData,
                        fileData: a.fileData
                    }))
                };
            });
        } catch (err) {
            console.error('[Recent Disbursements] Failed:', err);
            return [];
        }
    },

    async getHistoricalDisbursements(options: {
        startDate?: string;
        endDate?: string;
        voucherType?: 'ALL' | 'CDV' | 'PCV' | 'CV' | 'DV' | 'REF';
        sortOrder?: 'asc' | 'desc';
        limit?: number;
    } = {}) {
        try {
            const { startDate, endDate, voucherType = 'ALL', sortOrder = 'desc', limit = 500 } = options;

            // Prefix filters
            let prefixes: string[] = ['CV-', 'DV-', 'REF-', 'PCV-'];
            if (voucherType === 'CDV') prefixes = ['CV-', 'DV-', 'REF-'];
            else if (voucherType === 'PCV') prefixes = ['PCV-'];
            else if (voucherType === 'CV') prefixes = ['CV-'];
            else if (voucherType === 'DV') prefixes = ['DV-'];
            else if (voucherType === 'REF') prefixes = ['REF-'];

            const whereClause: any = {
                OR: prefixes.map(p => ({ reference_no: { startsWith: p } }))
            };

            if (startDate || endDate) {
                whereClause.date = {};
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    whereClause.date.gte = start;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    whereClause.date.lte = end;
                }
            }

            const entries = await prisma.journalEntry.findMany({
                where: whereClause,
                include: {
                    payee: true,
                    user: true,
                    lines: { include: { account: true } },
                    attachments: true
                },
                orderBy: [
                    { date: sortOrder },
                    { created_at: sortOrder }
                ],
                take: limit
            });

            return entries.map((entry) => {
                const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
                const creditLine = entry.lines.find(l => Number(l.credit) > 0);
                const isAck = (entry.description || '').includes('[ACKNOWLEDGED');
                const ackMatch = (entry.description || '').match(/\[ACKNOWLEDGED[^\]]*\]/);
                const ackText = ackMatch ? ackMatch[0].replace(/^\[ACKNOWLEDGED:?\s*/i, '').replace(/\]$/, '') : '';

                // Categorize voucher type
                let typeLabel = 'OTHER';
                if (entry.reference_no.startsWith('CV-')) typeLabel = 'CHECK';
                else if (entry.reference_no.startsWith('REF-')) typeLabel = 'TRANSFER';
                else if (entry.reference_no.startsWith('DV-')) typeLabel = 'CASH VOUCHER';
                else if (entry.reference_no.startsWith('PCV-')) typeLabel = 'PETTY CASH';

                return {
                    id: entry.id,
                    date: entry.date,
                    createdAt: entry.created_at,
                    referenceNo: entry.reference_no,
                    typeLabel,
                    payeeName: entry.payee?.name || '',
                    payeeId: entry.payee_id,
                    issuedBy: entry.user?.username || 'System',
                    amount: totalDebit,
                    sourceAccountCode: creditLine?.account?.code || '',
                    sourceAccountName: creditLine?.account?.name || '',
                    description: cleanDescription(entry.description),
                    rawDescription: entry.description,
                    status: entry.status,
                    isAcknowledged: isAck,
                    acknowledgedInfo: ackText,
                    lines: entry.lines.map(l => ({
                        accountCode: l.account?.code,
                        accountName: l.account?.name,
                        debit: Number(l.debit),
                        credit: Number(l.credit)
                    })),
                    attachments: (entry.attachments || []).map((a) => ({
                        id: a.id,
                        name: a.fileName,
                        type: a.fileType,
                        data: a.fileData
                    }))
                };
            });
        } catch (err) {
            console.error('[Historical Disbursements] Failed:', err);
            return [];
        }
    }
};