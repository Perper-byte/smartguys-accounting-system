import { IPC_CHANNELS } from '../shared/ipc-channels';
import { AnalyticsService } from './services/analytics.service';
import { TaxService } from './services/tax.service';
import { BackupService } from './services/backup.service';
import { ReportsService } from './services/reports.service';
import { LedgerService } from './services/ledger.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service'; 

import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, 
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle(IPC_CHANNELS.AUTH.LOGIN, async (event, username, password) => {
    try {
      const user = await AuthService.login(username, password);
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('create-user', async (event, userData) => {
    try {
      const newUser = await UserService.createUser(userData);
      return { success: true, data: newUser };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-users', async () => {
    try {
      return await UserService.getAllUsers();
    } catch (error: any) {
      console.error(error);
      return [];
    }
  });

  ipcMain.handle('toggle-user-status', async (event, userId, isActive) => {
    try {
      await UserService.toggleUserStatus(userId, isActive);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reset-user-password', async (event, userId, newPassword) => {
    try {
      await UserService.resetPassword(userId, newPassword);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-petty-cash-balance', async () => {
    try {
      return await UserService.getPettyCashBalance();
    } catch (error: any) {
      console.error("Error fetching petty cash balance:", error);
      return 0;
    }
  });

  ipcMain.handle('get-shift-report', async (event, userId) => {
    try {
      return await ReportsService.getShiftReport(userId);
    } catch (error: any) {
      console.error(error);
      return { error: error.message };
    }
  });

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

  ipcMain.handle(IPC_CHANNELS.REPORTS.TRIAL_BALANCE, async () => {
    try {
      return await ReportsService.getTrialBalance();
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.REPORTS.INCOME_STATEMENT, async () => {
    try {
      return await ReportsService.getIncomeStatement();
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.REPORTS.BALANCE_SHEET, async () => {
    try {
      return await ReportsService.getBalanceSheet();
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP.TRIGGER, async () => {
    return await BackupService.executeBackup();
  });

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

  ipcMain.handle(IPC_CHANNELS.ANALYTICS.GET_METRICS, async () => {
    try {
      return await AnalyticsService.getDashboardMetrics();
    } catch (error: any) {
      return { error: error.message };
    }
  });
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});