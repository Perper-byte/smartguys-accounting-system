// src/renderer/src/global.d.ts
interface Window {
    electronAPI: {
        login: (username: string, password: string) => Promise<any>;
        getAccounts: () => Promise<any[]>;
        submitJournalEntry: (entryData: any) => Promise<any>;
        getAccountLedger: (accountId: string) => Promise<any>;
    };
}