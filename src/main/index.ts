// src/main/index.ts
import { AnalyticsService } from './services/analytics.service';
import { TaxService } from './services/tax.service';
import { BackupService } from './services/backup.service';
import { ReportsService } from './services/reports.service';
import { LedgerService } from './services/ledger.service';
import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron'
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

  ipcMain.handle('backup:triggerBackup', async () => {
    return await BackupService.executeBackup();
  });

  ipcMain.handle('tax:generate2550Q', async (event, year, quarter) => {
    try {
      return await TaxService.generate2550Q(year, quarter);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('tax:generateRelief', async (event, year, quarter) => {
    try {
      return await TaxService.generateReliefAnnexes(year, quarter);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('analytics:getMetrics', async () => {
    try {
      return await AnalyticsService.getDashboardMetrics();
    } catch (error: any) {
      return { error: error.message };
    }
  });
})

// Quit when all windows are close, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
