// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

export const api = {
  login: (username, password) => ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGIN, username, password),

  getAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.LEDGER.GET_ACCOUNTS),
  submitJournalEntry: (entryData) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER.SUBMIT_ENTRY, entryData),
  getAccountLedger: (accountId) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER.GET_LEDGER, accountId),

  // Payee / Patient Functions
  getPayees: () => ipcRenderer.invoke('get-payees'),
  createPayee: (name) => ipcRenderer.invoke('create-payee', name),
  getPayeeBalance: (payeeId) => ipcRenderer.invoke('get-payee-balance', payeeId), // <-- NEW

  getTrialBalance: () => ipcRenderer.invoke(IPC_CHANNELS.REPORTS.TRIAL_BALANCE),
  getIncomeStatement: () => ipcRenderer.invoke(IPC_CHANNELS.REPORTS.INCOME_STATEMENT),
  getBalanceSheet: () => ipcRenderer.invoke(IPC_CHANNELS.REPORTS.BALANCE_SHEET),

  exportTrialBalanceExcel: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT.TRIAL_BALANCE_EXCEL),
  exportPDF: (filename) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT.PRINT_PDF, filename),

  triggerBackup: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP.TRIGGER),

  generate2550Q: (year, quarter) => ipcRenderer.invoke(IPC_CHANNELS.TAX.GENERATE_2550Q, year, quarter),
  generateRelief: (year, quarter) => ipcRenderer.invoke(IPC_CHANNELS.TAX.GENERATE_RELIEF, year, quarter),

  getAnalyticsMetrics: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS.GET_METRICS)
};

contextBridge.exposeInMainWorld('electronAPI', api);