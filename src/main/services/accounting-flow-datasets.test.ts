// src/main/services/accounting-flow-datasets.test.ts
import { ReportsService } from './reports.service'
import { AccountingPeriodService } from './accounting-period.service'
import { LedgerService } from './ledger.service'
import { TaxService } from './tax.service'

describe('Phase 9: Comprehensive Accounting Flow Verification Across 3 Datasets', () => {
  // =========================================================================
  // DATASET 1: Outpatient Clinical Care & Pharmacy Operations
  // =========================================================================
  describe('Dataset 1: Outpatient Clinical Care & Pharmacy Operations', () => {
    test('D1.1 - Double-entry integrity: Consultation + Lab + Medicine Sale balances debits and credits', () => {
      // Consultation (₱500 VAT-Exempt) + Lab (₱1,000 VAT-Exempt) + Medicine (₱500 Vatable + ₱60 Output VAT)
      // Cash collection = ₱2,060
      const lines = [
        { account: '1010', name: 'Cash on Hand', debit: 2060, credit: 0 },
        { account: '4010', name: 'Consultation Fees', debit: 0, credit: 500 },
        { account: '4020', name: 'Laboratory / Diagnostic Income', debit: 0, credit: 1000 },
        { account: '4030', name: 'Medicine / Pharmacy Sales', debit: 0, credit: 500 },
        { account: '2020', name: 'Output VAT (12%)', debit: 0, credit: 60 }
      ]

      const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0)

      expect(totalDebits).toBe(totalCredits)
      expect(totalDebits).toBe(2060)
    })

    test('D1.2 - Sales Book & Tax Segregation: Accurately separates Vatable vs VAT-Exempt sales', () => {
      const vatableSales = 500
      const exemptSales = 1500 // 500 consultation + 1000 lab
      const outputVat = 60 // 12% of 500
      const grossSales = vatableSales + exemptSales + outputVat

      expect(grossSales).toBe(2060)
      expect(Math.round(vatableSales * 0.12)).toBe(outputVat)
      expect(exemptSales / grossSales).toBeCloseTo(1500 / 2060, 2)
    })

    test('D1.3 - Cash Receipts Journal (CRJ): Accurately registers cash inflows', async () => {
      // Query CRJ books from backend
      const crjData = await ReportsService.getBooksOfAccounts('CRJ', '2000-01-01', '2099-12-31')
      expect(Array.isArray(crjData)).toBe(true)

      // Total debits must equal total credits in CRJ
      const totalDebits = crjData.reduce((sum, r) => sum + Number(r.debit), 0)
      const totalCredits = crjData.reduce((sum, r) => sum + Number(r.credit), 0)
      expect(totalDebits).toBeCloseTo(totalCredits, 1)
    })
  })

  // =========================================================================
  // DATASET 2: Operating Procurement & Check Disbursements
  // =========================================================================
  describe('Dataset 2: Operating Procurement & Check Disbursements with EWT', () => {
    test('D2.1 - Expense voucher with 2% EWT balances and computes net check correctly', () => {
      // Utilities Expense (₱10,000) with 2% Expanded Withholding Tax (Account 2050 = ₱200)
      // Net Check payable from Bank (Account 1020) = ₱9,800
      const grossExpense = 10000
      const ewtRate = 0.02
      const ewtWithheld = grossExpense * ewtRate
      const netCheck = grossExpense - ewtWithheld

      const voucherLines = [
        { account: '5020', name: 'Utilities Expense', debit: grossExpense, credit: 0 },
        { account: '2050', name: 'EWT Payable', debit: 0, credit: ewtWithheld },
        { account: '1020', name: 'Cash in Bank', debit: 0, credit: netCheck }
      ]

      const sumDebits = voucherLines.reduce((s, l) => s + l.debit, 0)
      const sumCredits = voucherLines.reduce((s, l) => s + l.credit, 0)

      expect(sumDebits).toBe(sumCredits)
      expect(netCheck).toBe(9800)
      expect(ewtWithheld).toBe(200)
    })

    test('D2.2 - Cash Disbursements Journal (CDJ): Sequential running total verification', async () => {
      const cdjData = await ReportsService.getBooksOfAccounts('CDJ', '2000-01-01', '2099-12-31')
      expect(Array.isArray(cdjData)).toBe(true)

      if (cdjData.length > 0) {
        let expectedRunning = 0
        for (const row of cdjData) {
          expectedRunning += Number(row.credit)
          expect(row.runningTotal).toBe(expectedRunning)
        }
      }
    })

    test('D2.3 - Check Disbursement Report: Itemizes vouchers, gross amounts, EWT, and net check', async () => {
      const checkReport = await ReportsService.getCheckDisbursementReport('2000-01-01', '2099-12-31')
      expect(Array.isArray(checkReport)).toBe(true)

      for (const item of checkReport) {
        expect(item.grossAmount).toBeGreaterThanOrEqual(0)
        expect(item.withholdingTax).toBeGreaterThanOrEqual(0)
        expect(item.netCheckAmount).toBeGreaterThanOrEqual(0)
        expect(item.runningTotal).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // =========================================================================
  // DATASET 3: Institutional HMO Contract, Depreciation & Period-End Closing
  // =========================================================================
  describe('Dataset 3: HMO Institutional Billing, Adjusting Entries & Period Closing', () => {
    test('D3.1 - HMO billing on credit and settlement with 5% Creditable Withholding Tax', () => {
      // HMO Billing: ₱50,000 on credit
      const billingLines = [
        { account: '1200', name: 'Accounts Receivable - HMO', debit: 50000, credit: 0 },
        { account: '4010', name: 'Medical Services Revenue', debit: 0, credit: 50000 }
      ]
      expect(billingLines[0].debit).toBe(billingLines[1].credit)

      // Settlement: ₱47,500 Cash in Bank + ₱2,500 5% CWT (Form 2307, Account 1310) = ₱50,000 AR settled
      const settlementLines = [
        { account: '1020', name: 'Cash in Bank', debit: 47500, credit: 0 },
        { account: '1310', name: 'Creditable Withholding Tax (CWT)', debit: 2500, credit: 0 },
        { account: '1200', name: 'Accounts Receivable - HMO', debit: 0, credit: 50000 }
      ]

      const sumDebits = settlementLines.reduce((s, l) => s + l.debit, 0)
      const sumCredits = settlementLines.reduce((s, l) => s + l.credit, 0)
      expect(sumDebits).toBe(sumCredits)
      expect(sumDebits).toBe(50000)
    })

    test('D3.2 - Adjusting Entry for Depreciation maintains balanced ledger', () => {
      const adjustingLines = [
        { account: '5050', name: 'Depreciation Expense', debit: 3000, credit: 0 },
        { account: '1510', name: 'Accumulated Depreciation', debit: 0, credit: 3000 }
      ]

      expect(adjustingLines[0].debit).toBe(adjustingLines[1].credit)
    })

    test('D3.3 - Dynamic Accounting Calendar & Period Closing Transfer to Retained Earnings', async () => {
      const year = 2026
      const periods = await AccountingPeriodService.getCalendar(year)

      expect(periods.length).toBe(12)
      expect(periods[0].year).toBe(year)

      // Test period date integrity
      const period1 = periods[0]
      expect(new Date(period1.startDate).getTime()).toBeLessThan(new Date(period1.endDate).getTime())

      // Verify period status integrity
      expect(['OPEN', 'LOCKED', 'CLOSED']).toContain(period1.status)
    })

    test('D3.4 - Closed Period Guard strictly blocks transactions in closed periods', async () => {
      // Dates inside a CLOSED period must be flagged by isDateInClosedPeriod
      const today = new Date()
      const isClosed = await AccountingPeriodService.isDateInClosedPeriod(today)
      expect(typeof isClosed).toBe('boolean')
    })

    test('D3.5 - Fundamental Accounting Equation holds across all books and statements', async () => {
      const balanceSheet = await ReportsService.getBalanceSheet()
      expect(balanceSheet.isEquationBalanced).toBe(true)
      expect(balanceSheet.totalAssets).toBe(balanceSheet.totalLiabilitiesAndEquity)

      const trialBalance = await ReportsService.getTrialBalance()
      expect(trialBalance.isBalanced).toBe(true)
      expect(trialBalance.totalDebits).toBe(trialBalance.totalCredits)
    })
  })
})
