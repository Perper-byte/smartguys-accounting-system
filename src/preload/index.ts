import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  // Authentication
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),

  // Ledger & Accounts
  getAccounts: () => ipcRenderer.invoke('ledger:getAccounts'),
  submitJournalEntry: (entryData: any) => ipcRenderer.invoke('ledger:submitEntry', entryData),
  getAccountLedger: (accountId: string) => ipcRenderer.invoke('ledger:getAccountLedger', accountId),
  getAllJournalEntries: () => ipcRenderer.invoke('ledger:getAllJournalEntries'),
  getFullLedgerReport: (startDate: string, endDate: string) => ipcRenderer.invoke('get-full-ledger-report', startDate, endDate),

  // Bank & Reconciliation
  getBankAccounts: () => ipcRenderer.invoke('get-bank-accounts'),
  createBankAccount: (data: any) => ipcRenderer.invoke('create-bank-account', data),
  getReconciliationData: (bankAccountId: string, startDate: string, endDate: string) => ipcRenderer.invoke('get-reconciliation-data', bankAccountId, startDate, endDate),
  createBankTransaction: (data: any) => ipcRenderer.invoke('create-bank-transaction', data),
  importBankTransactions: (data: any) => ipcRenderer.invoke('import-bank-transactions', data),
  matchBankTransaction: (bankTransactionId: string, journalEntryId: string, userId: string) => ipcRenderer.invoke('match-bank-transaction', bankTransactionId, journalEntryId, userId),
  unmatchBankTransaction: (bankTransactionId: string) => ipcRenderer.invoke('unmatch-bank-transaction', bankTransactionId),
  removeBankTransaction: (bankTransactionId: string, userId: string) => ipcRenderer.invoke('remove-bank-transaction', bankTransactionId, userId),

  // Payees
  getPayees: (typeFilter?: string) => ipcRenderer.invoke('get-payees', typeFilter),
  createPayee: (name: string, type?: string, tin?: string, email?: string, phone?: string, address?: string) => 
      ipcRenderer.invoke('create-payee', name, type, tin, email, phone, address),
  getPayeeBalance: (payeeId: string) => ipcRenderer.invoke('get-payee-balance', payeeId),
  updatePayeeTin: (payeeId: string, tin: string) => ipcRenderer.invoke('update-payee-tin', payeeId, tin),
  getContactsWithBalances: () => ipcRenderer.invoke('get-contacts-with-balances'),

  // Voids
  requestVoid: (id: string, reason: string) => ipcRenderer.invoke('request-void', id, reason),
  getPendingVoids: () => ipcRenderer.invoke('get-pending-voids'),
  rejectVoid: (id: string) => ipcRenderer.invoke('reject-void', id),
  approveVoid: (id: string, managerId: string) => ipcRenderer.invoke('approve-void', id, managerId),

  // POS & Transactions
  getNextSequence: (prefix: string) => ipcRenderer.invoke('get-next-sequence', prefix),
  getPayoutHistory: () => ipcRenderer.invoke('get-payout-history'),
  getAllRecentTransactions: () => ipcRenderer.invoke('get-all-recent-transactions'),
  getUserSalesHistory: (userId: string) => ipcRenderer.invoke('get-user-sales-history', userId),
  getShiftReport: (userId: string) => ipcRenderer.invoke('get-shift-report', userId),
  getPettyCashBalance: () => ipcRenderer.invoke('get-petty-cash-balance'),

  // Custom Reports
  getBooksOfAccounts: (bookType: string, startDate: string, endDate: string) => ipcRenderer.invoke('get-books-of-accounts', bookType, startDate, endDate),
  getAgedReceivables: () => ipcRenderer.invoke('get-aged-receivables'),
  getInvoiceTracker: () => ipcRenderer.invoke('get-invoice-tracker'), 

  // Financial Reports
  getTrialBalance: (year?: number, month?: number) => ipcRenderer.invoke('reports:getTrialBalance', year, month),
  getIncomeStatement: (year?: number, month?: number) => ipcRenderer.invoke('reports:getIncomeStatement', year, month),
  getBalanceSheet: (year?: number, month?: number) => ipcRenderer.invoke('reports:getBalanceSheet', year, month),
  getCashFlowStatement: (year?: number, month?: number) => ipcRenderer.invoke('reports:getCashFlowStatement', year, month),

  // Exporters
  exportTrialBalanceExcel: (year?: number, month?: number) => ipcRenderer.invoke('export:trialBalanceExcel', year, month),
  exportPDF: (filename: string) => ipcRenderer.invoke('export:printToPDF', filename),

  // Employees & Payroll
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  createEmployee: (data: any) => ipcRenderer.invoke('create-employee', data),
  processPayroll: (data: any) => ipcRenderer.invoke('process-payroll', data),
  toggleEmployeeStatus: (id: string, isActive: boolean) => ipcRenderer.invoke('toggle-employee-status', id, isActive),

  // Audit Logs
  logAction: (userId: string, action: string, details: string) => ipcRenderer.invoke('log-action', userId, action, details),
  getAuditLogs: (startDate: string, endDate: string) => ipcRenderer.invoke('get-audit-logs', startDate, endDate),

  // Backups & Tax
  triggerBackup: () => ipcRenderer.invoke('backup:triggerBackup'),
  generate2550Q: (year: number, quarter: number) => ipcRenderer.invoke('tax:generate2550Q', year, quarter),
  generateRelief: (year: number, quarter: number) => ipcRenderer.invoke('tax:generateRelief', year, quarter),

  // Analytics
  getAnalyticsMetrics: (timeframe: string) => ipcRenderer.invoke('analytics:getMetrics', timeframe),

  // Users
  getUsers: () => ipcRenderer.invoke('get-users'),
  createUser: (userData: any) => ipcRenderer.invoke('create-user', userData),
  toggleUserStatus: (userId: string, isActive: boolean) => ipcRenderer.invoke('toggle-user-status', userId, isActive),
  resetUserPassword: (userId: string, newPassword: string) => ipcRenderer.invoke('reset-user-password', userId, newPassword),

  // System & Network Config
  getServerIp: () => ipcRenderer.invoke('config:getServerIp'),
  setServerIp: (ip: string) => ipcRenderer.invoke('config:setServerIp', ip),
  pingDatabase: () => ipcRenderer.invoke('system:ping'),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', api);
  contextBridge.exposeInMainWorld('api', api); 
} catch (error) {
  console.error('Failed to expose electronAPI in preload:', error);
}