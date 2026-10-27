/// <reference types="jest" />
// src/main/services/corrections-and-entries.test.ts
import { LedgerService } from './ledger.service'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcrypt'
import { AccountingPeriodService } from './accounting-period.service'

const prisma = new PrismaClient()

describe('Phase 10: Data-Driven Entry Validation & Corrections Across 3 Datasets', () => {
  let testDatasets: Record<string, any> = {}
  const dummyUserId = 'test-user-001'
  const dummyReconciledId = 'recon-entry-001'
  const dummyVoidTargetId = 'void-target-001'
  const dummyLeaseVoucherId = 'cv-lease-001'
  const dummyUnsettledHmoId = 'hmo-unsettled-001'

  beforeAll(async () => {
    // 1. Ensure Standard Account Types Exist
    const accountTypes = [
      { id: 'type-asset', name: 'Asset', normal_balance: 'DEBIT' },
      { id: 'type-liability', name: 'Liability', normal_balance: 'CREDIT' },
      { id: 'type-equity', name: 'Equity', normal_balance: 'CREDIT' },
      { id: 'type-revenue', name: 'Revenue', normal_balance: 'CREDIT' },
      { id: 'type-expense', name: 'Expense', normal_balance: 'DEBIT' }
    ]
    for (const at of accountTypes) {
      await prisma.accountType.upsert({
        where: { id: at.id },
        update: {},
        create: at as any
      })
    }

    // 2. Ensure Standard Chart of Accounts
    const standardAccounts = [
      { code: '1010', name: 'Cash on Hand', type_id: 'type-asset' },
      { code: '1020', name: 'Cash in Bank', type_id: 'type-asset' },
      { code: '1200', name: 'Accounts Receivable - HMO', type_id: 'type-asset' },
      { code: '1310', name: 'Creditable Withholding Tax (CWT)', type_id: 'type-asset' },
      { code: '1320', name: 'Input VAT', type_id: 'type-asset' },
      { code: '1500', name: 'Medical Equipment', type_id: 'type-asset' },
      { code: '1510', name: 'Accumulated Depreciation', type_id: 'type-asset' },
      { code: '2010', name: 'Accounts Payable', type_id: 'type-liability' },
      { code: '2020', name: 'Output VAT', type_id: 'type-liability' },
      { code: '2030', name: 'Accrued Expenses', type_id: 'type-liability' },
      { code: '2050', name: 'EWT Payable', type_id: 'type-liability' },
      { code: '3010', name: "Owner's Capital", type_id: 'type-equity' },
      { code: '3020', name: 'Retained Earnings', type_id: 'type-equity' },
      { code: '3999', name: 'Income Summary', type_id: 'type-equity' },
      { code: '4010', name: 'Medical Consultation Fees', type_id: 'type-revenue' },
      { code: '4020', name: 'Laboratory Diagnostic Income', type_id: 'type-revenue' },
      { code: '4030', name: 'Medicine Sales', type_id: 'type-revenue' },
      { code: '5010', name: 'Medical Supplies Expense', type_id: 'type-expense' },
      { code: '5020', name: 'Utilities Expense', type_id: 'type-expense' },
      { code: '5030', name: 'Rent Expense', type_id: 'type-expense' },
      { code: '5040', name: 'Sanitation and Waste Expense', type_id: 'type-expense' },
      { code: '5050', name: 'Depreciation Expense', type_id: 'type-expense' }
    ]
    for (const acc of standardAccounts) {
      await prisma.account.upsert({
        where: { code: acc.code },
        update: {},
        create: acc
      })
    }

    // 3. MOCK DATA SETUP: Satisfy Foreign Key Constraints
    await prisma.user.upsert({
      where: { id: dummyUserId },
      update: {},
      create: { id: dummyUserId, username: 'TestUser', password_hash: 'x', role: 'MANAGER' }
    })

    // Create active unreconciled entry for Scenario 3A (Positive Void)
    await prisma.journalEntry.upsert({
      where: { id: dummyVoidTargetId },
      update: { status: 'ACTIVE' },
      create: {
        id: dummyVoidTargetId,
        date: new Date(),
        reference_no: 'VOID-TARGET-001',
        description: 'Active Unreconciled Consultation for Void',
        user_id: dummyUserId,
        status: 'ACTIVE',
        void_reason: 'Patient cancellation',
        lines: {
          create: [
            { account_id: '1010', debit: 500, credit: 0 },
            { account_id: '4010', debit: 0, credit: 500 }
          ]
        }
      }
    })

    // Create lease check voucher for Scenario D2-3A (Full Reversal Void)
    await prisma.journalEntry.upsert({
      where: { id: dummyLeaseVoucherId },
      update: { status: 'ACTIVE' },
      create: {
        id: dummyLeaseVoucherId,
        date: new Date('2026-10-18'),
        reference_no: 'CV-2001',
        description: 'Clinic Office Space Lease (Metro Realty)',
        user_id: dummyUserId,
        status: 'ACTIVE',
        void_reason: 'Disputed lease amount',
        lines: {
          create: [
            { account_id: '5030', debit: 20000, credit: 0 },
            { account_id: '1320', debit: 2400, credit: 0 },
            { account_id: '2050', debit: 0, credit: 1000 },
            { account_id: '1020', debit: 0, credit: 21400 }
          ]
        }
      }
    })

    // Create unsettled HMO invoice for Scenario D3-3A (Authorized Void of Unsettled Claim)
    await prisma.journalEntry.upsert({
      where: { id: dummyUnsettledHmoId },
      update: { status: 'ACTIVE' },
      create: {
        id: dummyUnsettledHmoId,
        date: new Date('2026-10-22'),
        reference_no: 'INV-3003',
        description: 'Unsettled HMO Claim Package Invoice',
        user_id: dummyUserId,
        status: 'ACTIVE',
        void_reason: 'Erroneous claim submission',
        lines: {
          create: [
            { account_id: '1200', debit: 12000, credit: 0 },
            { account_id: '4010', debit: 0, credit: 12000 }
          ]
        }
      }
    })

    // Create dummy reconciled entry & bank transaction for Scenario 3B (Negative Void)
    await prisma.journalEntry.upsert({
      where: { id: dummyReconciledId },
      update: { status: 'ACTIVE' },
      create: {
        id: dummyReconciledId,
        date: new Date(),
        reference_no: 'VOID-D1-02',
        description: 'Reconciled Cash Collection Entry',
        user_id: dummyUserId,
        status: 'ACTIVE',
        lines: {
          create: [
            { account_id: '1010', debit: 500, credit: 0 },
            { account_id: '4010', debit: 0, credit: 500 }
          ]
        }
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
        description: 'Test Reconciled Transaction',
        amount: 1500
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

    // Setup Locked Period Data for Scenario 4 (Hashed PIN: '1234')
    const hashedPin = bcrypt.hashSync('1234', 10)
    await prisma.systemSetting.updateMany({
      data: { lock_date: new Date('2026-09-30'), override_pin: hashedPin }
    })

    jest
      .spyOn(AccountingPeriodService, 'isDateInClosedPeriod')
      .mockImplementation(async () => false)

    // 4. Read and Parse the CSV dataset file dynamically
    const csvPath = path.join(__dirname, 'test-datasets.csv')
    const csvData = fs.readFileSync(csvPath, 'utf8')
    const lines = csvData.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const headerCols = lines[0].split(',').map((h) => h.trim())

    const getCol = (cols: string[], name: string) => {
      const idx = headerCols.indexOf(name)
      return idx >= 0 ? cols[idx]?.trim() : ''
    }

    const rows = lines.slice(1)
    rows.forEach((row) => {
      const cols = row.split(',')
      const scenarioId = getCol(cols, 'Scenario_ID')
      const datasetId = getCol(cols, 'Dataset_ID')
      const testType = getCol(cols, 'Test_Type')
      const date = getCol(cols, 'Date')
      const refNo = getCol(cols, 'Reference_No')
      const desc = getCol(cols, 'Description')
      const accountId = getCol(cols, 'Account_ID')
      const debit = getCol(cols, 'Debit')
      const credit = getCol(cols, 'Credit')
      const pin = getCol(cols, 'Override_PIN')
      const expectedError = getCol(cols, 'Expected_Error')

      if (!testDatasets[scenarioId]) {
        testDatasets[scenarioId] = {
          scenarioId,
          datasetId,
          testType,
          expectedError,
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
        accountId,
        debit: Number(debit),
        credit: Number(credit)
      })
    })
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await prisma.reconciliation.deleteMany({ where: { journal_entry_id: dummyReconciledId } })
    await prisma.bankTransaction.deleteMany({ where: { description: 'Test Reconciled Transaction' } })
    await prisma.journalLine.deleteMany({
      where: {
        entry_id: {
          in: [dummyReconciledId, dummyVoidTargetId, dummyLeaseVoucherId, dummyUnsettledHmoId]
        }
      }
    })
    await prisma.journalEntry.deleteMany({
      where: {
        id: {
          in: [dummyReconciledId, dummyVoidTargetId, dummyLeaseVoucherId, dummyUnsettledHmoId]
        }
      }
    })
    await prisma.journalEntry.deleteMany({
      where: {
        reference_no: {
          in: ['RVS-VOID-TARGET-001', 'RVS-CV-2001', 'RVS-INV-3003']
        }
      }
    })
  })

  /**
   * @test Scenario 1A [POSITIVE]: Accepts perfectly balanced transaction (Debits = Credits)
   * FEATURE: Transaction Entry Validation
   * WHAT: Double-entry debit/credit balance verification
   * WHY: Enforce fundamental accounting rule that total debits must equal total credits
   * TYPE: HAPPY PATH (Positive)
   */
  it('Scenario 1A [POSITIVE]: Accepts perfectly balanced transaction (Debits = Credits)', async () => {
    const result = await LedgerService.createJournalEntry(testDatasets['1A'].payload)
    expect(result.success).toBe(true)
  })

  /**
   * @test Scenario 1B [NEGATIVE]: Rejects unbalanced transaction (Missing Credit)
   * FEATURE: Transaction Entry Validation
   * WHAT: Double-entry validation: Rejection of unbalanced journal entries
   * WHY: Prevent ledger corruption and mathematically inconsistent postings
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 1B [NEGATIVE]: Rejects unbalanced transaction (Missing Credit)', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['1B'].payload)).rejects.toThrow(
      new RegExp(testDatasets['1B'].expectedError)
    )
  })

  /**
   * @test Scenario 1C [NEGATIVE]: Rejects zero-amount line entries
   * FEATURE: Transaction Entry Validation
   * WHAT: Zero-amount line rejection
   * WHY: Enforce that journal entries must carry actual monetary value
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 1C [NEGATIVE]: Rejects zero-amount line entries', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['1C'].payload)).rejects.toThrow(
      'Validation Error: Journal entry must be balanced'
    )
  })

  /**
   * @test Scenario 1D [NEGATIVE]: Rejects entries with both debit and credit on the same line
   * FEATURE: Transaction Entry Validation
   * WHAT: Single-column integrity enforcement per line
   * WHY: Enforce accounting rule that a single line cannot have both Debit and Credit amounts
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 1D [NEGATIVE]: Rejects entries with both debit and credit on the same line', async () => {
    const invalidPayload = {
      date: new Date(),
      referenceNo: 'ERR-BOTH-01',
      description: 'Single line with both debit and credit',
      userId: dummyUserId,
      lines: [
        { accountId: '1010', debit: 500, credit: 500 },
        { accountId: '4010', debit: 0, credit: 0 }
      ]
    }
    await expect(LedgerService.createJournalEntry(invalidPayload)).rejects.toThrow(
      'Validation Error: A single journal line cannot have both Debit and Credit amounts'
    )
  })

  /**
   * @test Scenario 2A [POSITIVE]: Accepts valid adjusting entry
   * FEATURE: Adjusting Journal Entries
   * WHAT: Adjusting entry acceptance for accruals, prepayments, and reclassifications
   * WHY: Enable legitimate period-end adjusting entries to reflect accurate financial positions
   * TYPE: HAPPY PATH (Positive)
   */
  it('Scenario 2A [POSITIVE]: Accepts valid adjusting entry', async () => {
    const result = await LedgerService.createJournalEntry(testDatasets['2A'].payload)
    expect(result.success).toBe(true)
  })

  /**
   * @test Scenario 2B [NEGATIVE]: Rejects entries containing negative values
   * FEATURE: Adjusting Journal Entries
   * WHAT: Input validation: Rejection of negative debit/credit amounts
   * WHY: Ensure accounting entries use positive magnitudes with appropriate debit/credit columns
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 2B [NEGATIVE]: Rejects entries containing negative values', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['2B'].payload)).rejects.toThrow(
      new RegExp(testDatasets['2B'].expectedError)
    )
  })

  /**
   * @test Scenario 3A [POSITIVE]: Accepts authorized void of an active unreconciled entry
   * FEATURE: Void Transaction Approvals
   * WHAT: Authorized void execution and automatic reversal journal entry generation
   * WHY: Allow manager-approved voiding of erroneous transactions while preserving audit trail
   * TYPE: HAPPY PATH (Positive)
   */
  it('Scenario 3A [POSITIVE]: Accepts authorized void of an active unreconciled entry', async () => {
    const result = await LedgerService.approveVoid(dummyVoidTargetId, dummyUserId)
    expect(result.success).toBe(true)

    // Verify original entry marked VOIDED
    const updated = await prisma.journalEntry.findUnique({ where: { id: dummyVoidTargetId } })
    expect(updated?.status).toBe('VOIDED')

    // Verify reversal entry created
    const reversal = await prisma.journalEntry.findFirst({
      where: { reference_no: 'RVS-VOID-TARGET-001' }
    })
    expect(reversal).toBeDefined()
    expect(reversal?.status).toBe('ACTIVE')
  })

  /**
   * @test Scenario 3B [NEGATIVE]: Blocks voiding of an already bank-reconciled entry
   * FEATURE: Void Transaction Approvals
   * WHAT: Bank reconciliation lock: Prevention of voiding cleared/reconciled entries
   * WHY: Protect reconciled bank statements from post-reconciliation alteration
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 3B [NEGATIVE]: Blocks voiding of an already bank-reconciled entry', async () => {
    await expect(LedgerService.approveVoid(dummyReconciledId, dummyUserId)).rejects.toThrow(
      'RECONCILIATION LOCK'
    )
  })

  /**
   * @test Scenario 4A [NEGATIVE]: Blocks entry in a closed period without a PIN
   * FEATURE: Accounting Period Cutoff
   * WHAT: Period cutoff enforcement: Rejects transaction posting in closed fiscal periods
   * WHY: Enforce financial closing finality and prevent unauthorized retrospective changes
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 4A [NEGATIVE]: Blocks entry in a closed period without a PIN', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['4A'].payload)).rejects.toThrow(
      'PERIOD LOCKED'
    )
  })

  /**
   * @test Scenario 4B [NEGATIVE]: Blocks entry in a closed period with invalid Manager PIN
   * FEATURE: Accounting Period Cutoff
   * WHAT: Rejects unauthorized override attempt using incorrect PIN
   * WHY: Enforce dual-control and security against unauthorized period overrides
   * TYPE: NON-HAPPY PATH (Negative / Edge Case)
   */
  it('Scenario 4B [NEGATIVE]: Blocks entry in a closed period with invalid Manager PIN', async () => {
    await expect(LedgerService.createJournalEntry(testDatasets['4B'].payload)).rejects.toThrow(
      'PERIOD LOCKED'
    )
  })

  /**
   * @test Scenario 4C [POSITIVE]: Allows entry in closed period with valid Manager Override PIN
   * FEATURE: Accounting Period Cutoff
   * WHAT: Manager override: Permits authorized posting to locked period with valid PIN
   * WHY: Provide dual-control emergency entry capability for legitimate audit adjustments
   * TYPE: HAPPY PATH (Positive)
   */
  it('Scenario 4C [POSITIVE]: Allows entry in closed period with valid Manager Override PIN', async () => {
    const result = await LedgerService.createJournalEntry(testDatasets['4C'].payload)
    expect(result.success).toBe(true)
  })

  // =========================================================================
  // DATASET 2 & 3 CORRECTION SUITE VERIFICATION
  // =========================================================================
  describe('Corrections across Dataset 2 (Operating Procurement) & Dataset 3 (HMO Institutional)', () => {
    /**
     * @test D2-1B: Rejects unbalanced procurement voucher
     * FEATURE: Dataset 2 Procurement Validation
     * WHAT: Double-entry validation: Rejects unbalanced check voucher
     * WHY: Ensure operating expense disbursements remain strictly balanced
     * TYPE: NON-HAPPY PATH (Negative / Edge Case)
     */
    it('D2-1B: Rejects unbalanced procurement voucher', async () => {
      await expect(LedgerService.createJournalEntry(testDatasets['D2-1B'].payload)).rejects.toThrow(
        new RegExp(testDatasets['D2-1B'].expectedError)
      )
    })

    /**
     * @test D2-2B: Rejects negative value utility adjustment
     * FEATURE: Dataset 2 Procurement Validation
     * WHAT: Input validation: Rejects negative utility adjustment amounts
     * WHY: Prevent negative numbers from corrupting accounts payable ledgers
     * TYPE: NON-HAPPY PATH (Negative / Edge Case)
     */
    it('D2-2B: Rejects negative value utility adjustment', async () => {
      await expect(LedgerService.createJournalEntry(testDatasets['D2-2B'].payload)).rejects.toThrow(
        new RegExp(testDatasets['D2-2B'].expectedError)
      )
    })

    /**
     * @test D2-3A [POSITIVE]: Full reversal of check voucher clearing EWT and Input VAT
     * FEATURE: Dataset 2 Procurement Reversals
     * WHAT: Full 4-line reversal voucher verification
     * WHY: Ensure no hanging EWT liability or Input VAT asset when a voucher is voided
     * TYPE: HAPPY PATH (Positive)
     */
    it('D2-3A [POSITIVE]: Full reversal of check voucher clearing EWT and Input VAT', async () => {
      const result = await LedgerService.approveVoid(dummyLeaseVoucherId, dummyUserId)
      expect(result.success).toBe(true)

      const reversal = await prisma.journalEntry.findFirst({
        where: { reference_no: 'RVS-CV-2001' },
        include: { lines: true }
      })
      expect(reversal).toBeDefined()
      expect(reversal?.lines.length).toBe(4)

      // Verify EWT debit 1000 and Input VAT credit 2400 in reversal
      const ewtLine = reversal?.lines.find((l) => l.account_id === '2050')
      const vatLine = reversal?.lines.find((l) => l.account_id === '1320')
      expect(Number(ewtLine?.debit)).toBe(1000)
      expect(Number(vatLine?.credit)).toBe(2400)
    })

    /**
     * @test D3-1B: Rejects unbalanced institutional HMO invoice
     * FEATURE: Dataset 3 HMO Institutional Validation
     * WHAT: Double-entry validation: Rejects unbalanced HMO receivables billing
     * WHY: Ensure medical receivables reconcile to reported service revenue
     * TYPE: NON-HAPPY PATH (Negative / Edge Case)
     */
    it('D3-1B: Rejects unbalanced institutional HMO invoice', async () => {
      await expect(LedgerService.createJournalEntry(testDatasets['D3-1B'].payload)).rejects.toThrow(
        new RegExp(testDatasets['D3-1B'].expectedError)
      )
    })

    /**
     * @test D3-2B: Rejects negative value depreciation adjustment
     * FEATURE: Dataset 3 HMO Institutional Validation
     * WHAT: Input validation: Rejects negative asset depreciation entries
     * WHY: Maintain contra-asset account integrity per GAAP/PFRS depreciation rules
     * TYPE: NON-HAPPY PATH (Negative / Edge Case)
     */
    it('D3-2B: Rejects negative value depreciation adjustment', async () => {
      await expect(LedgerService.createJournalEntry(testDatasets['D3-2B'].payload)).rejects.toThrow(
        new RegExp(testDatasets['D3-2B'].expectedError)
      )
    })

    /**
     * @test D3-3A [POSITIVE]: Accepts authorized void of an unsettled HMO claim invoice
     * FEATURE: Dataset 3 HMO Claim Void
     * WHAT: Authorized void of unpaid receivable invoice
     * WHY: Allow cancellation of erroneous institutional claims before HMO settlement
     * TYPE: HAPPY PATH (Positive)
     */
    it('D3-3A [POSITIVE]: Accepts authorized void of an unsettled HMO claim invoice', async () => {
      const result = await LedgerService.approveVoid(dummyUnsettledHmoId, dummyUserId)
      expect(result.success).toBe(true)

      const reversal = await prisma.journalEntry.findFirst({
        where: { reference_no: 'RVS-INV-3003' },
        include: { lines: true }
      })
      expect(reversal).toBeDefined()
      expect(reversal?.lines.length).toBe(2)
      const arLine = reversal?.lines.find((l) => l.account_id === '1200')
      expect(Number(arLine?.credit)).toBe(12000)
    })
  })
})
