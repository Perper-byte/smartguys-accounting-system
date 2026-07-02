// src/main/services/ledger.service.ts
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
    static async createJournalEntry(input: JournalEntryInput) {
        if (!input.lines || input.lines.length < 2) {
            throw new Error("Validation Error: A journal entry must contain at least 2 transaction lines.");
        }

        let totalDebits = 0;
        let totalCredits = 0;

        for (const line of input.lines) {
            if (line.debit < 0 || line.credit < 0) {
                throw new Error("Validation Error: Debit and Credit values cannot be negative.");
            }
            totalDebits += line.debit;
            totalCredits += line.credit;
        }

        const debitsFormatted = totalDebits.toFixed(2);
        const creditsFormatted = totalCredits.toFixed(2);

        if (debitsFormatted !== creditsFormatted) {
            throw new Error(
                `Accounting Error: Total Debits (₱${debitsFormatted}) must precisely equal Total Credits (₱${creditsFormatted}) to maintain ledger balance.`
            );
        }

        return await prisma.$transaction(async (tx) => {
            const entry = await tx.journalEntry.create({
                data: {
                    date: input.date,
                    reference_no: input.referenceNo,
                    description: input.description,
                    vat_type: input.vatType, 
                    payee_id: input.payeeId || null, 
                    user_id: input.userId,
                },
            });

            const linesData = input.lines.map((line) => ({
                entry_id: entry.id,
                account_id: line.accountId,
                debit: line.debit,
                credit: line.credit,
            }));

            await tx.journalLine.createMany({ data: linesData });

            return { success: true, entryId: entry.id, referenceNo: entry.reference_no };
        });
    }

    static async getAccounts() {
        return await prisma.account.findMany({
            include: { account_type: true },
            orderBy: { code: 'asc' }
        });
    }

    static async getPayees() {
        return await prisma.payee.findMany({ orderBy: { name: 'asc' } });
    }

    static async createPayee(name: string) {
        try {
            const newPayee = await prisma.payee.create({ data: { name: name } });
            return { success: true, payee: newPayee };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // NEW BALANCE FUNCTION
    static async getPayeeBalance(payeeId: string) {
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: { payee_id: payeeId },
                account_id: { in: ['1200', '2010'] } 
            }
        });

        let arBalance = 0; 
        let apBalance = 0; 

        for (const line of lines) {
            if (line.account_id === '1200') {
                arBalance += Number(line.debit) - Number(line.credit);
            } else if (line.account_id === '2010') {
                apBalance += Number(line.credit) - Number(line.debit);
            }
        }

        return { receivable: arBalance, payable: apBalance };
    }

    static async getAccountLedger(accountId: string) {
        const account = await prisma.account.findUnique({
            where: { code: accountId },
            include: { account_type: true }
        });

        if (!account) throw new Error("Account not found");

        const normalBalance = account.account_type.normal_balance; 

        const lines = await prisma.journalLine.findMany({
            where: { account_id: accountId },
            include: { entry: { include: { payee: true } } },
            orderBy: { entry: { date: 'asc' } } 
        });

        let runningBalance = 0;

        const formattedLines = lines.map(line => {
            const debit = Number(line.debit);
            const credit = Number(line.credit);

            if (normalBalance === 'DEBIT') {
                runningBalance = runningBalance + debit - credit;
            } else {
                runningBalance = runningBalance + credit - debit;
            }

            return {
                id: line.id,
                date: line.entry.date,
                referenceNo: line.entry.reference_no,
                description: line.entry.description,
                vatType: line.entry.vat_type, 
                payee: line.entry.payee?.name || '-', 
                debit: debit,
                credit: credit,
                balance: runningBalance
            };
        });

        return {
            accountCode: account.code,
            accountName: account.name,
            normalBalance: normalBalance,
            transactions: formattedLines
        };
    }
}