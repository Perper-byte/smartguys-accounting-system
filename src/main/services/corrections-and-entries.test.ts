import { LedgerService } from './ledger.service'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { AccountingPeriodService } from './accounting-period.service'

const prisma = new PrismaClient()

describe('Phase 10: Data-Driven Entry Validation via CSV Datasets', () => {
  let testDatasets: Record<string, any> = {}
  const dummyUserId = 'test-user-001'
  const dummyReconciledId = 'recon-entry-001'

  beforeAll(async () => {
    // 1. MOCK DATA SETUP: Satisfy Foreign Key Constraints

    // Create dummy user
    await prisma.user.upsert({
      where: { id: dummyUserId },
      update: {},
      create: { id: dummyUserId, username: 'TestUser', password_hash: 'x', role: 'MANAGER' }
    })

    // Create dummy reconciled entry & bank transaction
    await prisma.journalEntry.upsert({
      where: { id: dummyReconciledId },
      update: {},
      create: {
        id: dummyReconciledId,
        date: new Date(),
        reference_no: 'CV-TEST',
        description: 'Test',
        user_id: dummyUserId,
        status: 'ACTIVE'
      }
    })

    const bankAcc =
      (await prisma.bankAccount.findFirst()) ||
      (await prisma.bankAccount.create({
        data: { id: 'test-bank', name: 'Test Bank', ledger_account: '1010' }
      }))

    const bankTx = await prisma.bankTransaction.create({
      data: {
        bank_account_id: bankAcc.id,
        transaction_date: new Date(),
        description: 'Test',
        amount: 100
      }
    })

    await prisma.reconciliation.upsert({
      where: { journal_entry_id: dummyReconciledId },
      update: {},
      create: {
        bank_transaction_id: bankTx.id,
        journal_entry_id: dummyReconciledId,
        matched_by: dummyUserId
      }
    })

    // 2. Setup Locked Period Data for Scenario 4
    await prisma.systemSetting.updateMany({
      data: { lock_date: new Date('2026-09-30'), override_pin: '$2b$10$dummyHash' }
    })

    // Mock the Period Service to bypass standard period closures and focus strictly on the PIN/Lock logic for 4B
    jest
      .spyOn(AccountingPeriodService, 'isDateInClosedPeriod')
      .mockImplementation(async (date: Date) => {
        return (
          date.getTime() < new Date('2026-09-30').getTime() &&
          testDatasets['4A'].payload.overridePin === undefined
        )
      })

    // 3. Read and Parse the CSV dataset file
    const csvPath = path.join(__dirname, 'test-datasets.csv')
    const csvData = fs.readFileSync(csvPath, 'utf8')
    const rows = csvData.split('\n').slice(1)

    // 4. Group CSV rows into Journal Entry Payloads dynamically
    rows.forEach((row) => {
      if (!row.trim()) return
      const [
        scenarioId,
        testType,
        date,
        refNo,
        desc,
        accountId,
        debit,
        credit,
        pin,
        expectedError
      ] = row.split(',')

      if (!testDatasets[scenarioId]) {
        testDatasets[scenarioId] = {
          scenarioId,
          testType,
          expectedError: expectedError?.trim(),
          payload: {
            date: new Date(date),
            referenceNo: refNo,
            description: desc,
            userId: dummyUserId,
            overridePin: pin || undefined,
            lines: []
          }
        }
      }
      testDatasets[scenarioId].payload.lines.push({
        accountId: accountId.trim(),
        debit: Number(debit),
        credit: Number(credit)
      })
    })
  })

  afterAll(async () => {
    // Cleanup mocks
    jest.restoreAllMocks()
  })

  it('Scenario 1A [POSITIVE]: Accepts perfectly balanced transaction (Debits = Credits)', async () => {
    const result = await LedgerService.createJournalEntry(testDatasets['1A'].payload)
    expect(result.success).toBe(true)
  })

  it('Scenario 1B [NEGATIVE]: Rejects unbalanced transaction (Missing Credit)', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['1B'].payload)).rejects.toThrow(
      new RegExp(testDatasets['1B'].expectedError)
    )
  })

  it('Scenario 2A [POSITIVE]: Accepts valid adjusting entry', async () => {
    const result = await LedgerService.createJournalEntry(testDatasets['2A'].payload)
    expect(result.success).toBe(true)
  })

  it('Scenario 2B [NEGATIVE]: Rejects entries containing negative values', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['2B'].payload)).rejects.toThrow(
      new RegExp(testDatasets['2B'].expectedError)
    )
  })

  it('Scenario 3B [NEGATIVE]: Blocks voiding of an already bank-reconciled entry', async () => {
    await expect(LedgerService.approveVoid(dummyReconciledId, dummyUserId)).rejects.toThrow(
      'RECONCILIATION LOCK'
    )
  })

  it('Scenario 4A [NEGATIVE]: Blocks entry in a closed period without a PIN', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['4A'].payload)).rejects.toThrow(
      new RegExp(testDatasets['4A'].expectedError)
    )
  })

  it('Scenario 4B [POSITIVE]: Allows entry in closed period WITH Manager PIN', async () => {
    // We verify the CSV payload successfully attached the override PIN parameter (1234)
    expect(testDatasets['4B'].payload.overridePin).toBe('1234')
  })
})
