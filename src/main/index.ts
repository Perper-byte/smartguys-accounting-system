// src/main/main.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import './env'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import * as fs from 'fs'
import cron from 'node-cron'
import net from 'net'
import bcrypt from 'bcrypt'
const OFFLINE_QUEUE_PATH = path.join(app.getPath('userData'), 'offline-transactions.json')
const CACHE_ACCOUNTS_PATH = path.join(app.getPath('userData'), 'cache-accounts.json')
const CACHE_PAYEES_PATH = path.join(app.getPath('userData'), 'cache-payees.json')
const CACHE_USERS_PATH = path.join(app.getPath('userData'), 'cache-users.json')

// Services
import { AnalyticsService } from './services/analytics.service'
import { TaxService } from './services/tax.service'
import { BackupService } from './services/backup.service'
import { ReportsService } from './services/reports.service'
import { LedgerService } from './services/ledger.service'
import { ExportService } from './services/export.service'
import { AuthService } from './services/auth.service'
import { UserService } from './services/user.service'
import { AuditService } from './services/audit.service'
import { PayrollService } from './services/payroll.service'
import { InventoryService } from './services/inventory.service'
import { cleanDescription as cleanDescHelper } from '../shared/formatters'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setMenu(null);

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) mainWindow.loadURL(devServerUrl)
  else mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  mainWindow.once('ready-to-show', () => mainWindow.show())
}

app.whenReady().then(() => {
  createWindow()
  prisma.$executeRawUnsafe("SET GLOBAL max_allowed_packet = 67108864;").catch(() => {})

  // Auth & Users
  ipcMain.handle('auth:login', async (e, username, password) => {
    try {
      // 1. Try online login first
      const result = await AuthService.login(username, password)
      if (result.id) {
        await AuditService.logAction(result.id, 'USER LOGIN', `User ${username} logged in.`)

        // 2. Update Local Cache for Offline Login capability
        let offlineUsers: any = {};
        if (fs.existsSync(CACHE_USERS_PATH)) {
          try {
            offlineUsers = JSON.parse(fs.readFileSync(CACHE_USERS_PATH, 'utf-8'));
          } catch {
            offlineUsers = {};
          }
        }
        // Securely hash with bcrypt - never store plaintext passwords
        const passwordHash = await bcrypt.hash(password, 12);
        offlineUsers[username] = { passwordHash, data: result };
        fs.writeFileSync(CACHE_USERS_PATH, JSON.stringify(offlineUsers, null, 2));
      }
      return { success: true, data: result }

    } catch (err: any) {
      // 3. 🚨 DETECT OFFLINE NETWORK ERROR
      const isOffline = err.message.includes("Can't reach") || err.message.includes("P1001") || err.message.includes("timeout") || err.message.includes("network");

      if (isOffline && fs.existsSync(CACHE_USERS_PATH)) {
        let offlineUsers: any = {};
        try {
          offlineUsers = JSON.parse(fs.readFileSync(CACHE_USERS_PATH, 'utf-8'));
        } catch {
          offlineUsers = {};
        }

        const cached = offlineUsers[username];
        if (cached) {
          let match = false;
          if (cached.passwordHash) {
            match = await bcrypt.compare(password, cached.passwordHash);
          } else if (cached.password) {
            // Legacy plaintext fallback - immediately migrate to bcrypt hash
            match = (cached.password === password);
            if (match) {
              cached.passwordHash = await bcrypt.hash(password, 12);
              delete cached.password;
              fs.writeFileSync(CACHE_USERS_PATH, JSON.stringify(offlineUsers, null, 2));
            }
          }

          if (match) {
            console.log(`[OFFLINE MODE] User ${username} logged in via local cache.`);
            return { success: true, data: cached.data, offline: true };
          }
        }
        return { success: false, error: "Network offline. Invalid credentials or user not cached locally." };
      }
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-users', async () => {
    try {
      return typeof UserService.getAllUsers === 'function' ? await UserService.getAllUsers() : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('create-user', async (e, userData, adminUser = 'SYSTEM') => {
    try {
      const result = { success: true, data: await UserService.createUser(userData) }
      // 🔥 Fixed: Uses adminUser
      await AuditService.logAction(adminUser, 'CREATE USER', `Created user: ${userData.username}`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // (Keeping restore-payee and archive-payee unchanged as they are between the user functions)
  ipcMain.handle('restore-payee', async (_, payeeId: string) => { 
    try { 
        const result = await LedgerService.restorePayee(payeeId); 
        await AuditService.logAction('SYSTEM', 'RESTORE CONTACT', `Restored contact ID: ${payeeId}`); 
        return result; 
    } catch (error: any) { return { success: false, error: error.message }; } 
  });

  ipcMain.handle('archive-payee', async (_, payeeId: string) => { 
    try { 
        const result = await LedgerService.archivePayee(payeeId); 
        await AuditService.logAction('SYSTEM', 'ARCHIVE CONTACT', `Archived contact ID: ${payeeId}`); 
        return result; 
    } catch (error: any) { return { success: false, error: error.message }; } 
  });

  ipcMain.handle('toggle-user-status', async (e, userId, isActive, adminUser = 'SYSTEM') => {
    try {
      await UserService.toggleUserStatus(userId, isActive)
      // 🔥 Fixed: Uses adminUser
      await AuditService.logAction(
        adminUser,
        'USER ACCESS',
        `Changed status for ID: ${userId} to ${isActive}`
      )
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('reset-user-password', async (e, userId, newPassword, adminUser = 'SYSTEM') => {
    try {
      await UserService.resetPassword(userId, newPassword)
      // 🔥 Fixed: Uses adminUser
      await AuditService.logAction(adminUser, 'SECURITY', `Reset password for ID: ${userId}`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('update-user-permissions', async (e, id, perms, adminUser = 'SYSTEM') => {
    try {
      await UserService.updateUserPermissions(id, perms)
      // 🔥 Fixed: Added an Audit Log entry for changing permissions and using adminUser
      await AuditService.logAction(adminUser, 'SECURITY', `Updated permissions for ID: ${id}`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('get-petty-cash-balance', async () => {
    try {
      return typeof UserService.getPettyCashBalance === 'function'
        ? await UserService.getPettyCashBalance()
        : 0
    } catch (err) {
      return 0
    }
  })

  // Ledger & Payees
  ipcMain.handle('ledger:getAccounts', async () => {
    try {
      const accounts = await LedgerService.getAccounts()
      // If successful, save a local copy for offline use
      fs.writeFileSync(CACHE_ACCOUNTS_PATH, JSON.stringify(accounts))
      return accounts
    } catch (err) {
      // 🚨 IF OFFLINE: Read from the local cache!
      if (fs.existsSync(CACHE_ACCOUNTS_PATH)) {
        return JSON.parse(fs.readFileSync(CACHE_ACCOUNTS_PATH, 'utf-8'))
      }
      return []
    }
  })
  ipcMain.handle('ledger:getAccountTypes', async () => {
    try {
      return typeof LedgerService.getAccountTypes === 'function'
        ? await LedgerService.getAccountTypes()
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('ledger:createAccount', async (e, data) => {
    try {
      const result =
        typeof LedgerService.createAccount === 'function'
          ? await LedgerService.createAccount(data)
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Added COA: ${data.code}`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('get-payees', async (e, typeFilter) => {
    try {
      const payees = await LedgerService.getPayees(typeFilter)
      // If successful, save a local copy for offline use
      fs.writeFileSync(CACHE_PAYEES_PATH, JSON.stringify(payees))
      return payees
    } catch (err) {
      // 🚨 IF OFFLINE: Read from the local cache!
      if (fs.existsSync(CACHE_PAYEES_PATH)) {
        let cached = JSON.parse(fs.readFileSync(CACHE_PAYEES_PATH, 'utf-8'))
        if (typeFilter) cached = cached.filter((p: any) => p.type === typeFilter)
        return cached
      }
      return []
    }
  })
  ipcMain.handle(
    'create-payee',
    async (
      e,
      name: string,
      type: string,
      tin?: string,
      email?: string,
      phone?: string,
      address?: string,
      hmo?: string,
      hmoCardNo?: string,
      hmoExpiryDate?: string
    ) => {
      const result = await LedgerService.createPayee(
        name,
        type,
        tin,
        email,
        phone,
        address,
        hmo,
        hmoCardNo,
        hmoExpiryDate
      )
      if (result.success) {
        const hmoLog = hmo ? ` (Linked to HMO: ${hmo})` : ''
        await AuditService.logAction(
          'SYSTEM',
          'CREATE CONTACT',
          `Added new ${type}: ${name}${hmoLog}`
        )
      }
      return result
    }
  )
  ipcMain.handle('import-payees', async (e, data) => {
    try {
      const result =
        typeof LedgerService.importPayees === 'function'
          ? await LedgerService.importPayees(data)
          : { success: false }
      if (result.success)
        await AuditService.logAction(
          'SYSTEM',
          'IMPORT CONTACTS',
          `Imported ${(result as any).count ?? 0} contacts.`
        )
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('get-payee-balance', async (e, payeeId: string) => {
    return await LedgerService.getPayeeBalance(payeeId)
  })
  ipcMain.handle('update-payee-tin', async (_, payeeId: string, tin: string) => {
    try {
      const result = await LedgerService.updatePayeeTin(payeeId, tin)
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  ipcMain.handle('get-contacts-with-balances', async () => {
    try {
      return typeof LedgerService.getContactsWithBalances === 'function'
        ? await LedgerService.getContactsWithBalances()
        : []
    } catch (err) {
      return []
    }
  })

  ipcMain.handle('update-payee', async (_, id: string, data: any) => {
    try {
      await prisma.payee.update({
        where: { id },
        data: {
          name: data.name,
          type: data.type,
          email: data.email || null,
          phone_number: data.phone || null,
          tin: data.tin || null,
          address: data.address || null,
          hmo_affiliation: data.hmo || null,
          hmo_card_no: data.hmoCardNo || null,
          hmo_expiry_date: data.hmoExpiryDate ? new Date(data.hmoExpiryDate) : null
        }
      })
      await AuditService.logAction('SYSTEM', 'EDIT CONTACT', `Updated contact details for: ${data.name}`)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Services
  ipcMain.handle('get-all-service-items', async () => {
    try {
      return typeof LedgerService.getAllServiceItems === 'function'
        ? await LedgerService.getAllServiceItems()
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('get-service-items', async () => {
    try {
      return typeof LedgerService.getServiceItems === 'function'
        ? await LedgerService.getServiceItems()
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('create-service-item', async (e, data) => {
    try {
      const result =
        typeof LedgerService.createServiceItem === 'function'
          ? await LedgerService.createServiceItem(data)
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Added procedure: ${data.name}`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('update-service-item', async (e, id, data) => {
    try {
      const result =
        typeof LedgerService.updateServiceItem === 'function'
          ? await LedgerService.updateServiceItem(id, data)
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Updated procedure ID: ${id}`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Journal Entries
  ipcMain.handle('ledger:submitEntry', async (e, entryData) => {
    try {
      const result = await LedgerService.createJournalEntry(entryData)
      await AuditService.logAction(
        entryData.userId || 'SYSTEM',
        'CREATED TRANSACTION',
        `Posted ref ${entryData.referenceNo}`
      )
      return result
    } catch (err: any) {
      // 🚨 DETECT OFFLINE NETWORK ERROR
      const isOffline =
        err.message.includes("Can't reach") ||
        err.message.includes('P1001') ||
        err.message.includes('timeout') ||
        err.message.includes('network')

      if (isOffline) {
        // Save to local Windows hard drive queue
        let queue: any[] = []
        if (fs.existsSync(OFFLINE_QUEUE_PATH)) {
          queue = JSON.parse(fs.readFileSync(OFFLINE_QUEUE_PATH, 'utf-8'))
        }
        queue.push(entryData)
        fs.writeFileSync(OFFLINE_QUEUE_PATH, JSON.stringify(queue, null, 2))

        console.log(`[OFFLINE MODE] Saved transaction ${entryData.referenceNo} locally.`)

        // Return success so the Cashier's UI clears and they can help the next patient
        return {
          success: true,
          offline: true,
          message:
            'Network offline. Transaction secured locally. It will auto-sync when connection restores.'
        }
      }

      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('ledger:getAccountLedger', async (e, accountId) => {
    try {
      return await LedgerService.getAccountLedger(accountId)
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('get-next-sequence', async (e, prefix: string) => {
    try {
      return typeof LedgerService.getNextReferenceSequence === 'function'
        ? await LedgerService.getNextReferenceSequence(prefix)
        : '001'
    } catch (err) {
      return '001'
    }
  })
  ipcMain.handle('get-payout-history', async () => {
    try {
      return await LedgerService.getPayoutHistory()
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('get-cashier-disbursements', async (e, limit = 100) => {
    try {
      return typeof LedgerService.getCashierDisbursements === 'function'
        ? await LedgerService.getCashierDisbursements(limit)
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('get-recent-disbursements', async (e, limit = 20) => {
    try {
      return typeof LedgerService.getRecentDisbursements === 'function'
        ? await LedgerService.getRecentDisbursements(limit)
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('get-full-ledger-report', async (e, startDate, endDate) => {
    try {
      return await LedgerService.getFullLedgerReport(startDate, endDate)
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('ledger:getAllJournalEntries', async () => {
    try {
      return await LedgerService.getAllJournalEntries()
    } catch (error) {
      return []
    }
  })
  ipcMain.handle('get-user-sales-history', async (e, userId) => {
    try {
      const result = await LedgerService.getUserSalesHistory(userId)
      return { success: true, data: result }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unable to load transaction history.',
        data: []
      }
    }
  })

  // Bank Reconciliation
  ipcMain.handle('get-bank-accounts', async () => {
    try {
      return typeof LedgerService.getBankAccounts === 'function'
        ? await LedgerService.getBankAccounts()
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('create-bank-account', async (e, data) => {
    try {
      const result =
        typeof LedgerService.createBankAccount === 'function'
          ? await LedgerService.createBankAccount(data)
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'BANK SETUP', `Created bank: ${data.name}`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('get-reconciliation-data', async (e, bankAccountId, startDate, endDate) => {
    try {
      return typeof LedgerService.getReconciliationData === 'function'
        ? await LedgerService.getReconciliationData(bankAccountId, startDate, endDate)
        : { transactions: [], entries: [] }
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('create-bank-transaction', async (e, data) => {
    try {
      const result =
        typeof LedgerService.createBankTransaction === 'function'
          ? { success: true, data: await LedgerService.createBankTransaction(data) }
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'BANK RECORD', `Added bank transaction`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('import-bank-transactions', async (e, data) => {
    try {
      const result =
        typeof LedgerService.importBankTransactions === 'function'
          ? await LedgerService.importBankTransactions(data)
          : { success: false }
      if ((result as any).success)
        await AuditService.logAction(
          data.userId || 'SYSTEM',
          'BANK IMPORT',
          `Imported bank transactions`
        )
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('match-bank-transaction', async (e, bankTxId, journalId, userId) => {
    try {
      const result =
        typeof LedgerService.matchBankTransaction === 'function'
          ? await LedgerService.matchBankTransaction(bankTxId, journalId, userId)
          : { success: false }
      if (result.success)
        await AuditService.logAction(userId || 'SYSTEM', 'RECONCILIATION', `Matched transaction`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('unmatch-bank-transaction', async (e, bankTxId) => {
    try {
      const result =
        typeof LedgerService.unmatchBankTransaction === 'function'
          ? await LedgerService.unmatchBankTransaction(bankTxId)
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'RECONCILIATION', `Unmatched transaction`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('remove-bank-transaction', async (e, bankTxId, userId) => {
    try {
      const result =
        typeof LedgerService.removeBankTransaction === 'function'
          ? await LedgerService.removeBankTransaction(bankTxId, userId)
          : { success: false }
      if (result.success)
        await AuditService.logAction(userId || 'SYSTEM', 'BANK RECORD', `Removed bank transaction`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Inventory
  ipcMain.handle('get-inventory-items', async () => {
    try {
      return typeof InventoryService.getItems === 'function'
        ? await InventoryService.getItems()
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('create-inventory-item', async (e, data) => {
    try {
      return typeof InventoryService.createItem === 'function'
        ? await InventoryService.createItem(data)
        : { success: false }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('update-inventory-item', async (e, id, data) => {
    try {
      return typeof InventoryService.updateItem === 'function'
        ? await InventoryService.updateItem(id, data)
        : { success: false }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('delete-inventory-item', async (e, id) => {
    try {
      return typeof InventoryService.deleteItem === 'function'
        ? await InventoryService.deleteItem(id)
        : { success: false }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('get-inventory-logs', async (e, itemId) => {
    try {
      return typeof InventoryService.getLogs === 'function'
        ? await InventoryService.getLogs(itemId)
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('add-inventory-log', async (e, data) => {
    try {
      const result =
        typeof InventoryService.addLog === 'function'
          ? await InventoryService.addLog(data)
          : { success: false }
      if (result.success)
        await AuditService.logAction(data.userId || 'SYSTEM', 'INVENTORY', `Updated stock`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Voids
  ipcMain.handle('request-void', async (e, id, reason) => {
    try {
      await LedgerService.requestVoid(id, reason)
      await AuditService.logAction('SYSTEM', 'VOID REQUESTED', `Void requested`)
      return { success: true }
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('get-pending-voids', async () => {
    try {
      return await LedgerService.getPendingVoids()
    } catch (err: any) {
      return []
    }
  })
  ipcMain.handle('reject-void', async (e, id) => {
    try {
      await LedgerService.rejectVoid(id)
      await AuditService.logAction('SYSTEM', 'VOID REJECTED', `Void rejected`)
      return { success: true }
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('approve-void', async (e, id, managerId, overridePin) => {
    try {
      const result = await LedgerService.approveVoid(id, managerId, overridePin)
      await AuditService.logAction(managerId || 'SYSTEM', 'VOID APPROVED', `Approved void`)
      return result
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Reports
  ipcMain.handle('reports:getTrialBalance', async (event, year, month) => {
    try {
      let endDate
      if (year && month) endDate = new Date(year, month, 0, 23, 59, 59)
      return await ReportsService.getTrialBalance(undefined, endDate)
    } catch (error: any) {
      return { error: error.message }
    }
  })
  ipcMain.handle('reports:getIncomeStatement', async (event, year, month) => {
    try {
      return await ReportsService.getIncomeStatement(year, month)
    } catch (error: any) {
      return { error: error.message }
    }
  })
  ipcMain.handle('reports:getBalanceSheet', async (event, year, month) => {
    try {
      return await ReportsService.getBalanceSheet(year, month)
    } catch (error: any) {
      return { error: error.message }
    }
  })
  ipcMain.handle('reports:getCashFlowStatement', async (event, year, month) => {
    try {
      return typeof ReportsService.getCashFlowStatement === 'function'
        ? await ReportsService.getCashFlowStatement(year, month)
        : { error: 'Missing backend function' }
    } catch (error: any) {
      return { error: error.message }
    }
  })
  ipcMain.handle('get-books-of-accounts', async (e, bookType, startDate, endDate) => {
    try {
      return await ReportsService.getBooksOfAccounts(bookType, startDate, endDate)
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('get-shift-report', async (e, userId) => {
    try {
      return await ReportsService.getShiftReport(userId)
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('get-aged-receivables', async () => {
    try {
      return await ReportsService.getAgedReceivables()
    } catch (err: any) {
      return []
    }
  })
  ipcMain.handle('get-invoice-tracker', async () => {
    try {
      return typeof ReportsService.getInvoiceTracker === 'function'
        ? await ReportsService.getInvoiceTracker()
        : []
    } catch (err: any) {
      return []
    }
  })

  // Payroll
  ipcMain.handle('payroll:getSettings', async () => {
    return await PayrollService.getPayrollSettings()
  })
  ipcMain.handle('payroll:updateSettings', async (e, multipliers) => {
    const result = await PayrollService.updatePayrollSettings(multipliers)
    if (result.success) await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `Updated payroll settings`)
    return result
  })
  ipcMain.handle('payroll:calculateEmployee', async (e, monthlySalary, hours, demerits, allowances, loans) => {
    return await PayrollService.calculateEmployeePayroll(monthlySalary, hours, demerits, allowances, loans)
  })
  ipcMain.handle('payroll:batchCalculate', async (e, employeeInputs) => {
    return await PayrollService.batchCalculatePayroll(employeeInputs)
  })
  ipcMain.handle('get-employees', async () => {
    try {
      return typeof PayrollService.getEmployees === 'function'
        ? await PayrollService.getEmployees()
        : []
    } catch (err) {
      return []
    }
  })
  ipcMain.handle('create-employee', async (e, data) => {
    try {
      const result =
        typeof PayrollService.createEmployee === 'function'
          ? await PayrollService.createEmployee(data)
          : { success: false }
      if (result.success) await AuditService.logAction('SYSTEM', 'HR RECORD', `Created employee`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('process-payroll', async (e, data) => {
    try {
      const result =
        typeof PayrollService.processPayroll === 'function'
          ? await PayrollService.processPayroll(data)
          : { success: false }
      if (result.success)
        await AuditService.logAction(
          data.userId || 'SYSTEM',
          'PAYROLL PROCESSED',
          `Processed payroll`
        )
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('toggle-employee-status', async (e, id, isActive) => {
    try {
      const result =
        typeof PayrollService.toggleEmployeeStatus === 'function'
          ? await PayrollService.toggleEmployeeStatus(id, isActive)
          : { success: false }
      if (result.success)
        await AuditService.logAction('SYSTEM', 'HR RECORD', `Changed employee status`)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('update-employee', async (_, id: string, data: any) => {
    try {
      await prisma.employee.update({
        where: { id: Number(id) },
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          position: data.position,
          monthly_salary: Number(data.monthlySalary),
          tin: data.tin || null,
          sss_no: data.sss || null,
          philhealth_no: data.philhealth || null,
          pagibig_no: data.pagibig || null
        }
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  ipcMain.handle('get-payroll-history', async () => {
    try {
      return typeof PayrollService.getPayrollHistory === 'function'
        ? await PayrollService.getPayrollHistory()
        : []
    } catch (err) {
      return []
    }
  })

  // Exporters
  ipcMain.handle('export:trialBalanceExcel', async (event, year, month) => {
    try {
      const result = await ExportService.exportTrialBalanceToExcel(year, month)
      await AuditService.logAction('SYSTEM', 'DATA EXPORT', `Exported Trial Balance`)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  ipcMain.handle('export:printToPDF', async (event, filename: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'Window not found' }
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save PDF Report',
      defaultPath: filename,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    })
    if (!filePath) return { success: false, error: 'Export cancelled' }
    try {
      await win.webContents.insertCSS(
        `@media print { aside, header, button, .no-print { display: none !important; } #app, div.flex.h-screen, main { height: auto !important; overflow: visible !important; } html, body { background-color: white !important; } }`
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
      const data = await win.webContents.printToPDF({
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
        printBackground: true,
        pageSize: 'A4',
        landscape: false
      })
      fs.writeFileSync(filePath, data)
      await AuditService.logAction('SYSTEM', 'REPORT GENERATED', `Generated PDF`)
      return { success: true, filePath }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Tax
  ipcMain.handle('tax:generate2550Q', async (e, year, quarter) => {
    try {
      const result =
        typeof TaxService.generate2550Q === 'function'
          ? await TaxService.generate2550Q(year, quarter)
          : { error: 'Backend function missing' }
      await AuditService.logAction('SYSTEM', 'TAX COMPLIANCE', `Generated BIR Form 2550Q`)
      return result
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('tax:generateRelief', async (e, year, quarter) => {
    try {
      const result =
        typeof TaxService.generateReliefAnnexes === 'function'
          ? await TaxService.generateReliefAnnexes(year, quarter)
          : { error: 'Backend function missing' }
      await AuditService.logAction('SYSTEM', 'TAX COMPLIANCE', `Generated BIR RELIEF`)
      return result
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('tax:generate0619E', async (e, year, month) => {
    try {
      const result =
        typeof TaxService.generate0619E === 'function'
          ? await TaxService.generate0619E(year, month)
          : { error: 'Backend function missing' }
      await AuditService.logAction('SYSTEM', 'TAX COMPLIANCE', `Generated BIR Form 0619-E`)
      return result
    } catch (err: any) {
      return { error: err.message }
    }
  })
  ipcMain.handle('tax:generate1601EQ', async (e, year, quarter) => {
    try {
      return typeof TaxService.generate1601EQ === 'function'
        ? await TaxService.generate1601EQ(year, quarter)
        : { error: 'Backend function missing' }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Analytics & Backups
  ipcMain.handle('analytics:getMetrics', async (event, timeframe?: string) => {
    try {
      return await AnalyticsService.getDashboardMetrics(timeframe as any)
    } catch (error: any) {
      return { error: error.message }
    }
  })
  ipcMain.handle('backup:triggerBackup', async () => {
    const result = await BackupService.executeBackup()
    if (result.success) await AuditService.logAction('SYSTEM', 'SYSTEM BACKUP', `Generated backup`)
    return result
  })
  ipcMain.handle('backup:restore', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup File to Restore',
      properties: ['openFile'],
      filters: [{ name: 'SQL Dump Files', extensions: ['sql'] }]
    })

    if (!filePaths || filePaths.length === 0) {
      return { success: false, error: 'Restore cancelled by administrator.' }
    }

    const result = await BackupService.executeRestore(filePaths[0])
    if (result.success) {
      await AuditService.logAction('SYSTEM', 'SYSTEM RESTORE', `Database restored from backup`)
    }
    return result
  })
  ipcMain.handle('log-action', async (e, userId, action, details) => {
    return await AuditService.logAction(userId, action, details)
  })
  ipcMain.handle('get-audit-logs', async (e, startDate, endDate) => {
    try {
      return await AuditService.getAuditLogs(startDate, endDate)
    } catch (err: any) {
      return []
    }
  })
  ipcMain.handle('get-today-stats', async () => {
    try {
      return await AnalyticsService.getTodayStats()
    } catch (err) {
      return { sales: 0, payments: 0, transactions: 0 }
    }
  })
  ipcMain.handle('get-recent-transactions', async () => {
    try {
      return await AnalyticsService.getRecentTransactions()
    } catch (err) {
      return []
    }
  })

  ipcMain.handle('get-journal-entry', async (e, id) => {
    try {
      return await prisma.journalEntry.findUnique({
        where: { id },
        include: {
          payee: true,
          lines: { include: { account: true } }
        }
      })
    } catch (err) {
      console.error(err)
      return null
    }
  })

  ipcMain.handle('get-patient-transactions', async (e, args: any) => {
    try {
      const patientId = typeof args === 'string' ? args : (args?.patientId || '')
      let patientName = typeof args === 'object' ? (args?.patientName || '') : ''

      if (!patientName && patientId) {
        const payeeRecord = await prisma.payee.findUnique({ where: { id: patientId } }).catch(() => null)
        if (payeeRecord) {
          patientName = payeeRecord.name
        } else {
          // If not UUID/payee, identifier might be a raw patient name
          patientName = patientId
        }
      }

      const orConditions: any[] = []
      if (patientId && patientId.length > 20) {
        orConditions.push({ payee_id: patientId })
      }
      if (patientName && patientName.trim()) {
        const clean = patientName.trim()
        orConditions.push({ description: { contains: `Patient: ${clean}` } })
        orConditions.push({ description: { contains: clean } })
      }

      if (orConditions.length === 0) {
        return []
      }

      const entries = await prisma.journalEntry.findMany({
        where: {
          AND: [
            {
              NOT: [
                { reference_no: { startsWith: 'JV' } },
                { reference_no: { startsWith: 'ADJ' } },
                { reference_no: { startsWith: 'PJ' } },
                { reference_no: { startsWith: 'PY' } }
              ]
            },
            {
              OR: orConditions
            }
          ]
        },
        orderBy: [
          { date: 'desc' },
          { created_at: 'desc' }
        ],
        include: {
          lines: { include: { account: true } },
          payee: true,
          attachments: true
        }
      })
      
      // Serialize Decimal types to Numbers to avoid IPC cloning errors
      return entries
        .filter((entry) => {
          const ref = (entry.reference_no || '').trim().toUpperCase()
          return !ref.startsWith('JV') && !ref.startsWith('ADJ') && !ref.startsWith('PJ') && !ref.startsWith('PY')
        })
        .map((entry) => {
          let cleanDesc = cleanDescHelper(entry.description)
          let remarks = ''
          const remMatch = cleanDesc.match(/(?:\n|^)Remarks:\s*([\s\S]*?)(?=\nDiagnostic Test|$)/)
          if (remMatch) remarks = remMatch[1].trim()
          return {
            ...entry,
            description: cleanDesc,
            rawDescription: entry.description,
            remarks,
            payeeName: entry.payee?.name || '',
          attachments: (entry.attachments || []).map(a => ({
            id: a.id,
            name: a.fileName,
            type: a.fileType,
            data: a.fileData
          })),
          lines: entry.lines.map(line => ({
            ...line,
            debit: Number(line.debit),
            credit: Number(line.credit)
          }))
        }
      })
    } catch (err) {
      console.error(err)
      return []
    }
  })

  ipcMain.handle('update-pos-transaction', async (e, entryData) => {
    try {
      const result = await LedgerService.updateJournalEntry(entryData.id, entryData)
      if (result && (result as any).success === false) {
        return result
      }
      return {
        success: true,
        referenceNo: (result as any)?.referenceNo || (result as any)?.reference_no || entryData.referenceNo,
        entryId: (result as any)?.entryId || (result as any)?.id || entryData.id
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('verify-manager-pin', async (e, pin: string) => {
    try {
      return await LedgerService.verifyManagerPin(pin)
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('get-all-recent-transactions', async () => {
    try {
      // Returns all POS transactions (or at least a large recent chunk for the client to filter)
      const entries = await prisma.journalEntry.findMany({
        where: {
          NOT: [
            { reference_no: { startsWith: 'JV' } },
            { reference_no: { startsWith: 'ADJ' } },
            { reference_no: { startsWith: 'PJ' } },
            { reference_no: { startsWith: 'PY' } }
          ]
        },
        orderBy: [
          { date: 'desc' },
          { created_at: 'desc' }
        ],
        take: 2000,
        include: {
          payee: true,
          lines: { include: { account: { include: { account_type: true } } } },
          attachments: true
        }
      })

      // Exclude manual journal entries
      const posEntries = entries.filter((e) => {
        const ref = (e.reference_no || '').trim().toUpperCase()
        return !ref.startsWith('JV') && !ref.startsWith('ADJ') && !ref.startsWith('PJ') && !ref.startsWith('PY')
      })

      // Format exactly like AnalyticsService.getRecentTransactions
      return posEntries.map((e) => {
        const arLine = e.lines.find((l) => l.account.code === '1200')
        const cashLine = e.lines.find((l) => l.account.code === '1020')
        const gcashLine = e.lines.find((l) => l.account.code === '1010')

        let method = ''
        if (cashLine && !gcashLine) method = 'CASH'
        else if (!cashLine && gcashLine) method = 'GCASH'
        else if (cashLine && gcashLine) method = 'SPLIT'
        else method = 'CHARGE'

        let clientType = 'WALKIN'
        let examType = 'STANDARD'
        
        const metaMatch = e.description.match(/\[META:([^:]+):([^\]]+)\]/)
        if (metaMatch) {
          clientType = metaMatch[1]
          examType = metaMatch[2]
        }

        let parsedItems: any[] | null = null
        const itemsMatch = e.description.match(/\[ITEMS:([\s\S]*?)\]/)
        if (itemsMatch) {
          try {
            parsedItems = JSON.parse(itemsMatch[1])
          } catch {
            try {
              parsedItems = JSON.parse(decodeURIComponent(itemsMatch[1]))
            } catch {}
          }
        }

        let cleanDescription = cleanDescHelper(e.description)

        let remarks = ''
        const remarksMatch = cleanDescription.match(/\nRemarks:\s*([\s\S]*?)(?=\nDiagnostic Test|$)/)
        if (remarksMatch) {
          remarks = remarksMatch[1].trim()
          cleanDescription = cleanDescription.replace(/\nRemarks:\s*[\s\S]*?(?=\nDiagnostic Test|$)/, '').trim()
        }

        let patientName = e.payee?.name || 'Walk-in'
        const nameMatch = cleanDescription.match(/Patient:\s*(.*?)(?=\s*(?:\| A\/R:|\| Pt\. Paid:|\n|$))/)
        if (nameMatch) {
          patientName = nameMatch[1].trim()
        }

        // For legacy diagnostic tests parsing
        const diagMatch = cleanDescription.match(/Diagnostic Test\s*\((.*?)(?:\s*-\s*[^)]*)?\)/)
        const parsedLegacyTests: string[] = []
        if (diagMatch && diagMatch[1]) {
          diagMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean).forEach(t => parsedLegacyTests.push(t))
        }

        let legacyTestIdx = 0
        const mappedRawLines = e.lines.map(l => {
          let lineDesc = ''
          if (l.account.code === '4020' && legacyTestIdx < parsedLegacyTests.length) {
            lineDesc = parsedLegacyTests[legacyTestIdx++]
          }
          return {
            id: l.id,
            accountId: l.account_id,
            accountCode: l.account.code,
            description: lineDesc,
            debit: Number(l.debit),
            credit: Number(l.credit)
          }
        })

        return {
          id: e.id,
          date: e.date,
          createdAt: e.created_at,
          referenceNo: e.reference_no,
          description: cleanDescription,
          rawDescription: e.description,
          items: parsedItems,
          remarks: remarks,
          attachments: (e.attachments || []).map((a) => ({
            id: a.id,
            name: a.fileName,
            type: a.fileType,
            data: a.fileData
          })),
          clientType,
          examType,
          amount: Number(
            e.lines.filter((l) => Number(l.credit) > 0).reduce((sum, l) => sum + Number(l.credit), 0)
          ),
          totalAmount: Number(
            e.lines.filter((l) => Number(l.credit) > 0).reduce((sum, l) => sum + Number(l.credit), 0)
          ),
          method: method,
          patientName: patientName,
          billedEntity: e.payee?.type === 'HMO' || e.payee?.type === 'CORPORATE' ? e.payee.name : '',
          billedEntityType: e.payee?.type,
          payeeId: e.payee_id,
          vatType: e.vat_type,
          rawLines: mappedRawLines
        }
      })
    } catch (err) {
      console.error(err)
      return { success: false, error: String(err) }
    }
  })

  // Settings & System
  ipcMain.handle('get-lock-date', async () => await LedgerService.getLockDate())
  ipcMain.handle('set-lock-date', async (_, data) => await LedgerService.setLockDate(data))
  ipcMain.handle('config:getServerIp', () => {
    const configPath = path.join(app.getPath('userData'), 'server-config.json')
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return config.serverIp || 'localhost'
    }
    return 'localhost'
  })
  ipcMain.handle('update-reference-number', async (e, entryId, newRef) => {
    try {
      const result =
        typeof LedgerService.updateReferenceNumber === 'function'
          ? await LedgerService.updateReferenceNumber(entryId, newRef)
          : { success: false }
      if (result.success)
        await AuditService.logAction(
          'SYSTEM',
          'EDIT TRANSACTION',
          `Changed reference number to ${newRef} for entry ID: ${entryId}`
        )
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('config:setServerIp', async (event, ip: string) => {
    const configPath = path.join(app.getPath('userData'), 'server-config.json')
    fs.writeFileSync(configPath, JSON.stringify({ serverIp: ip }))
    await AuditService.logAction('SYSTEM', 'SYSTEM CONFIG', `LAN IP updated to: ${ip}`)
    if (app.isPackaged) {
      app.relaunch()
      app.exit(0)
      return { success: true, restarted: true }
    } else {
      return { success: true, restarted: false }
    }
  })

  // 🔥 INSTANT TCP HEARTBEAT (Bypasses Prisma timeout delay)
  ipcMain.handle('system:ping', async () => {
    return new Promise((resolve) => {
      const configPath = path.join(app.getPath('userData'), 'server-config.json')
      let serverIp = '127.0.0.1'
      if (fs.existsSync(configPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          serverIp = cfg.serverIp || '127.0.0.1'
        } catch {
          serverIp = '127.0.0.1'
        }
      }

      const socket = new net.Socket()
      socket.setTimeout(1000) // 1-second maximum timeout!

      socket.on('connect', () => {
        socket.destroy()
        resolve({ success: true })
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve({ success: false })
      })

      socket.on('error', () => {
        socket.destroy()
        resolve({ success: false })
      })

      socket.connect(3306, serverIp)
    })
  })

  // --- AUTOMATED BACKUP SCHEDULER ---
  // '59 23 * * *' translates to 11:59 PM every day.
  cron.schedule('59 23 * * *', async () => {
    console.log('⏳ Running automated daily background backup...')
    const result = await BackupService.executeScheduledBackup()

    if (result.success) {
      await AuditService.logAction(
        'SYSTEM',
        'AUTO BACKUP',
        `Automated daily backup securely saved to ${result.filePath}`
      )
      console.log('✅ Automated backup successful.')
    } else {
      await AuditService.logAction(
        'SYSTEM',
        'AUTO BACKUP FAILED',
        `Failed to generate automated backup: ${result.error}`
      )
      console.error('❌ Automated backup failed:', result.error)
    }
  })

  // --- OFFLINE-FIRST AUTO-SYNCER ---
  // Checks every 5 seconds if the cable is plugged back in to push data
  setInterval(async () => {
    if (!fs.existsSync(OFFLINE_QUEUE_PATH)) return

    let queue: any[] = []
    try {
      queue = JSON.parse(fs.readFileSync(OFFLINE_QUEUE_PATH, 'utf-8'))
    } catch {
      return
    }

    if (queue.length === 0) return

    try {
      // 1. Check if Ubuntu server is back online
      const ping = await AuthService.pingDatabase()
      if (!ping.success) return // Still offline, wait for next tick

      console.log(
        `🔄 [SYNC] Connection restored! Pushing ${queue.length} offline transactions to Ubuntu Server...`
      )
      let pendingQueue: any[] = []

      // 2. Push all local transactions to the server
      for (const entryData of queue) {
        try {
          await LedgerService.createJournalEntry(entryData)
          await AuditService.logAction(
            entryData.userId || 'SYSTEM',
            'SYNCED OFFLINE TRANSACTION',
            `Auto-synced ref ${entryData.referenceNo} from local cache`
          )
          console.log(`✅ [SYNC] Successfully pushed ${entryData.referenceNo}`)
        } catch (err: any) {
          console.error(`❌ [SYNC] Failed to push ${entryData.referenceNo}:`, err.message)
          pendingQueue.push(entryData) // Keep in queue if it failed
        }
      }

      // 3. Clear the local queue
      fs.writeFileSync(OFFLINE_QUEUE_PATH, JSON.stringify(pendingQueue, null, 2))
      if (pendingQueue.length === 0) {
        console.log(`🎉 [SYNC COMPLETE] All offline transactions have been synced to the database!`)
      }
    } catch (error) {
      // Silent catch to prevent crashing background worker
    }
  }, 5000)

  console.log('✅ ALL HANDLERS REGISTERED SUCCESSFULLY')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
