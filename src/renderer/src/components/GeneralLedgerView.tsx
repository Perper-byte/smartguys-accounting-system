import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';

export const GeneralLedgerView: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [ledgerData, setLedgerData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    // ---> NEW UI STATES: Search, Dates, and Drill-Down Modal <---
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTx, setSelectedTx] = useState<any | null>(null); // For the Drill-down modal

    // Fetch the Chart of Accounts for the dropdown on load
    useEffect(() => {
        const api = (window as any).electronAPI || (window as any).api;
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
                const api = (window as any).electronAPI || (window as any).api;
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

    // Group the accounts by their Type (Asset, Liability, etc.)
    const groupedAccounts = useMemo(() => {
        return accounts.reduce((groups: any, acc: any) => {
            const categoryName = acc.account_type?.name || 'Other';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push(acc);
            return groups;
        }, {});
    }, [accounts]);

    // ---> FEATURE 1 & 2: Date Filters & Search Logic <---
    const filteredTransactions = useMemo(() => {
        if (!ledgerData?.transactions) return [];
        return ledgerData.transactions.filter((tx: any) => {
            // 1. Search Filter
            const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  tx.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());
            
            // 2. Date Filter
            const txDate = new Date(tx.date);
            txDate.setHours(0, 0, 0, 0);

            let matchesStart = true;
            if (startDate) {
                const sDate = new Date(startDate);
                sDate.setHours(0, 0, 0, 0);
                matchesStart = txDate >= sDate;
            }

            let matchesEnd = true;
            if (endDate) {
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                matchesEnd = txDate <= eDate;
            }

            return matchesSearch && matchesStart && matchesEnd;
        });
    }, [ledgerData, searchQuery, startDate, endDate]);

    // ---> FEATURE 3: Filtered Totals <---
    const totalFilteredDebit = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.debit) || 0), 0);
    const totalFilteredCredit = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.credit) || 0), 0);

    const formatCurrency = (amount: number, isBalanceColumn: boolean = false) => {
        if (amount === 0) return '-';
        const absAmount = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (isBalanceColumn && amount < 0) {
            return `(₱ ${absAmount})`;
        }
        return `₱ ${absAmount}`;
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const exportToCSV = () => {
        if (!ledgerData || filteredTransactions.length === 0) return;
        const headers = ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
        const csvRows = filteredTransactions.map((tx: any) => {
            const date = formatDate(tx.date);
            const desc = `"${tx.description.replace(/"/g, '""')}"`;
            const debit = tx.debit > 0 ? tx.debit : '';
            const credit = tx.credit > 0 ? tx.credit : '';
            const balance = tx.balance;
            return `${date},${tx.referenceNo},${desc},${debit},${credit},${balance}`;
        });

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Ledger_${ledgerData.accountCode}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Quick clear filters button handler
    const clearFilters = () => {
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
    };

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200">
            
            {/* Header & Account Selector */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">General Ledger</h2>
                    <p className="text-sm text-gray-400">View chronological transaction history and running balances.</p>
                </div>
                
                <div className="w-96">
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Select Account</label>
                    <div className="relative">
                        <select
                            value={selectedAccountId}
                            onChange={(e) => {
                                setSelectedAccountId(e.target.value);
                                clearFilters(); // Reset filters when switching accounts
                            }}
                            className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 pr-10 text-sm text-white focus:border-[#4f46e5] outline-none transition appearance-none cursor-pointer shadow-lg"
                        >
                            <option value="">-- Choose Account --</option>
                            {Object.entries(groupedAccounts).map(([category, accs]: any) => (
                                <optgroup key={category} label={`━━━ ${category.toUpperCase()} ━━━`} className="text-[#8d8d99] font-bold bg-[#121214]">
                                    {accs.map((acc: any) => (
                                        <option key={acc.code} value={acc.code} className="bg-[#202024] text-white font-normal">
                                            {acc.code} - {acc.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#8d8d99]">
                            <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ledger Content Area */}
            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden relative">
                
                {!selectedAccountId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50 p-12">
                        <span className="text-6xl mb-4">📖</span>
                        <p>Select an account above to view its ledger.</p>
                    </div>
                ) : loading ? (
                    <div className="flex-1 flex items-center justify-center text-[#4f46e5] font-bold animate-pulse p-12">
                        Loading Ledger Data...
                    </div>
                ) : ledgerData ? (
                    <>
                        {/* Selected Account Header Status Bar */}
                        <div className="bg-[#1a1a1e] p-6 border-b border-[#29292e] flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">
                                    {ledgerData.accountCode} - {ledgerData.accountName}
                                </h3>
                                <p className="text-xs text-gray-400">
                                    Normal Balance: <strong className="text-white">{ledgerData.normalBalance}</strong>
                                </p>
                            </div>
                            
                            <div className="text-right">
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Total Ending Balance</p>
                                <p className={`text-2xl font-bold font-mono ${ledgerData.transactions.length > 0 && ledgerData.transactions[ledgerData.transactions.length - 1].balance < 0 ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                                    {ledgerData.transactions.length > 0 ? formatCurrency(ledgerData.transactions[ledgerData.transactions.length - 1].balance, true) : '₱ 0.00'}
                                </p>
                            </div>
                        </div>

                        {/* ---> UPGRADED TOOLBAR: Search & Date Filters <--- */}
                        <div className="p-4 border-b border-[#29292e] flex justify-between items-center bg-[#121214]/50">
                            <div className="flex space-x-4">
                                <input 
                                    type="text" 
                                    placeholder="🔍 Search descriptions..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-64 bg-[#121214] border border-[#29292e] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white placeholder-gray-600 transition-colors"
                                />
                                
                                <div className="flex items-center space-x-2 bg-[#121214] border border-[#29292e] rounded-md px-3">
                                    <span className="text-xs text-gray-500 uppercase font-bold">From:</span>
                                    <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-500 uppercase font-bold pl-2 border-l border-[#29292e]">To:</span>
                                    <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer"
                                    />
                                </div>

                                {(searchQuery || startDate || endDate) && (
                                    <button onClick={clearFilters} className="text-xs text-[#f75a68] hover:text-red-400 font-bold uppercase transition">
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                onClick={exportToCSV}
                                className="flex items-center space-x-2 bg-[#29292e] hover:bg-[#323238] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors border border-[#323238] cursor-pointer"
                            >
                                <span>📥</span>
                                <span>Export to CSV</span>
                            </button>
                        </div>

                        {/* Transactions Table Container */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left text-sm relative">
                                    <thead className="bg-[#121214] sticky top-0 z-10 shadow-md">
                                        <tr className="text-[#8d8d99] uppercase tracking-wider text-xs border-b border-[#29292e]">
                                            <th className="p-4 font-bold w-[12%]">Date</th>
                                            <th className="p-4 font-bold w-[15%]">Reference</th>
                                            <th className="p-4 font-bold w-[35%]">Description</th>
                                            <th className="p-4 font-bold text-right w-[12%]">Debit</th>
                                            <th className="p-4 font-bold text-right w-[12%]">Credit</th>
                                            <th className="p-4 font-bold text-right w-[14%]">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#29292e]/50">
                                        {filteredTransactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500 italic">No transactions found matching your criteria.</td>
                                            </tr>
                                        ) : (
                                            filteredTransactions.map((tx: any, idx: number) => {
                                                const isAbnormal = tx.balance < 0;
                                                return (
                                                    <tr key={idx} className="hover:bg-[#2a2a2f] transition-colors">
                                                        <td className="p-4 whitespace-nowrap text-gray-400">
                                                            {formatDate(tx.date)}
                                                        </td>
                                                        {/* ---> DRILL-DOWN UPGRADE: Clickable Reference No <--- */}
                                                        <td className="p-4 font-mono">
                                                            <button 
                                                                onClick={() => setSelectedTx(tx)}
                                                                className="text-[#4f46e5] hover:text-[#5b54f6] hover:underline font-bold transition cursor-pointer"
                                                            >
                                                                {tx.referenceNo}
                                                            </button>
                                                        </td>
                                                        <td className="p-4 text-white max-w-md truncate" title={tx.description}>{tx.description}</td>
                                                        
                                                        {/* DEBIT COLUMN */}
                                                        <td className="p-4 text-right font-mono text-gray-300">
                                                            {tx.debit > 0 ? `₱ ${tx.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : <span className="text-gray-600">-</span>}
                                                        </td>
                                                        
                                                        {/* CREDIT COLUMN */}
                                                        <td className="p-4 text-right font-mono text-gray-300">
                                                            {tx.credit > 0 ? `₱ ${tx.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : <span className="text-gray-600">-</span>}
                                                        </td>
                                                        
                                                        {/* RUNNING BALANCE COLUMN */}
                                                        <td className={`p-4 text-right font-mono font-bold ${isAbnormal ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                                                            {formatCurrency(tx.balance, true)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* ---> FILTERED TOTALS (FOOTER) <--- */}
                            <div className="bg-[#1a1a1e] border-t border-[#29292e] p-4 flex justify-end shadow-inner">
                                <div className="grid grid-cols-2 gap-x-12 text-sm">
                                    <div className="flex justify-between items-center space-x-8">
                                        <span className="text-[#8d8d99] font-bold uppercase tracking-wider text-xs">Total Debits Filtered</span>
                                        <span className="text-white font-mono font-bold">₱ {totalFilteredDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center space-x-8">
                                        <span className="text-[#8d8d99] font-bold uppercase tracking-wider text-xs">Total Credits Filtered</span>
                                        <span className="text-white font-mono font-bold">₱ {totalFilteredCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-red-500 p-12">
                        Failed to load ledger data.
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* ---> DRILL-DOWN MODAL (Transaction Details) <--- */}
            {/* ========================================== */}
            {selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[500px]">
                        <div className="flex justify-between items-center border-b border-[#29292e] pb-4 mb-4">
                            <h3 className="text-lg font-bold text-white tracking-wide uppercase">Transaction Details</h3>
                            <button onClick={() => setSelectedTx(null)} className="text-gray-500 hover:text-red-400 cursor-pointer font-bold text-xl">×</button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#121214] p-3 rounded border border-[#29292e]">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Date</p>
                                    <p className="text-sm text-white font-mono">{formatDate(selectedTx.date)}</p>
                                </div>
                                <div className="bg-[#121214] p-3 rounded border border-[#29292e]">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Reference No.</p>
                                    <p className="text-sm text-[#4f46e5] font-bold font-mono">{selectedTx.referenceNo}</p>
                                </div>
                            </div>

                            <div className="bg-[#121214] p-3 rounded border border-[#29292e]">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Description / Memo</p>
                                <p className="text-sm text-gray-300">{selectedTx.description}</p>
                            </div>

                            <div className="bg-[#121214] p-4 rounded border border-[#29292e]">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Line Impact (This Account Only)</p>
                                <div className="flex justify-between border-b border-[#29292e] pb-2 mb-2">
                                    <span className="text-sm font-bold text-gray-400">Debit:</span>
                                    <span className="text-sm font-mono text-white">{formatCurrency(selectedTx.debit)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-bold text-gray-400">Credit:</span>
                                    <span className="text-sm font-mono text-white">{formatCurrency(selectedTx.credit)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#29292e] text-center">
                            <button onClick={() => setSelectedTx(null)} className="px-6 py-2 bg-[#29292e] hover:bg-[#323238] text-white rounded font-bold transition-colors cursor-pointer text-sm">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};