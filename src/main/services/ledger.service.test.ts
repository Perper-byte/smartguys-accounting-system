// src/main/services/ledger.service.test.ts
import { LedgerService, JournalEntryInput } from "./ledger.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe('Sprint 2 - Week 2: Double-Entry Ledger Engine Validation', () => {
    let testUserId: string;

    beforeAll(async () => {
        // Retrieve the test accountant user we seeded earlier
        const user = await prisma.user.findFirst({
            where: { username: 'accountant' },
        });
        testUserId = user!.id;
    });

    test('✅ SUCCESS: Commit a balanced multi-line entry', async () => {
      const input: JournalEntryInput = {
        date: new Date(),
        referenceNo: 'TEST-0001',
        description: 'Balanced Entry',
        userId: testUserId,
        lines: [
            { accountId: '1010', debit: 1000, credit: 0 }, // Cash in Bank (Asset Increase)
            { accountId: '4010', debit: 0, credit: 1000 }, // Service Revenue (Revenue Increase)
        ],
      };

      const result = await LedgerService.createJournalEntry(input);
      expect(result.success).toBe(true);

      // Clean up the test database entry
      await prisma.journalEntry.delete({ where: { id: result.entryId } });
    });

    test('❌ FAIL: Reject an imbalanced entry (Equation Violation)', async () => {
      const input: JournalEntryInput = {
        date: new Date(),
        referenceNo: 'TEST-002',
        description: 'Imbalanced Entry',
        userId: testUserId,
        lines: [
            { accountId: '1010', debit: 1000, credit: 0 }, 
            { accountId: '4010', debit: 0, credit: 950 }, // Missing 50 pesos
        ],
      };

      await expect(LedgerService.createJournalEntry(input)).rejects.toThrow(/Double-Entry Violation/);
    });

    test('❌ FAIL: Reject entry with only one line', async () => {
      const input: JournalEntryInput = {
        date: new Date(),
        referenceNo: 'TEST-003',
        description: 'Single Line',
        userId: testUserId,
        lines: [{ accountId: '1010', debit: 1000, credit: 0}],
      };

      await expect(LedgerService.createJournalEntry(input)).rejects.toThrow(/requires at least two accounts/);
    });
});