import './env';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import * as fs from 'fs';

// Services
import { AnalyticsService } from './services/analytics.service';
import { TaxService } from './services/tax.service';
import { BackupService } from './services/backup.service';
import { ReportsService } from './services/reports.service';
import { LedgerService } from './services/ledger.service';
import { ExportService } from './services/export.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { AuditService } from './services/audit.service';
import { PayrollService } from './services/payroll.service';
import { InventoryService } from './services/inventory.service';

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200, height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false
        },
    });

    const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devServerUrl) mainWindow.loadURL(devServerUrl);
    else mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
    createWindow();

    // Auth & Users
    ipcMain.handle('auth:login', async (e, username, password) => { try { const result = await AuthService.login(username, password); if (result.id) await AuditService.logAction(result.id, "USER LOGIN", `User ${username} logged in.`); return { success: true, data: result }; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-users', async () => { try { return typeof UserService.getAllUsers === 'function' ? await UserService.getAllUsers() : []; } catch (err) { return []; } });
    ipcMain.handle('create-user', async (e, userData) => { try { const result = { success: true, data: await UserService.createUser(userData) }; await AuditService.logAction('SYSTEM', 'CREATE USER', `Created user: ${userData.username}`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('toggle-user-status', async (e, userId, isActive) => { try { await UserService.toggleUserStatus(userId, isActive); await AuditService.logAction('SYSTEM', 'USER ACCESS', `Changed status for ID: ${userId} to ${isActive}`); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('reset-user-password', async (e, userId, newPassword) => { try { await UserService.resetPassword(userId, newPassword); await AuditService.logAction('SYSTEM', 'SECURITY', `Reset password for ID: ${userId}`); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('update-user-permissions', async (e, id, perms) => { try { await UserService.updateUserPermissions(id, perms); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-petty-cash-balance', async () => { try { return typeof UserService.getPettyCashBalance === 'function' ? await UserService.getPettyCashBalance() : 0; } catch (err) { return 0; } });

    // Ledger & Payees
    ipcMain.handle('ledger:getAccounts', async () => { try { return await LedgerService.getAccounts(); } catch (err) { return []; } });
    ipcMain.handle('ledger:getAccountTypes', async () => { try { return typeof LedgerService.getAccountTypes === 'function' ? await LedgerService.getAccountTypes() : []; } catch (err) { return []; } });
    ipcMain.handle('ledger:createAccount', async (e, data) => { try { const result = typeof LedgerService.createAccount === 'function' ? await LedgerService.createAccount(data) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Added COA: ${data.code}`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-payees', async (e, typeFilter) => { try { return await LedgerService.getPayees(typeFilter); } catch (err) { return []; } });
    ipcMain.handle('create-payee', async (e, name: string, type: string, tin?: string, email?: string, phone?: string, address?: string) => { const result = await LedgerService.createPayee(name, type, tin, email, phone, address); if (result.success) await AuditService.logAction('SYSTEM', 'CREATE CONTACT', `Added ${type}: ${name}`); return result; });
    ipcMain.handle('import-payees', async (e, data) => { try { const result = typeof LedgerService.importPayees === 'function' ? await LedgerService.importPayees(data) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'IMPORT CONTACTS', `Imported ${result.count} contacts.`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-payee-balance', async (e, payeeId: string) => { return await LedgerService.getPayeeBalance(payeeId); });
    ipcMain.handle('update-payee-tin', async (e, payeeId: string, tin: string) => { try { await LedgerService.updatePayeeTin(payeeId, tin); await AuditService.logAction('SYSTEM', 'UPDATE CONTACT', `Updated TIN for ID: ${payeeId}`); return { success: true }; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-contacts-with-balances', async () => { try { return typeof LedgerService.getContactsWithBalances === 'function' ? await LedgerService.getContactsWithBalances() : []; } catch (err) { return []; } });

    // Services
    ipcMain.handle('get-all-service-items', async () => { try { return typeof LedgerService.getAllServiceItems === 'function' ? await LedgerService.getAllServiceItems() : []; } catch (err) { return []; } });
    ipcMain.handle('get-service-items', async () => { try { return typeof LedgerService.getServiceItems === 'function' ? await LedgerService.getServiceItems() : []; } catch (err) { return []; } });
    ipcMain.handle('create-service-item', async (e, data) => { try { const result = typeof LedgerService.createServiceItem === 'function' ? await LedgerService.createServiceItem(data) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Added procedure: ${data.name}`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('update-service-item', async (e, id, data) => { try { const result = typeof LedgerService.updateServiceItem === 'function' ? await LedgerService.updateServiceItem(id, data) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Updated procedure ID: ${id}`); return result; } catch (err: any) { return { success: false, error: err.message }; } });

    // Journal Entries
    ipcMain.handle('ledger:submitEntry', async (e, entryData) => { try { const result = await LedgerService.createJournalEntry(entryData); await AuditService.logAction(entryData.userId || 'SYSTEM', "CREATED TRANSACTION", `Posted ref ${entryData.referenceNo}`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('ledger:getAccountLedger', async (e, accountId) => { try { return await LedgerService.getAccountLedger(accountId); } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('get-next-sequence', async (e, prefix: string) => { try { return typeof LedgerService.getNextReferenceSequence === 'function' ? await LedgerService.getNextReferenceSequence(prefix) : '001'; } catch (err) { return '001'; } });
    ipcMain.handle('get-payout-history', async () => { try { return await LedgerService.getPayoutHistory(); } catch (err) { return []; } });
    ipcMain.handle('get-full-ledger-report', async (e, startDate, endDate) => { try { return await LedgerService.getFullLedgerReport(startDate, endDate); } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('ledger:getAllJournalEntries', async () => { try { return await LedgerService.getAllJournalEntries(); } catch (error) { return []; } });
    ipcMain.handle(
        'get-user-sales-history',
        async (e, userId) => {
            try {

                console.log(
                    '[IPC] get-user-sales-history:',
                    userId
                );

                const result =
                    await LedgerService.getUserSalesHistory(
                        userId
                    );

                return {
                    success: true,
                    data: result
                };

            } catch (err: any) {

                console.error(
                    '[IPC] Transaction history error:',
                    err
                );

                return {
                    success: false,
                    error:
                        err.message ||
                        'Unable to load transaction history.',
                    data: []
                };
            }
        }
    );

    // Bank Reconciliation
    ipcMain.handle('get-bank-accounts', async () => { try { return typeof LedgerService.getBankAccounts === 'function' ? await LedgerService.getBankAccounts() : []; } catch (err) { return []; } });
    ipcMain.handle('create-bank-account', async (e, data) => { try { const result = typeof LedgerService.createBankAccount === 'function' ? await LedgerService.createBankAccount(data) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'BANK SETUP', `Created bank: ${data.name}`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-reconciliation-data', async (e, bankAccountId, startDate, endDate) => { try { return typeof LedgerService.getReconciliationData === 'function' ? await LedgerService.getReconciliationData(bankAccountId, startDate, endDate) : { transactions: [], entries: [] }; } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('create-bank-transaction', async (e, data) => { try { const result = typeof LedgerService.createBankTransaction === 'function' ? { success: true, data: await LedgerService.createBankTransaction(data) } : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'BANK RECORD', `Added bank transaction`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('import-bank-transactions', async (e, data) => { try { const result = typeof LedgerService.importBankTransactions === 'function' ? await LedgerService.importBankTransactions(data) : { success: false }; if (result.success) await AuditService.logAction(data.userId || 'SYSTEM', 'BANK IMPORT', `Imported bank transactions`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('match-bank-transaction', async (e, bankTxId, journalId, userId) => { try { const result = typeof LedgerService.matchBankTransaction === 'function' ? await LedgerService.matchBankTransaction(bankTxId, journalId, userId) : { success: false }; if (result.success) await AuditService.logAction(userId || 'SYSTEM', 'RECONCILIATION', `Matched transaction`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('unmatch-bank-transaction', async (e, bankTxId) => { try { const result = typeof LedgerService.unmatchBankTransaction === 'function' ? await LedgerService.unmatchBankTransaction(bankTxId) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'RECONCILIATION', `Unmatched transaction`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('remove-bank-transaction', async (e, bankTxId, userId) => { try { const result = typeof LedgerService.removeBankTransaction === 'function' ? await LedgerService.removeBankTransaction(bankTxId, userId) : { success: false }; if (result.success) await AuditService.logAction(userId || 'SYSTEM', 'BANK RECORD', `Removed bank transaction`); return result; } catch (err: any) { return { success: false, error: err.message }; } });

    // Inventory
    ipcMain.handle('get-inventory-items', async () => { try { return typeof InventoryService.getItems === 'function' ? await InventoryService.getItems() : []; } catch (err) { return []; } });
    ipcMain.handle('create-inventory-item', async (e, data) => { try { return typeof InventoryService.createItem === 'function' ? await InventoryService.createItem(data) : { success: false }; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('get-inventory-logs', async (e, itemId) => { try { return typeof InventoryService.getLogs === 'function' ? await InventoryService.getLogs(itemId) : []; } catch (err) { return []; } });
    ipcMain.handle('add-inventory-log', async (e, data) => { try { const result = typeof InventoryService.addLog === 'function' ? await InventoryService.addLog(data) : { success: false }; if (result.success) await AuditService.logAction(data.userId || 'SYSTEM', 'INVENTORY', `Updated stock`); return result; } catch (err: any) { return { success: false, error: err.message }; } });

    // Voids
    ipcMain.handle('request-void', async (e, id, reason) => { try { await LedgerService.requestVoid(id, reason); await AuditService.logAction('SYSTEM', "VOID REQUESTED", `Void requested`); return { success: true }; } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('get-pending-voids', async () => { try { return await LedgerService.getPendingVoids(); } catch (err: any) { return []; } });
    ipcMain.handle('reject-void', async (e, id) => { try { await LedgerService.rejectVoid(id); await AuditService.logAction('SYSTEM', "VOID REJECTED", `Void rejected`); return { success: true }; } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('approve-void', async (e, id, managerId) => { try { const result = await LedgerService.approveVoid(id, managerId); await AuditService.logAction(managerId || 'SYSTEM', "VOID APPROVED", `Approved void`); return result; } catch (err: any) { return { error: err.message }; } });

    // Reports
    ipcMain.handle('reports:getTrialBalance', async (event, year, month) => { try { let endDate; if (year && month) endDate = new Date(year, month, 0, 23, 59, 59); return await ReportsService.getTrialBalance(undefined, endDate); } catch (error: any) { return { error: error.message }; } });
    ipcMain.handle('reports:getIncomeStatement', async (event, year, month) => { try { return await ReportsService.getIncomeStatement(year, month); } catch (error: any) { return { error: error.message }; } });
    ipcMain.handle('reports:getBalanceSheet', async (event, year, month) => { try { return await ReportsService.getBalanceSheet(year, month); } catch (error: any) { return { error: error.message }; } });
    ipcMain.handle('reports:getCashFlowStatement', async (event, year, month) => { try { return typeof ReportsService.getCashFlowStatement === 'function' ? await ReportsService.getCashFlowStatement(year, month) : { error: "Missing backend function" }; } catch (error: any) { return { error: error.message }; } });
    ipcMain.handle('get-books-of-accounts', async (e, bookType, startDate, endDate) => { try { return await ReportsService.getBooksOfAccounts(bookType, startDate, endDate); } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('get-shift-report', async (e, userId) => { try { return await ReportsService.getShiftReport(userId); } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('get-aged-receivables', async () => { try { return await ReportsService.getAgedReceivables(); } catch (err: any) { return []; } });
    ipcMain.handle('get-invoice-tracker', async () => { try { return typeof ReportsService.getInvoiceTracker === 'function' ? await ReportsService.getInvoiceTracker() : []; } catch (err: any) { return []; } });

    // Payroll
    ipcMain.handle('get-employees', async () => { try { return typeof PayrollService.getEmployees === 'function' ? await PayrollService.getEmployees() : []; } catch (err) { return []; } });
    ipcMain.handle('create-employee', async (e, data) => { try { const result = typeof PayrollService.createEmployee === 'function' ? await PayrollService.createEmployee(data) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'HR RECORD', `Created employee`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('process-payroll', async (e, data) => { try { const result = typeof PayrollService.processPayroll === 'function' ? await PayrollService.processPayroll(data) : { success: false }; if (result.success) await AuditService.logAction(data.userId || 'SYSTEM', 'PAYROLL PROCESSED', `Processed payroll`); return result; } catch (err: any) { return { success: false, error: err.message }; } });
    ipcMain.handle('toggle-employee-status', async (e, id, isActive) => { try { const result = typeof PayrollService.toggleEmployeeStatus === 'function' ? await PayrollService.toggleEmployeeStatus(id, isActive) : { success: false }; if (result.success) await AuditService.logAction('SYSTEM', 'HR RECORD', `Changed employee status`); return result; } catch (err: any) { return { success: false, error: err.message }; } });

    // 🔥 RESTORED PAYROLL HISTORY HANDLER!
    ipcMain.handle('get-payroll-history', async () => { try { return typeof PayrollService.getPayrollHistory === 'function' ? await PayrollService.getPayrollHistory() : []; } catch (err) { return []; } });

    // Exporters
    ipcMain.handle('export:trialBalanceExcel', async (event, year, month) => { try { const result = await ExportService.exportTrialBalanceToExcel(year, month); await AuditService.logAction('SYSTEM', 'DATA EXPORT', `Exported Trial Balance`); return result; } catch (error: any) { return { success: false, error: error.message }; } });
    ipcMain.handle('export:printToPDF', async (event, filename: string) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return { success: false, error: 'Window not found' };
        const { filePath } = await dialog.showSaveDialog({ title: 'Save PDF Report', defaultPath: filename, filters: [{ name: 'PDF Documents', extensions: ['pdf'] }] });
        if (!filePath) return { success: false, error: 'Export cancelled' };
        try {
            await win.webContents.insertCSS(`@media print { aside, header, button, .no-print { display: none !important; } #app, div.flex.h-screen, main { height: auto !important; overflow: visible !important; } html, body { background-color: white !important; } }`);
            await new Promise(resolve => setTimeout(resolve, 100));
            const data = await win.webContents.printToPDF({ margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }, printBackground: true, pageSize: 'A4', landscape: false });
            fs.writeFileSync(filePath, data);
            await AuditService.logAction('SYSTEM', 'REPORT GENERATED', `Generated PDF`);
            return { success: true, filePath };
        } catch (error: any) { return { success: false, error: error.message }; }
    });

    // Tax
    ipcMain.handle('tax:generate2550Q', async (e, year, quarter) => { try { const result = typeof TaxService.generate2550Q === 'function' ? await TaxService.generate2550Q(year, quarter) : { error: "Backend function missing" }; await AuditService.logAction('SYSTEM', 'TAX COMPLIANCE', `Generated BIR Form 2550Q`); return result; } catch (err: any) { return { error: err.message }; } });
    ipcMain.handle('tax:generateRelief', async (e, year, quarter) => { try { const result = typeof TaxService.generateReliefAnnexes === 'function' ? await TaxService.generateReliefAnnexes(year, quarter) : { error: "Backend function missing" }; await AuditService.logAction('SYSTEM', 'TAX COMPLIANCE', `Generated BIR RELIEF`); return result; } catch (err: any) { return { error: err.message }; } });

    // Analytics & Backups
    ipcMain.handle('analytics:getMetrics', async (event, timeframe?: string) => { try { return await AnalyticsService.getDashboardMetrics(timeframe as any); } catch (error: any) { return { error: error.message }; } });
    ipcMain.handle('backup:triggerBackup', async () => { const result = await BackupService.executeBackup(); if (result.success) await AuditService.logAction('SYSTEM', 'SYSTEM BACKUP', `Generated backup`); return result; });
    ipcMain.handle('log-action', async (e, userId, action, details) => { return await AuditService.logAction(userId, action, details); });
    ipcMain.handle('get-audit-logs', async (e, startDate, endDate) => { try { return await AuditService.getAuditLogs(startDate, endDate); } catch (err: any) { return []; } });
    ipcMain.handle('get-today-stats', async () => { try { return await AnalyticsService.getTodayStats(); } catch (err) { return { sales: 0, payments: 0, transactions: 0 }; } });
    ipcMain.handle('get-recent-transactions', async () => { try { return await AnalyticsService.getRecentTransactions(); } catch (err) { return []; } });

    // Network Settings
    ipcMain.handle('config:getServerIp', () => {
        const configPath = path.join(app.getPath('userData'), 'server-config.json');
        if (fs.existsSync(configPath)) { const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); return config.serverIp || 'localhost'; }
        return 'localhost';
    });

    ipcMain.handle('update-reference-number', async (e, entryId, newRef) => {
        try {
            const result = typeof LedgerService.updateReferenceNumber === 'function' ? await LedgerService.updateReferenceNumber(entryId, newRef) : { success: false };
            if (result.success) await AuditService.logAction('SYSTEM', 'EDIT TRANSACTION', `Changed reference number to ${newRef} for entry ID: ${entryId}`);
            return result;
        } catch (err: any) { return { success: false, error: err.message }; }
    });
    ipcMain.handle('config:setServerIp', async (event, ip: string) => {
        const configPath = path.join(app.getPath('userData'), 'server-config.json');
        fs.writeFileSync(configPath, JSON.stringify({ serverIp: ip }));
        await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `LAN IP updated to: ${ip}`);
        if (app.isPackaged) { app.relaunch(); app.exit(0); return { success: true, restarted: true }; } else { return { success: true, restarted: false }; }
    });
    ipcMain.handle('system:ping', async () => { return await AuthService.pingDatabase(); });

    console.log("✅ ALL HANDLERS REGISTERED SUCCESSFULLY");
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });