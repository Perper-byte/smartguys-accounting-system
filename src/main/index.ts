// src/main/index.ts
import * as fs from 'fs';
import { ExportService } from './services/export.service';
import { ReportsService } from './services/reports.service';
import { LedgerService } from './services/ledger.service';
import path from 'path';
import { app, BrowserWindow, ipcMain, dialog} from 'electron'
import { AuthService } from './services/auth.service';
import { main } from 'ts-node/dist/bin';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, // MANDATORY FOR SECURITY
      nodeIntegration: false,
    },
  });

  // LOAD THE REACT FRONTEND!
  // In development, load the Vite dev server URL. In production, load the local compile HTMl file.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  //------------------------------------------
  // IPC HANDLERS: React asks, Node.js answers
  //------------------------------------------
  ipcMain.handle('auth:login', async (event, username, password) => {
    try {
      const user = await AuthService.login(username, password);
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ledger:getAccounts', async () => {
    try {
      return await LedgerService.getAccounts();
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  ipcMain.handle('ledger:submitEntry', async (event, entryData) => {
    try {
      return await LedgerService.createJournalEntry(entryData);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ledger:getAccountLedger', async (event, accountId) => {
    try {
      return await LedgerService.getAccountLedger(accountId);
    } catch (error: any) {
      return { error: error.message };
    }
  });
  ipcMain.handle('reports:getTrialBalance', async () => {
    try {
      return await ReportsService.getTrialBalance();
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('reports:getIncomeStatement', async () => {
    try {
      return await ReportsService.getIncomeStatement();
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('reports:getBalanceSheet', async () => {
    try {
      return await ReportsService.getBalanceSheet();
    } catch (error: any) {
      return { error: error.message };
    }
  });
  ipcMain.handle('export:trialBalanceExcel', async () => {
    try {
      return await ExportService.exportTrialBalanceToExcel();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export:printToPDF', async (event, filename: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Window not found' };

    // Prompt user where to save the PDF
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save PDF Report',
      defaultPath: filename,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    });

    if (!filePath) return { success: false, error: 'Export cancelled' };

    try {
      // Instruct Electron's internal Chromium engine to render the screen as a PDF
      const data = await win.webContents.printToPDF({
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
        printBackground: true, // Crucial: retains background colors and styles!
        pageSize: 'A4',
        landscape: false
      });

      // Write to Disk
      fs.writeFileSync(filePath, data);
      return { success: true, filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
})

// Quit when all windows are close, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
