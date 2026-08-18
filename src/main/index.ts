// src/main/index.ts
import './env';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { AnalyticsService } from './services/analytics.service';
import { TaxService } from './services/tax.service';
import { BackupService } from './services/backup.service';
import { ReportsService } from './services/reports.service';
import { LedgerService } from './services/ledger.service';
import { ExportService } from './services/export.service'; // <-- ADDED EXPORT SERVICE
import path from 'path';
import { AuthService } from './services/auth.service';
import * as fs from 'fs';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, // MANDATORY FOR SECURITY
      nodeIntegration: false,
      sandbox: false
    },
  });

  // LOAD THE REACT FRONTEND!
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
  // Auth
  ipcMain.handle(IPC_CHANNELS.AUTH.LOGIN, async (event, username, password) => {
    try {
      const user = await AuthService.login(username, password);
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Ledger
  ipcMain.handle(IPC_CHANNELS.LEDGER.GET_ACCOUNTS, async () => {
    try {
      return await LedgerService.getAccounts();
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  ipcMain.handle('get-payees', async () => {
    try {
      return await LedgerService.getPayees();
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  ipcMain.handle('create-payee', async (event, name: string) => {
    return await LedgerService.createPayee(name);
  });

  ipcMain.handle('get-payee-balance', async (event, payeeId: string) => {
    return await LedgerService.getPayeeBalance(payeeId);
  });

  ipcMain.handle(IPC_CHANNELS.LEDGER.SUBMIT_ENTRY, async (event, entryData) => {
    try {
      return await LedgerService.createJournalEntry(entryData);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEDGER.GET_LEDGER, async (event, accountId) => {
    try {
      return await LedgerService.getAccountLedger(accountId);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  // Reports
  ipcMain.handle('reports:getTrialBalance', async (event, year, month) => {
    try {
      let endDate;
      if (year && month) endDate = new Date(year, month, 0, 23, 59, 59);
      return await ReportsService.getTrialBalance(undefined, endDate);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('reports:getIncomeStatement', async (event, year, month) => {
    try {
      return await ReportsService.getIncomeStatement(year, month);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('reports:getBalanceSheet', async (event, year, month) => {
    try {
      return await ReportsService.getBalanceSheet(year, month);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('reports:getCashFlowStatement', async (event, year, month) => {
    try {
      return await ReportsService.getCashFlowStatement(year, month);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  // 🚀 EXPORTERS (PDF & EXCEL) - ADDED THIS ENTIRE SECTION!
  ipcMain.handle(IPC_CHANNELS.EXPORT.TRIAL_BALANCE_EXCEL, async (event, year, month) => {
    try {
      // 🔥 Pass the year and month to the service
      return await ExportService.exportTrialBalanceToExcel(year, month);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT.PRINT_PDF, async (event, filename: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Window not found' };

    const { filePath } = await dialog.showSaveDialog({
      title: 'Save PDF Report',
      defaultPath: filename,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    });

    if (!filePath) return { success: false, error: 'Export cancelled' };

    try {
      // 🔥 THE FIX: Forcefully inject CSS to murder the sidebar, header, and buttons right before printing
      await win.webContents.insertCSS(`
        @media print {
          aside, header, button, .no-print { display: none !important; }
          #app, div.flex.h-screen, main { height: auto !important; overflow: visible !important; }
          html, body { background-color: white !important; }
        }
      `);

      // Give the DOM a tiny fraction of a second to apply the CSS
      await new Promise(resolve => setTimeout(resolve, 100));

      const data = await win.webContents.printToPDF({
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }, // Margins in inches
        printBackground: true,
        pageSize: 'A4',
        landscape: false
      });

      fs.writeFileSync(filePath, data);
      return { success: true, filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Backup
  ipcMain.handle(IPC_CHANNELS.BACKUP.TRIGGER, async () => {
    return await BackupService.executeBackup();
  });

  // Tax
  ipcMain.handle(IPC_CHANNELS.TAX.GENERATE_2550Q, async (event, year, quarter) => {
    try {
      return await TaxService.generate2550Q(year, quarter);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TAX.GENERATE_RELIEF, async (event, year, quarter) => {
    try {
      return await TaxService.generateReliefAnnexes(year, quarter);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  // Analytics
  ipcMain.handle(IPC_CHANNELS.ANALYTICS.GET_METRICS, async (event, timeframe: string) => {
    try {
      return await AnalyticsService.getDashboardMetrics(timeframe as any);
    } catch (error: any) {
      return { error: error.message };
    }
  });

  // 🚀 NETWORK SETTINGS (LAN CONFIGURATION)
  ipcMain.handle('config:getServerIp', () => {
    const configPath = path.join(app.getPath('userData'), 'server-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.serverIp || 'localhost';
    }
    return 'localhost';
  });

  ipcMain.handle('config:setServerIp', (event, ip: string) => {
    const configPath = path.join(app.getPath('userData'), 'server-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ serverIp: ip }));

    // Automatically restart the app to apply the new database connection!
    app.relaunch();
    app.exit(0);
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});