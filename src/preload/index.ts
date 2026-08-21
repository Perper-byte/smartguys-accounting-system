// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Authentication
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),

  // Ledger & Accounts
  getAccounts: () => ipcRenderer.invoke('ledger:getAccounts'),
  submitJournalEntry: (entryData: any) => ipcRenderer.invoke('ledger:submitEntry', entryData),
  getAccountLedger: (accountId: string) => ipcRenderer.invoke('ledger:getAccountLedger', accountId),
  getPayees: () => ipcRenderer.invoke('get-payees'),
  createPayee: (name: string) => ipcRenderer.invoke('create-payee', name),
  getPayeeBalance: (payeeId: string) => ipcRenderer.invoke('get-payee-balance', payeeId),

  // 🔥 Financial Reports (Fixed to use explicit safe strings!)
  getTrialBalance: (year?: number, month?: number) => ipcRenderer.invoke('reports:getTrialBalance', year, month),
  getIncomeStatement: (year?: number, month?: number) => ipcRenderer.invoke('reports:getIncomeStatement', year, month),
  getBalanceSheet: (year?: number, month?: number) => ipcRenderer.invoke('reports:getBalanceSheet', year, month),
  getCashFlowStatement: (year?: number, month?: number) => ipcRenderer.invoke('reports:getCashFlowStatement', year, month),

  // Exporters
  exportTrialBalanceExcel: (year?: number, month?: number) =>
    ipcRenderer.invoke('export:trialBalanceExcel', year, month),
  exportPDF: (filename: string) => ipcRenderer.invoke('export:printToPDF', filename),

  // Backups
  triggerBackup: () => ipcRenderer.invoke('backup:triggerBackup'),

  // Tax Compliance
  generate2550Q: (year: number, quarter: number) => ipcRenderer.invoke('tax:generate2550Q', year, quarter),
  generateRelief: (year: number, quarter: number) => ipcRenderer.invoke('tax:generateRelief', year, quarter),

  // Analytics
  getAnalyticsMetrics: (timeframe: string) => ipcRenderer.invoke('analytics:getMetrics', timeframe),

  getServerIp: () => ipcRenderer.invoke('config:getServerIp'),
  setServerIp: (ip: string) => ipcRenderer.invoke('config:setServerIp', ip),

  getAllJournalEntries: () => ipcRenderer.invoke('ledger:getAllJournalEntries'),

  pingDatabase: () => ipcRenderer.invoke('system:ping'),
};

// Expose the API safely to React window object
try {
  contextBridge.exposeInMainWorld('electronAPI', api);
} catch (error) {
  console.error('Failed to expose electronAPI in preload:', error);
}