import { contextBridge, ipcRenderer } from 'electron';

// Define exactly what the Frontend is allowed to ask the Backend to do.
export const api = {
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
};

// Expose the API to the React window
contextBridge.exposeInMainWorld('electronAPI', api);