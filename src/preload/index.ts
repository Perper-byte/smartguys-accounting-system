import { contextBridge, IpcMainServiceWorker, ipcRenderer } from 'electron';

// Define exactly what the Frontend is allowed to ask the Backend to do.
export const api = {
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),

  // NEW ROUTES
  getAccounts: () => ipcRenderer.invoke('ledger:getAccounts'),
  submitJournalEntry: (entryData) => ipcRenderer.invoke('ledger:submitEntry', entryData)
};

// Expose the API to the React window
contextBridge.exposeInMainWorld('electronAPI', api);