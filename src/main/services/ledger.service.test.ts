// src/main/services/ledger.service.test.ts
import { LedgerService, JournalEntryInput } from './ledger.service'
import { AccountingPeriodService } from './accounting-period.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Double-Entry Ledger Engine', () => {
  let accountantUserId: string

  beforeAll(async () => {
    jest.spyOn(AccountingPeriodService, 'isDateInClosedPeriod').mockResolvedValue(false)
    // Retrieve the test accountant user we seeded earlier
    const user = await prisma.user.findFirst({
      where: { username: 'accountant' }
    })
    accountantUserId = user?.id || 'test-user-id'
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  test('✅ Should successfully commit a balanced journal entry', async () => {
    const balancedInput: JournalEntryInput = {
      date: new Date(),
      referenceNo: 'OR-0001',
      description: 'Patient consultation cash payment received',
      userId: accountantUserId,
      lines: [
        { accountId: '1010', debit: 500.0, credit: 0.0 }, // Cash in Bank (Asset Increase)
        { accountId: '4010', debit: 0.0, credit: 500.0 } // Service Revenue (Revenue Increase)
      ]
    }

    const result = await LedgerService.createJournalEntry(balancedInput)
    expect(result.success).toBe(true)
    expect(result.referenceNo).toBe('OR-0001')

    // Clean up the test database entry
    await prisma.journalEntry.delete({ where: { id: result.entryId } })
  })

  test('❌ Should reject entries with negative values', async () => {
    const negativeInput: JournalEntryInput = {
      date: new Date(),
      referenceNo: 'OR-0003',
      description: 'Fraudulent or accidental negative entry',
      userId: accountantUserId,
      lines: [
        { accountId: '1010', debit: -100.0, credit: 0.0 },
        { accountId: '4010', debit: 0.0, credit: -100.0 }
      ]
    }

    await expect(LedgerService.createJournalEntry(negativeInput)).rejects.toThrow(
      'Validation Error: Debit and Credit values cannot be negative'
    )
  })

  test('✅ Should retrieve void history with approved void records', async () => {
    const history = await LedgerService.getVoidHistory()
    expect(Array.isArray(history)).toBe(true)
    if (history.length > 0) {
      const record = history[0]
      expect(record).toHaveProperty('id')
      expect(record).toHaveProperty('reference_no')
      expect(record).toHaveProperty('status')
      expect(record).toHaveProperty('approver')
      expect(record).toHaveProperty('decided_at')
    }
  })
})
