// src/shared/ipc-channels.ts

/**
 * STRONGLY TYPED IPC CHANNELS
 * This ensures the Frontend and Backend always use the exact same channel names.
 */
export const IPC_CHANNELS = {
  AUTH: {
    LOGIN: 'auth:login',
  },
  LEDGER: {
    GET_ACCOUNTS: 'ledger:getAccounts',
    SUBMIT_ENTRY: 'ledger:submitEntry',
    GET_LEDGER: 'ledger:getAccountLedger',
  },
  REPORTS: {
    TRIAL_BALANCE: 'reports:getTrialBalance',
    INCOME_STATEMENT: 'reports:getIncomeStatement',
    BALANCE_SHEET: 'reports:getBalanceSheet',
  },
  TAX: {
    GENERATE_2550Q: 'tax:generate2550Q',
    GENERATE_RELIEF: 'tax:generateRelief',
  },
  ANALYTICS: {
    GET_METRICS: 'analytics:getMetrics',
  },
  BACKUP: {
    TRIGGER: 'backup:triggerBackup',
  },
  EXPORT: {
    TRIAL_BALANCE_EXCEL: 'export:trialBalanceExcel',
    PRINT_PDF: 'export:printToPDF',
  },
} as const;