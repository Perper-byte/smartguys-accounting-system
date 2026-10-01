// src/renderer/src/global.d.ts
interface Window {
  electronAPI: {
    login: (username: string, password: string) => Promise<any>
    getAccounts: () => Promise<any[]>
    submitJournalEntry: (entryData: any) => Promise<any>
    getAccountLedger: (accountId: string) => Promise<any>
    triggerBackup: () => Promise<any>
    generate2550Q: (year: number, quarter: number) => Promise<any>
    generateRelief: (year: number, quarter: number) => Promise<any>
    getAnalyticsMetrics: (timeframe: string) => Promise<any>
    getTrialBalance: (year?: number, month?: number, quarter?: string) => Promise<any>
    getIncomeStatement: (year?: number, month?: number, quarter?: string) => Promise<any>
    getBalanceSheet: (year?: number, month?: number, quarter?: string) => Promise<any>
    getCashFlowStatement: (year?: number, month?: number, quarter?: string) => Promise<any>
    exportFinancialStatementExcel: (statementType: string, year?: number, month?: number, quarter?: string) => Promise<any>
    exportTrialBalanceExcel: (year?: number, month?: number, quarter?: string) => Promise<any>
    exportEmployeesExcel: (employees?: any[]) => Promise<any>
    downloadEmployeeTemplate: () => Promise<any>
    bulkImportEmployees: (records: any[], updateExisting: boolean) => Promise<any>
    getServerIp: () => Promise<string>
    setServerIp: (ip: string) => Promise<void>
    getAllJournalEntries: () => Promise<any[]>
    getJournalEntryById: (idOrRef: string) => Promise<any>
    pingDatabase: () => Promise<boolean>
  }
}
