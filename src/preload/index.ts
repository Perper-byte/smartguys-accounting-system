// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

export const api = {
  login: (username, password) => ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGIN, username, password),
  
  getAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.LEDGER.GET_ACCOUNTS),
  submitJournalEntry: (entryData) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER.SUBMIT_ENTRY, entryData),
  getAccountLedger: (accountId) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER.GET_LEDGER, accountId),

  getPayees: () => ipcRenderer.invoke('get-payees'),
  createPayee: (name) => ipcRenderer.invoke('create-payee', name),
  getPayeeBalance: (payeeId) => ipcRenderer.invoke('get-payee-balance', payeeId),
  updatePayeeTin: (payeeId: string, tin: string) => ipcRenderer.invoke('update-payee-tin', payeeId, tin),

  getNextSequence: (prefix: string) => ipcRenderer.invoke('get-next-sequence', prefix),
  getPayoutHistory: () => ipcRenderer.invoke('get-payout-history'),
  getAllRecentTransactions: () => ipcRenderer.invoke('get-all-recent-transactions'),

  requestVoid: (id: string, reason: string) => ipcRenderer.invoke('request-void', id, reason),
  getPendingVoids: () => ipcRenderer.invoke('get-pending-voids'),
  rejectVoid: (id: string) => ipcRenderer.invoke('reject-void', id),
  approveVoid: (id: string, managerId: string) => ipcRenderer.invoke('approve-void', id, managerId),
  getUserSalesHistory: (userId: string) => ipcRenderer.invoke('get-user-sales-history', userId),

  getBooksOfAccounts: (bookType: string, startDate: string, endDate: string) => ipcRenderer.invoke('get-books-of-accounts', bookType, startDate, endDate),
  getTrialBalance: (start?: string, end?: string) => ipcRenderer.invoke(IPC_CHANNELS.REPORTS.TRIAL_BALANCE, start, end),
  getIncomeStatement: (start?: string, end?: string) => ipcRenderer.invoke(IPC_CHANNELS.REPORTS.INCOME_STATEMENT, start, end),
  getBalanceSheet: (start?: string, end?: string) => ipcRenderer.invoke(IPC_CHANNELS.REPORTS.BALANCE_SHEET, start, end),
  getShiftReport: (userId: string) => ipcRenderer.invoke('get-shift-report', userId),
  getPettyCashBalance: () => ipcRenderer.invoke('get-petty-cash-balance'),
  getAgedReceivables: () => ipcRenderer.invoke('get-aged-receivables'),

  // ---> NEW AUDIT BRIDGES <---
  logAction: (userId: string, action: string, details: string) => ipcRenderer.invoke('log-action', userId, action, details),
  getAuditLogs: (startDate: string, endDate: string) => ipcRenderer.invoke('get-audit-logs', startDate, endDate),

  exportTrialBalanceExcel: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT.TRIAL_BALANCE_EXCEL),
  exportPDF: (filename) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT.PRINT_PDF, filename),
  triggerBackup: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP.TRIGGER),
  generate2550Q: (year, quarter) => ipcRenderer.invoke(IPC_CHANNELS.TAX.GENERATE_2550Q, year, quarter),
  generateRelief: (year, quarter) => ipcRenderer.invoke(IPC_CHANNELS.TAX.GENERATE_RELIEF, year, quarter),
  getAnalyticsMetrics: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS.GET_METRICS),
  
  getUsers: () => ipcRenderer.invoke('get-users'),
  createUser: (userData) => ipcRenderer.invoke('create-user', userData),
  toggleUserStatus: (userId: string, isActive: boolean) => ipcRenderer.invoke('toggle-user-status', userId, isActive),
  resetUserPassword: (userId: string, newPassword: string) => ipcRenderer.invoke('reset-user-password', userId, newPassword),
};

contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('api', api);