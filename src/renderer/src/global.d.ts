// src/renderer/src/global.d.ts
interface Window {
    electronAPI: {
        login: (username: string, password: string) => Promise<any>;
        getAccounts: () => Promise<any[]>;
        submitJournalEntry: (entryData: any) => Promise<any>;
        getAccountLedger: (accountId: string) => Promise<any>;
        triggerBackup: () => Promise<any>;
        generate2550Q: (year: number, quarter: number) => Promise<any>;
        generateRelief: (year: number, quarter: number) => Promise<any>;
        getAnalyticsMetrics: (timeframe: string) => Promise<any>;
        getTrialBalance: (year?: number, month?: number) => Promise<any>;
        getIncomeStatement: (year?: number, month?: number) => Promise<any>;
        getBalanceSheet: (year?: number, month?: number) => Promise<any>;
        getCashFlowStatement: (year?: number, month?: number) => Promise<any>;
        getServerIp: () => Promise<string>;
        setServerIp: (ip: string) => Promise<void>;
    };
}