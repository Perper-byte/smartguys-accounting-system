// src/renderer/src/components/GeneralLedgerView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const GeneralLedgerView: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [ledgerData, setLedgerData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch the Chart of Accounts for the dropdown on load
    useEffect(() => {
        const api = (window as any).electronAPI;
        if (api && api.getAccounts) {
            api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
        }
    }, []);

    // Fetch the specific ledger history when an account is selected
    useEffect(() => {
        if (!selectedAccountId) {
            setLedgerData(null);
            return;
        }

        const fetchLedger = async () => {
            setLoading(true);
            try {
                const api = (window as any).electronAPI;
                const data = await api.getAccountLedger(selectedAccountId);
                if (!data.error) {
                    setLedgerData(data);
                } else {
                    setLedgerData(null);
                }
            } catch (err) {
                console.error("Failed to fetch ledger", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLedger();
    }, [selectedAccountId]);

    // Format currency
    const formatCurrency = (amount: number) => {
        if (amount === 0) return '-';
        return `₱ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format Date
    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    return (
        <div className="max-w-5xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg min-h-[500px]">

            {/* HEADER & ACCOUNT SELECTOR */}
            <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-6">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">General Ledger</h2>
                    <p className="text-sm text-[#8d8d99] mt-1">View chronological transaction history and running balances.</p>
                </div>

                <div className="w-72">
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Select Account</label>
                    <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition cursor-pointer"
                    >
                        <option value="">-- Choose Account --</option>
                        {accounts.map(acc => (
                            <option key={acc.code} value={acc.code}>
                                {acc.code} - {acc.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* LOADING STATE */}
            {loading && (
                <div className="flex justify-center items-center py-20 text-[#4f46e5]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                </div>
            )}

            {/* EMPTY STATE */}
            {!loading && !ledgerData && selectedAccountId && (
                <div className="text-center py-20 text-[#8d8d99]">
                    <p>No transactions found for this account.</p>
                </div>
            )}

            {/* LEDGER DATA TABLE */}
            {!loading && ledgerData && (
                <div className="animate-in fade-in duration-300">

                    <div className="flex items-center justify-between bg-[#121214] border border-[#29292e] rounded-t-md p-4">
                        <div>
                            <h3 className="text-lg font-bold text-white">{ledgerData.accountCode} - {ledgerData.accountName}</h3>
                            <p className="text-xs text-[#8d8d99] font-medium mt-1">Normal Balance: <span className="text-white">{ledgerData.normalBalance}</span></p>
                        </div>

                        {/* Quick Summary Card */}
                        <div className="text-right">
                            <p className="text-xs text-[#8d8d99] uppercase font-bold tracking-wider">Current Balance</p>
                            <p className={`text-xl font-bold font-mono mt-1 ${ledgerData.transactions.length > 0 && ledgerData.transactions[ledgerData.transactions.length - 1].balance < 0 ? 'text-[#f75a68]' : 'text-emerald-500'}`}>
                                {ledgerData.transactions.length > 0 ? formatCurrency(ledgerData.transactions[ledgerData.transactions.length - 1].balance) : '₱ 0.00'}
                            </p>
                        </div>
                    </div>

                    <div className="border border-t-0 border-[#29292e] rounded-b-md bg-[#121214] overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-[#202024] border-b border-[#29292e]">
                                <tr className="text-left text-[#8d8d99] text-xs uppercase tracking-wider">
                                    <th className="p-3 pl-4">Date</th>
                                    <th className="p-3">Reference</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3 text-right">Debit</th>
                                    <th className="p-3 text-right">Credit</th>
                                    <th className="p-3 pr-4 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerData.transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-6 text-center text-[#8d8d99] text-sm italic">
                                            No transaction history available.
                                        </td>
                                    </tr>
                                ) : (
                                    ledgerData.transactions.map((tx: any) => (
                                        <tr key={tx.id} className="border-b border-[#29292e]/50 last:border-0 hover:bg-[#202024]/50 transition">
                                            <td className="p-3 pl-4 text-sm text-[#e1e1e6] whitespace-nowrap">{formatDate(tx.date)}</td>
                                            <td className="p-3 text-sm text-[#e1e1e6] font-mono whitespace-nowrap">{tx.referenceNo}</td>
                                            <td className="p-3 text-sm text-[#e1e1e6]">
                                                {tx.description}
                                            </td>
                                            <td className="p-3 text-sm text-right text-white font-mono">{formatCurrency(tx.debit)}</td>
                                            <td className="p-3 text-sm text-right text-white font-mono">{formatCurrency(tx.credit)}</td>
                                            <td className={`p-3 pr-4 text-sm text-right font-bold font-mono ${tx.balance < 0 ? 'text-[#f75a68]' : 'text-emerald-500'}`}>
                                                {formatCurrency(tx.balance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};