import { contextBridge, IpcMainServiceWorker, ipcRenderer } from 'electron';

// Define exactly what the Frontend is allowed to ask the Backend to do.
export const api = {
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  getAccounts: () => ipcRenderer.invoke('ledger:getAccounts'),
  submitJournalEntry: (entryData) => ipcRenderer.invoke('ledger:submitEntry', entryData),
  getAccountLedger: (accountId) => ipcRenderer.invoke('ledger:getAccountLedger', accountId),
  getTrialBalance: () => ipcRenderer.invoke('reports:getTrialBalance'),
  getIncomeStatement: () => ipcRenderer.invoke('reports:getIncomeStatement'),
  getBalanceSheet: () => ipcRenderer.invoke('reports:getBalanceSheet'),
  exportTrialBalanceExcel: () => ipcRenderer.invoke('export:trialBalanceExcel'),
  exportPDF: (filename) => ipcRenderer.invoke('export:printToPDF', filename),
  triggerBackup: () => ipcRenderer.invoke('backup:triggerBackup'),
  generate2550Q: (year, quarter) => ipcRenderer.invoke('tax:generate2550Q', year, quarter),
  generateRelief: (year, quarter) => ipcRenderer.invoke('tax:generateRelief', year, quarter),
  getAnalyticsMetrics: () => ipcRenderer.invoke('analytics:getMetrics')
};

// Expose the API to the React window
contextBridge.exposeInMainWorld('electronAPI', api);