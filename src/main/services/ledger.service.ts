// src/main/services/ledger.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface JournalLineInput {
    accountId: string; // e.g., "1010" for Cash in Bank
    debit: number;
    credit: number;
}

export interface JournalEntryInput {
    date: Date;
    referenceNo: string;
    description: string;
    payeeId?: string;
    userId: string;
    lines: JournalLineInput[];
}

export class LedgerService {
    static async createJournalEntry(input: JournalEntryInput) {
        if (!input.lines || input.lines.length < 2) {
            throw new Error("Validation Error: A journal entry must contain at least 2 transaction lines.");
        }

        // 1. Calculate Debit and Credit Sums
        let totalDebits = 0;
        let totalCredits = 0;

        for (const line of input.lines) {
            if (line.debit < 0 || line.credit < 0) {
                throw new Error("Validation Error: Debit and Credit values cannot be negative.");
            }
            totalDebits += line.debit;
            totalCredits += line.credit;
        }

        // Convert to 2-decimal strings to avoid floating point errors (e.g. 10.0000000001)
        const debitsFormatted = totalDebits.toFixed(2);
        const creditsFormatted = totalCredits.toFixed(2);

        // 2. Strict Double-Entry Mathematical Constraint
        if (debitsFormatted !== creditsFormatted) {
            throw new Error(
                `Accounting Error: Total Debits (₱${debitsFormatted}) must precisely equal Total Credits (₱${creditsFormatted})
                to maintain ledger balance.`
            );
        }

        // 3. Database Write Transaction (ACID Complaint)
        return await prisma.$transaction(async (tx) => {
            // Create the main Journal Entry
            const entry = await tx.journalEntry.create({
                data: {
                    date: input.date,
                    reference_no: input.referenceNo,
                    description: input.description,
                    payee_id: input.payeeId || null,
                    user_id: input.userId,
                },
            });

            // Bulk create the corresponding Journal Lines
            const linesData = input.lines.map((line) => ({
                entry_id: entry.id,
                account_id: line.accountId,
                debit: line.debit,
                credit: line.credit,
            }));

            await tx.journalLine.createMany({
                data: linesData,
            });

            return {
                success: true,
                entryId: entry.id,
                referenceNo: entry.reference_no,
            };
        });
    }
    static async getAccounts() {
        return await prisma.account.findMany({
            include: { account_type: true },
            orderBy: { code: 'asc' }
        });
    }
}