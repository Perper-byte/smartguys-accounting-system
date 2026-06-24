// src/main/services/reports.service.test.ts
import { ReportsService } from './reports.service';

describe('Sprint 3 - Week 1: Financial Reporting Engine', () => {

  test('📊 Trial Balance: Debits must precisely equal Credits', async () => {
    const report = await ReportsService.getTrialBalance();

    // Dynamically verify the mathematical balance
    expect(report.totalDebits).toBe(report.totalCredits);
    expect(report.isBalanced).toBe(true);
  });

  test('📄 Income Statement: Net Income must equal Revenues minus Expenses', async () => {
    const statement = await ReportsService.getIncomeStatement();

    const calculatedNetIncome = Number((statement.totalRevenue - statement.totalExpenses).toFixed(2));
    expect(statement.netIncome).toBe(calculatedNetIncome);
  });

  test('⚖️ Balance Sheet: Fundamental Equation (Assets = Liabilities + Equity + Net Income) must hold true', async () => {
    const balanceSheet = await ReportsService.getBalanceSheet();

    // Dynamically verify the system maintains the fundamental accounting equation
    expect(balanceSheet.totalAssets).toBe(balanceSheet.totalLiabilitiesAndEquity);
    expect(balanceSheet.isEquationBalanced).toBe(true);
  });
});