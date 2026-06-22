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
  exportPDF: (filename: string) => ipcRenderer.invoke('export:printToPDF', filename)
};

// Expose the API to the React window
contextBridge.exposeInMainWorld('electronAPI', api);