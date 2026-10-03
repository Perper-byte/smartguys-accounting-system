// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

export const api = {
  // Authentication
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),

  // Users
  getUsers: () => ipcRenderer.invoke('get-users'),
  // 🔥 FIXED: Added adminUser parameter to all of these so they pass through to the backend!
  createUser: (userData: any, adminUser?: string) =>
    ipcRenderer.invoke('create-user', userData, adminUser),
  toggleUserStatus: (userId: string, isActive: boolean, adminUser?: string) =>
    ipcRenderer.invoke('toggle-user-status', userId, isActive, adminUser),
  resetUserPassword: (userId: string, newPassword: string, adminUser?: string) =>
    ipcRenderer.invoke('reset-user-password', userId, newPassword, adminUser),
  updateUserPermissions: (id: string, perms: string[], adminUser?: string) =>
    ipcRenderer.invoke('update-user-permissions', id, perms, adminUser),
  getPettyCashBalance: () => ipcRenderer.invoke('get-petty-cash-balance'),

  // Ledger & Accounts
  getAccounts: () => ipcRenderer.invoke('ledger:getAccounts'),
  getAccountTypes: () => ipcRenderer.invoke('ledger:getAccountTypes'),
  createAccount: (data: any) => ipcRenderer.invoke('ledger:createAccount', data),
  submitJournalEntry: (entryData: any) => ipcRenderer.invoke('ledger:submitEntry', entryData),
  updatePosTransaction: (entryData: any) => ipcRenderer.invoke('update-pos-transaction', entryData),
  getPatientTransactions: (args: any) => ipcRenderer.invoke('get-patient-transactions', args),
  getAccountLedger: (accountId: string) => ipcRenderer.invoke('ledger:getAccountLedger', accountId),
  getAllJournalEntries: () => ipcRenderer.invoke('ledger:getAllJournalEntries'),
  getJournalEntryById: (idOrRef: string) => ipcRenderer.invoke('ledger:getJournalEntryById', idOrRef),
  getFullLedgerReport: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('get-full-ledger-report', startDate, endDate),

  // Bank & Reconciliation
  getBankAccounts: () => ipcRenderer.invoke('get-bank-accounts'),
  createBankAccount: (data: any) => ipcRenderer.invoke('create-bank-account', data),
  getReconciliationData: (bankAccountId: string, startDate: string, endDate: string) =>
    ipcRenderer.invoke('get-reconciliation-data', bankAccountId, startDate, endDate),
  createBankTransaction: (data: any) => ipcRenderer.invoke('create-bank-transaction', data),
  importBankTransactions: (data: any) => ipcRenderer.invoke('import-bank-transactions', data),
  matchBankTransaction: (bankTransactionId: string, journalEntryId: string, userId: string) =>
    ipcRenderer.invoke('match-bank-transaction', bankTransactionId, journalEntryId, userId),
  unmatchBankTransaction: (bankTransactionId: string) =>
    ipcRenderer.invoke('unmatch-bank-transaction', bankTransactionId),
  removeBankTransaction: (bankTransactionId: string, userId: string) =>
    ipcRenderer.invoke('remove-bank-transaction', bankTransactionId, userId),
  restorePayee: (payeeId: string) => ipcRenderer.invoke('restore-payee', payeeId),

  // Payees
  getPayees: (typeFilter?: string) => ipcRenderer.invoke('get-payees', typeFilter),
  createPayee: (
    name: string,
    type: string,
    tin: string,
    email: string,
    phone: string,
    address: string,
    hmoAffiliation?: string,
    hmoCardNo?: string,
    hmoExpiry?: string
  ) =>
    ipcRenderer.invoke(
      'create-payee',
      name,
      type,
      tin,
      email,
      phone,
      address,
      hmoAffiliation,
      hmoCardNo,
      hmoExpiry
    ),
  importPayees: (data: any[]) => ipcRenderer.invoke('import-payees', data),
  archivePayee: (payeeId: string) => ipcRenderer.invoke('archive-payee', payeeId),
  getPayeeBalance: (payeeId: string) => ipcRenderer.invoke('get-payee-balance', payeeId),
  updatePayeeTin: (payeeId: string, tin: string) =>
    ipcRenderer.invoke('update-payee-tin', payeeId, tin),
  getContactsWithBalances: () => ipcRenderer.invoke('get-contacts-with-balances'),

  // Services & Procedures (POS Items)
  getAllServiceItems: () => ipcRenderer.invoke('get-all-service-items'),
  createServiceItem: (data: any) => ipcRenderer.invoke('create-service-item', data),
  updateServiceItem: (id: number, data: any) => ipcRenderer.invoke('update-service-item', id, data),
  getServiceItems: () => ipcRenderer.invoke('get-service-items'),

  // Inventory
  getInventoryItems: () => ipcRenderer.invoke('get-inventory-items'),
  createInventoryItem: (data: any) => ipcRenderer.invoke('create-inventory-item', data),
  updateInventoryItem: (id: string, data: any) =>
    ipcRenderer.invoke('update-inventory-item', id, data),
  deleteInventoryItem: (id: string) => ipcRenderer.invoke('delete-inventory-item', id),
  getInventoryLogs: (itemId: string) => ipcRenderer.invoke('get-inventory-logs', itemId),
  addInventoryLog: (data: any) => ipcRenderer.invoke('add-inventory-log', data),

  // Voids
  requestVoid: (id: string, reason: string) => ipcRenderer.invoke('request-void', id, reason),
  getPendingVoids: () => ipcRenderer.invoke('get-pending-voids'),
  rejectVoid: (id: string) => ipcRenderer.invoke('reject-void', id),
  approveVoid: (id: string, managerId: string, overridePin?: string) =>
    ipcRenderer.invoke('approve-void', id, managerId, overridePin),

  // POS & Transactions
  getNextSequence: (prefix: string) => ipcRenderer.invoke('get-next-sequence', prefix),
  getPayoutHistory: () => ipcRenderer.invoke('get-payout-history'),
  getCashierDisbursements: (limit?: number) =>
    ipcRenderer.invoke('get-cashier-disbursements', limit),
  acknowledgeCashierDisbursement: (entryId: string, userId?: string, note?: string) =>
    ipcRenderer.invoke('acknowledge-cashier-disbursement', entryId, userId, note),
  updateDisbursementAttachment: (entryId: string, attachment: any) =>
    ipcRenderer.invoke('update-disbursement-attachment', entryId, attachment),
  getRecentDisbursements: (limit?: number) =>
    ipcRenderer.invoke('get-recent-disbursements', limit),
  getHistoricalDisbursements: (options?: any) =>
    ipcRenderer.invoke('get-historical-disbursements', options),
  getAllRecentTransactions: () => ipcRenderer.invoke('get-all-recent-transactions'),
  getUserSalesHistory: (userId: string) => ipcRenderer.invoke('get-user-sales-history', userId),
  getShiftReport: (userId: string) => ipcRenderer.invoke('get-shift-report', userId),

  // Custom Reports
  getBooksOfAccounts: (bookType: string, startDate: string, endDate: string) =>
    ipcRenderer.invoke('get-books-of-accounts', bookType, startDate, endDate),
  getAgedReceivables: () => ipcRenderer.invoke('get-aged-receivables'),
  getInvoiceTracker: () => ipcRenderer.invoke('get-invoice-tracker'),

  // Financial Reports
  getTrialBalance: (year?: number, month?: number, quarter?: string) =>
    ipcRenderer.invoke('reports:getTrialBalance', year, month, quarter),
  getIncomeStatement: (year?: number, month?: number, quarter?: string) =>
    ipcRenderer.invoke('reports:getIncomeStatement', year, month, quarter),
  getBalanceSheet: (year?: number, month?: number, quarter?: string) =>
    ipcRenderer.invoke('reports:getBalanceSheet', year, month, quarter),
  getCashFlowStatement: (year?: number, month?: number, quarter?: string) =>
    ipcRenderer.invoke('reports:getCashFlowStatement', year, month, quarter),

  // Exporters
  exportFinancialStatementExcel: (statementType: string, year?: number, month?: number, quarter?: string) =>
    ipcRenderer.invoke('export:financialStatementExcel', statementType, year, month, quarter),
  exportTrialBalanceExcel: (year?: number, month?: number, quarter?: string) =>
    ipcRenderer.invoke('export:trialBalanceExcel', year, month, quarter),
  exportEmployeesExcel: (employees?: any[]) => ipcRenderer.invoke('export:employeesExcel', employees),
  downloadEmployeeTemplate: () => ipcRenderer.invoke('export:downloadEmployeeTemplate'),
  exportPayslipPDF: (payslipId: string) => ipcRenderer.invoke('export:payslipPDF', payslipId),
  exportBatchPayslipsPDF: (journalEntryId: string) => ipcRenderer.invoke('export:batchPayslipsPDF', journalEntryId),
  exportPDF: (filename: string) => ipcRenderer.invoke('export:printToPDF', filename),

  // Employees & Payroll
  getPayrollSettings: () => ipcRenderer.invoke('payroll:getSettings'),
  updatePayrollSettings: (multipliers: any) => ipcRenderer.invoke('payroll:updateSettings', multipliers),
  calculateEmployeePayroll: (monthlySalary: number, hours: any, demerits: any, allowances?: any[], loans?: any[]) =>
    ipcRenderer.invoke('payroll:calculateEmployee', monthlySalary, hours, demerits, allowances, loans),
  batchCalculatePayroll: (employeeInputs: any[]) => ipcRenderer.invoke('payroll:batchCalculate', employeeInputs),
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  createEmployee: (data: any) => ipcRenderer.invoke('create-employee', data),
  bulkImportEmployees: (records: any[], updateExisting: boolean) =>
    ipcRenderer.invoke('payroll:bulkImportEmployees', records, updateExisting),
  processPayroll: (data: any) => ipcRenderer.invoke('process-payroll', data),
  toggleEmployeeStatus: (id: string, isActive: boolean) =>
    ipcRenderer.invoke('toggle-employee-status', id, isActive),
  getPayrollHistory: () => ipcRenderer.invoke('get-payroll-history'),
  updateEmployee: (id: string, data: any) => ipcRenderer.invoke('update-employee', id, data),

  // Audit Logs
  logAction: (userId: string, action: string, details: string) =>
    ipcRenderer.invoke('log-action', userId, action, details),
  getAuditLogs: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('get-audit-logs', startDate, endDate),
  getLockDate: () => ipcRenderer.invoke('get-lock-date'),
  setLockDate: (date: string | null) => ipcRenderer.invoke('set-lock-date', date),

  // Backups & Tax
  triggerBackup: () => ipcRenderer.invoke('backup:triggerBackup'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),
  generate2550Q: (year: number, quarter: number) =>
    ipcRenderer.invoke('tax:generate2550Q', year, quarter),
  generateRelief: (year: number, quarter: number) =>
    ipcRenderer.invoke('tax:generateRelief', year, quarter),
  generate0619E: (year: number, month: number) =>
    ipcRenderer.invoke('tax:generate0619E', year, month),
  generate1601EQ: (year: number, quarter: number) =>
    ipcRenderer.invoke('tax:generate1601EQ', year, quarter),
  generate1601C: (year: number, month: number) =>
    ipcRenderer.invoke('tax:generate1601C', year, month),

  // Dashboard Analytics
  getTodayStats: () => ipcRenderer.invoke('get-today-stats'),
  getRecentTransactions: () => ipcRenderer.invoke('get-recent-transactions'),
  getAnalyticsMetrics: (timeframe: string) => ipcRenderer.invoke('analytics:getMetrics', timeframe),

  updateReferenceNumber: (entryId: string, newRef: string) =>
    ipcRenderer.invoke('update-reference-number', entryId, newRef),

  // System & Network Config
  getServerIp: () => ipcRenderer.invoke('config:getServerIp'),
  setServerIp: (ip: string) => ipcRenderer.invoke('config:setServerIp', ip),
  pingDatabase: () => ipcRenderer.invoke('system:ping'),
  verifyManagerPin: (pin: string) => ipcRenderer.invoke('verify-manager-pin', pin)
}

try {
  contextBridge.exposeInMainWorld('electronAPI', api)
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('Failed to expose electronAPI in preload:', error)
}
