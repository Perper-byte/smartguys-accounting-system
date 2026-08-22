// src/main/index.ts
import './env';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { AnalyticsService } from './services/analytics.service';
import { TaxService } from './services/tax.service';
import { BackupService } from './services/backup.service';
import { ReportsService } from './services/reports.service';
import { LedgerService } from './services/ledger.service';
import { UserService } from './services/user.service'; 
import { AuditService } from './services/audit.service'; 
import { PayrollService } from './services/payroll.service'; 

import { ExportService } from './services/export.service'; // <-- ADDED EXPORT SERVICE
import path from 'path';
import { AuthService } from './services/auth.service';
import * as fs from 'fs';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';

function createWindow() {
  const mainWindow = new BrowserWindow({
width: 1200,
height: 800,
show: false,
webPreferences: {
  preload: path.join(__dirname, '../preload/index.js'),
  contextIsolation: true, // MANDATORY FOR SECURITY
  nodeIntegration: false,
  sandbox: false
},
  });
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) mainWindow.loadURL(devServerUrl);
  else mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();

//------------------------------------------
  // IPC HANDLERS: React asks, Node.js answers
  //------------------------------------------
  
  // Auth
  ipcMain.handle(IPC_CHANNELS.AUTH.LOGIN, async (e, username, password) => { 
      try { 
          const result = await AuthService.login(username, password); 
          if (result.id) await AuditService.logAction(result.id, "USER LOGIN", `User ${username} logged into the system.`);
          return { success: true, data: result }; 
      } catch (err: any) { 
          return { success: false, error: err.message }; 
      } 
  });

  // User Management & Petty Cash
  ipcMain.handle('create-user', async (e, userData) => { try { return { success: true, data: await UserService.createUser(userData) }; } catch (err: any) { return { success: false, error: err.message }; } });
  ipcMain.handle('get-users', async () => { try { return await UserService.getAllUsers(); } catch (err) { return []; } });
  ipcMain.handle('toggle-user-status', async (e, userId, isActive) => { try { await UserService.toggleUserStatus(userId, isActive); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } });
  ipcMain.handle('reset-user-password', async (e, userId, newPassword) => { try { await UserService.resetPassword(userId, newPassword); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } });
  ipcMain.handle('get-petty-cash-balance', async () => { try { return await UserService.getPettyCashBalance(); } catch (err) { return 0; } });

  // Ledger & Payees
  ipcMain.handle(IPC_CHANNELS.LEDGER.GET_ACCOUNTS, async () => { 
      try { return await LedgerService.getAccounts(); } catch (err) { return []; } 
  });

  ipcMain.handle('get-payees', async (e, typeFilter) => { 
      try { return await LedgerService.getPayees(typeFilter); } catch (err) { return []; } 
  });
  
  ipcMain.handle('create-payee', async (e, name: string, type: string) => { 
      return await LedgerService.createPayee(name, type); 
  });
  
  ipcMain.handle('get-payee-balance', async (e, payeeId: string) => { 
      return await LedgerService.getPayeeBalance(payeeId); 
  });
  
  ipcMain.handle('update-payee-tin', async (e, payeeId: string, tin: string) => { 
      try { await LedgerService.updatePayeeTin(payeeId, tin); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } 
  });

  ipcMain.handle(IPC_CHANNELS.LEDGER.SUBMIT_ENTRY, async (e, entryData) => { 
      try { 
          const result = await LedgerService.createJournalEntry(entryData); 
          await AuditService.logAction(entryData.userId, "CREATED TRANSACTION", `Posted reference ${entryData.referenceNo}: ${entryData.description}`);
          return result;
      } catch (err: any) { 
          return { success: false, error: err.message }; 
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
  });
  
  ipcMain.handle(IPC_CHANNELS.LEDGER.GET_LEDGER, async (e, accountId) => { try { return await LedgerService.getAccountLedger(accountId); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle('get-next-sequence', async (e, prefix: string) => { try { return await LedgerService.getNextReferenceSequence(prefix); } catch (err) { return '001'; } });
  ipcMain.handle('get-payout-history', async () => { try { return await LedgerService.getPayoutHistory(); } catch (err) { return []; } });
  ipcMain.handle('get-full-ledger-report', async (e, startDate, endDate) => { try { return await LedgerService.getFullLedgerReport(startDate, endDate); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle('request-void', async (e, id, reason) => { try { await LedgerService.requestVoid(id, reason); return { success: true }; } catch(err:any) { return { error: err.message }; } });
  ipcMain.handle('get-pending-voids', async () => { try { return await LedgerService.getPendingVoids(); } catch(err:any) { return []; } });
  ipcMain.handle('reject-void', async (e, id) => { try { await LedgerService.rejectVoid(id); return { success: true }; } catch(err:any) { return { error: err.message }; } });
  ipcMain.handle('approve-void', async (e, id, managerId) => { 
      try { 
          const result = await LedgerService.approveVoid(id, managerId); 
          await AuditService.logAction(managerId, "APPROVED VOID", `Approved void request and generated reversal entry for ID: ${id}`);
          return result;
      } catch(err:any) { return { error: err.message }; } 
  });
  ipcMain.handle('get-user-sales-history', async (e, userId) => { try { return await LedgerService.getUserSalesHistory(userId); } catch (err) { return []; } });

  // Payroll
  ipcMain.handle('get-employees', async () => { try { return await PayrollService.getEmployees(); } catch (err) { return []; } });
  ipcMain.handle('create-employee', async (e, data) => { return await PayrollService.createEmployee(data); });
  ipcMain.handle('process-payroll', async (e, data) => { return await PayrollService.processPayroll(data); });

  ipcMain.handle('get-books-of-accounts', async (e, bookType, startDate, endDate) => { try { return await ReportsService.getBooksOfAccounts(bookType, startDate, endDate); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle(IPC_CHANNELS.REPORTS.TRIAL_BALANCE, async (e, start, end) => { try { return await ReportsService.getTrialBalance(start, end); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle(IPC_CHANNELS.REPORTS.INCOME_STATEMENT, async (e, start, end) => { try { return await ReportsService.getIncomeStatement(start, end); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle(IPC_CHANNELS.REPORTS.BALANCE_SHEET, async (e, start, end) => { try { return await ReportsService.getBalanceSheet(start, end); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle('get-shift-report', async (e, userId) => { try { return await ReportsService.getShiftReport(userId); } catch (err: any) { return { error: err.message }; } });
  ipcMain.handle('get-aged-receivables', async () => { try { return await ReportsService.getAgedReceivables(); } catch (err: any) { return []; } });
  
  ipcMain.handle('log-action', async (e, userId, action, details) => { return await AuditService.logAction(userId, action, details); });
  ipcMain.handle('get-audit-logs', async (e, startDate, endDate) => { try { return await AuditService.getAuditLogs(startDate, endDate); } catch (err: any) { return []; } });

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

    if (app.isPackaged) {
      // In the final .exe, automatically restart the system seamlessly
      app.relaunch();
      app.exit(0);
      return { success: true, restarted: true };
    } else {
      // In Developer Mode, DO NOT restart (to protect the Vite server)
      return { success: true, restarted: false };
    }
  });

  ipcMain.handle('ledger:getAllJournalEntries', async () => {
    try {
      return await LedgerService.getAllJournalEntries();
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  ipcMain.handle('system:ping', async () => {
    return await AuthService.pingDatabase();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});