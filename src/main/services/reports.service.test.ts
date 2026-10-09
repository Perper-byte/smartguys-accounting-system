// src/main/services/reports.service.test.ts
import { ReportsService } from './reports.service'

describe('Sprint 3 - Week 1: Financial Reporting Engine', () => {
  test('📊 Trial Balance: Debits must precisely equal Credits', async () => {
    const report = await ReportsService.getTrialBalance()

    // Dynamically verify the mathematical balance
    expect(report.totalDebits).toBe(report.totalCredits)
    expect(report.isBalanced).toBe(true)
  })

  test('📄 Income Statement: Net Income must equal Revenues minus Expenses', async () => {
    const statement = await ReportsService.getIncomeStatement()

    const calculatedNetIncome = Number(
      (statement.totalRevenue - statement.totalExpenses).toFixed(2)
    )
    expect(statement.netIncome).toBe(calculatedNetIncome)
  })

  test('⚖️ Balance Sheet: Fundamental Equation (Assets = Liabilities + Equity + Net Income) must hold true', async () => {
    const balanceSheet = await ReportsService.getBalanceSheet()

    // Dynamically verify the system maintains the fundamental accounting equation
    expect(balanceSheet.totalAssets).toBe(balanceSheet.totalLiabilitiesAndEquity)
    expect(balanceSheet.isEquationBalanced).toBe(true)
  })
})

describe('Phase 5: CDJ and Check Disbursements', () => {
  test('CDJ entries receive correct sequential running totals', async () => {
    const data = await ReportsService.getBooksOfAccounts('CDJ', '2000-01-01', '2100-01-01')
    expect(Array.isArray(data)).toBe(true)
    
    if (data.length > 0) {
      let expectedTotal = 0
      for (const row of data) {
        expectedTotal += Number(row.credit)
        expect(row.runningTotal).toBe(expectedTotal)
      }
    }
  })

  test('getCheckDisbursementReport calculates Gross, EWT, Net and running totals', async () => {
    const report = await ReportsService.getCheckDisbursementReport('2000-01-01', '2100-01-01')
    expect(Array.isArray(report)).toBe(true)
    
    if (report.length > 0) {
      let expectedRunning = 0
      for (const row of report) {
        expect(row.grossAmount).toBeGreaterThanOrEqual(0)
        expect(row.withholdingTax).toBeGreaterThanOrEqual(0)
        expect(row.netCheckAmount).toBeGreaterThanOrEqual(0)
        
        expectedRunning += row.netCheckAmount
        expect(row.runningTotal).toBe(expectedRunning)
      }
    }
  })

  test('Boundary date range filtering excludes records outside start and end dates', async () => {
    const report = await ReportsService.getCheckDisbursementReport('2199-01-01', '2199-12-31')
    expect(Array.isArray(report)).toBe(true)
    expect(report.length).toBe(0)
  })
})

describe('Phase 5.2: Sales Report & BIR Metadata', () => {
  test('getSalesReport accurately segregates vatable vs exempt sales and provides cumulative sales totals', async () => {
    const report = await ReportsService.getSalesReport('2000-01-01', '2100-01-01')
    expect(Array.isArray(report)).toBe(true)
    
    if (report.length > 0) {
      let expectedRunning = 0
      for (const row of report) {
        expect(row).toHaveProperty('grossSalesAmount')
        expect(row).toHaveProperty('vatableSales')
        expect(row).toHaveProperty('vatExemptSales')
        
        expectedRunning += row.grossSalesAmount
        expect(row.cumulativeSalesTotal).toBe(expectedRunning)
        
        if (row.outputVat > 0) {
          expect(row.vatableSales).toBe(Number((row.grossSalesAmount / 1.12).toFixed(2)))
        } else {
          expect(row.vatExemptSales).toBe(row.grossSalesAmount)
        }
      }
    }
  })

  test('getReportHeader produces official taxpayer header structure', () => {
    const header = ReportsService.getReportHeader('Sales Book', '2026-01-01', '2026-12-31')
    expect(header).toMatchObject({
      businessName: 'SMARTGUYS COMMUNITY HEALTHCARE INC.',
      tin: '000-000-000-000',
      rdo: '057',
      taxStatus: 'VAT Registered',
      bookTitle: 'Sales Book'
    })
    expect(header.startDate).toBeTruthy()
    expect(header.endDate).toBeTruthy()
  })
})
