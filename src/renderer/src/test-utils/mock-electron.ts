// src/renderer/src/test-utils/mock-electron.ts

export interface MockElectronAPIOptions {
  currentUser?: { id: string; username: string; role: string; permissions?: string[] }
  accounts?: any[]
  calendar?: any[]
  users?: any[]
  inventory?: any[]
  services?: any[]
  journalEntries?: any[]
  [key: string]: any
}

export function setupMockElectronAPI(options: MockElectronAPIOptions = {}) {
  const defaultAccounts = [
    { code: '1010', name: 'Cash on Hand', type_id: 'type-asset', account_type: { name: 'Assets' } },
    { code: '1020', name: 'Cash in Bank', type_id: 'type-asset', account_type: { name: 'Assets' } },
    { code: '1200', name: 'Accounts Receivable', type_id: 'type-asset', account_type: { name: 'Assets' } },
    { code: '2010', name: 'Accounts Payable', type_id: 'type-liability', account_type: { name: 'Liabilities' } },
    { code: '2020', name: 'Output Tax (VAT Payable)', type_id: 'type-liability', account_type: { name: 'Liabilities' } },
    { code: '2050', name: 'Withholding Tax Payable (Expanded)', type_id: 'type-liability', account_type: { name: 'Liabilities' } },
    { code: '3010', name: "Owner's Capital", type_id: 'type-equity', account_type: { name: 'Equity' } },
    { code: '3020', name: 'Retained Earnings', type_id: 'type-equity', account_type: { name: 'Equity' } },
    { code: '4010', name: 'Medical Consultation Revenue', type_id: 'type-revenue', account_type: { name: 'Revenue' } },
    { code: '5010', name: 'Medical Supplies Expense', type_id: 'type-expense', account_type: { name: 'Expenses' } },
    { code: '5020', name: 'Utilities Expense', type_id: 'type-expense', account_type: { name: 'Expenses' } }
  ]

  const mockApi = {
    login: jest.fn().mockResolvedValue({
      success: true,
      data: options.currentUser || { id: 'usr-1', username: 'admin_test', role: 'MANAGER', is_active: true }
    }),
    getUsers: jest.fn().mockResolvedValue(options.users || []),
    createUser: jest.fn().mockResolvedValue({ success: true, data: { id: 'usr-new' } }),
    toggleUserStatus: jest.fn().mockResolvedValue({ success: true }),
    resetUserPassword: jest.fn().mockResolvedValue({ success: true }),
    updateUserPermissions: jest.fn().mockResolvedValue({ success: true }),
    getRolePermissions: jest.fn().mockResolvedValue(options.rolePermissions || {
      CASHIER: ['billing', 'collections', 'directory', 'history'],
      ACCOUNTANT: [
        'billing', 'collections', 'directory', 'disbursement', 'payouts', 'aging', 'aged-payables',
        'tracker', 'history', 'journal', 'adjusting', 'ledger', 'reconciliation', 'books',
        'statements', 'bir', 'coa', 'inventory', 'services'
      ],
      MANAGER: [
        'billing', 'collections', 'directory', 'disbursement', 'payouts', 'aging', 'aged-payables',
        'tracker', 'history', 'payroll', 'journal', 'adjusting', 'ledger', 'reconciliation',
        'books', 'analytics', 'statements', 'bir', 'voids', 'coa', 'inventory', 'services', 'settings'
      ],
      IT_PERSONNEL: ['directory', 'audit', 'users', 'backup', 'services', 'inventory']
    }),
    updateRolePermissions: jest.fn().mockResolvedValue({ success: true }),
    forceApplyRolePermissions: jest.fn().mockResolvedValue({ success: true, count: 2 }),
    getPettyCashBalance: jest.fn().mockResolvedValue({ current_balance: 5000 }),
    getAccounts: jest.fn().mockResolvedValue(options.accounts || defaultAccounts),
    getAccountTypes: jest.fn().mockResolvedValue(options.accountTypes || [
      { id: 'type-asset', name: 'Assets', normal_balance: 'DEBIT' },
      { id: 'type-liability', name: 'Liabilities', normal_balance: 'CREDIT' },
      { id: 'type-equity', name: 'Equity', normal_balance: 'CREDIT' },
      { id: 'type-revenue', name: 'Revenue', normal_balance: 'CREDIT' },
      { id: 'type-expense', name: 'Expenses', normal_balance: 'DEBIT' }
    ]),
    createAccount: jest.fn().mockResolvedValue({ success: true }),
    submitJournalEntry: jest.fn().mockResolvedValue({ success: true, id: 'je-1', referenceNo: 'OR-001' }),
    updatePosTransaction: jest.fn().mockResolvedValue({ success: true }),
    getPatientTransactions: jest.fn().mockResolvedValue({ transactions: [], total: 0 }),
    getAccountLedger: jest.fn().mockResolvedValue({ account: {}, entries: [] }),
    getAllJournalEntries: jest.fn().mockResolvedValue(options.journalEntries || []),
    getJournalEntryById: jest.fn().mockResolvedValue({ id: 'je-1', lines: [] }),
    getFullLedgerReport: jest.fn().mockResolvedValue({ entries: [] }),
    getBankAccounts: jest.fn().mockResolvedValue([]),
    getPayees: jest.fn().mockResolvedValue([]),
    createPayee: jest.fn().mockResolvedValue({ success: true, id: 'payee-1' }),
    getAllServiceItems: jest.fn().mockResolvedValue(options.services || []),
    getServiceItems: jest.fn().mockResolvedValue(options.services || []),
    setAllServicesVat: jest.fn().mockResolvedValue({ success: true }),
    setAllMedicinesVat: jest.fn().mockResolvedValue({ success: true }),
    updateServiceVat: jest.fn().mockResolvedValue({ success: true }),
    updateMedicineVat: jest.fn().mockResolvedValue({ success: true }),
    getInventoryItems: jest.fn().mockResolvedValue(options.inventory || []),
    createInventoryItem: jest.fn().mockResolvedValue({ success: true }),
    updateInventoryItem: jest.fn().mockResolvedValue({ success: true }),
    deleteInventoryItem: jest.fn().mockResolvedValue({ success: true }),
    getInventoryLogs: jest.fn().mockResolvedValue([]),
    addInventoryLog: jest.fn().mockResolvedValue({ success: true }),
    getLockDate: jest.fn().mockResolvedValue({ lockDate: null, autoLockDay: null, fiscalYearStartMonth: 1 }),
    setLockDate: jest.fn().mockResolvedValue({ success: true }),
    getCalendar: jest.fn().mockResolvedValue(options.calendar || []),
    validatePreClose: jest.fn().mockResolvedValue({
      canClose: true,
      unmatchedBankCount: 0,
      pendingVoidCount: 0,
      isLedgerBalanced: true,
      unbalancedDifference: 0,
      warnings: [],
      errors: []
    }),
    updatePeriodStatus: jest.fn().mockResolvedValue({ success: true }),
    closePeriod: jest.fn().mockResolvedValue({ success: true }),
    reopenPeriod: jest.fn().mockResolvedValue({ success: true }),
    triggerBackup: jest.fn().mockResolvedValue({ success: true, message: 'Backup created' }),
    generate2550Q: jest.fn().mockResolvedValue({}),
    generateRelief: jest.fn().mockResolvedValue({}),
    getAnalyticsMetrics: jest.fn().mockResolvedValue({
      kpi: { revenue: 50000, expenses: 20000, netCash: 30000, margin: 60 },
      expenseBreakdown: [],
      trendData: { labels: ['Jan', 'Feb', 'Mar'], revenue: [10000, 20000, 20000], expenses: [5000, 7000, 8000] }
    }),
    getTrialBalance: jest.fn().mockResolvedValue({ lines: [], totalDebit: 0, totalCredit: 0 }),
    getPostClosingTrialBalance: jest.fn().mockResolvedValue({ lines: [], totalDebits: 0, totalCredits: 0, isBalanced: true, closedPeriodValid: true, unclosedTemporaryAccounts: [] }),
    getIncomeStatement: jest.fn().mockResolvedValue({ revenues: [], expenses: [], netIncome: 0 }),
    getBalanceSheet: jest.fn().mockResolvedValue({ assets: [], liabilities: [], equity: [] }),
    getCashFlowStatement: jest.fn().mockResolvedValue({ operating: [], investing: [], financing: [] }),
    exportFinancialStatementExcel: jest.fn().mockResolvedValue({ success: true }),
    exportTrialBalanceExcel: jest.fn().mockResolvedValue({ success: true }),
    getServerIp: jest.fn().mockResolvedValue('localhost'),
    setServerIp: jest.fn().mockResolvedValue({ success: true }),
    pingDatabase: jest.fn().mockResolvedValue(true),
    getAuditLogs: jest.fn().mockResolvedValue([]),
    logAction: jest.fn().mockResolvedValue({ success: true }),
    getBooksOfAccounts: jest.fn().mockResolvedValue([]),
    getSalesReport: jest.fn().mockResolvedValue([]),
    getCheckDisbursementReport: jest.fn().mockResolvedValue([]),
    getPendingVoids: jest.fn().mockResolvedValue(options.pendingVoids || []),
    getVoidHistory: jest.fn().mockResolvedValue(options.voidHistory || []),
    getCashierDisbursements: jest.fn().mockResolvedValue(options.cashierDisbursements || []),
    getNextSequence: jest.fn().mockResolvedValue('001'),
    approveVoid: jest.fn().mockResolvedValue({ success: true }),
    rejectVoid: jest.fn().mockResolvedValue({ success: true })
  }

  // Assign to global window objects
  Object.defineProperty(window, 'electronAPI', { value: mockApi, writable: true, configurable: true })
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })

  return mockApi
}
