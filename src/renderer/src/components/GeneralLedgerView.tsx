import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';

const getLocalDateString = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export const GeneralLedgerView: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [ledgerData, setLedgerData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    // UI States
    const [searchQuery, setSearchQuery] = useState('');
    
       const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(getLocalDateString(firstDay));
    const [endDate, setEndDate] = useState(getLocalDateString(today));
    // Drill-Down & Global Feed States
    const [selectedTx, setSelectedTx] = useState<any | null>(null); 
    const [recentGlobalTxs, setRecentGlobalTxs] = useState<any[]>([]);

    const [showVoidInput, setShowVoidInput] = useState(false);
    const [voidReason, setVoidReason] = useState('');

    // ---> NEW: React Status Banner State <---
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const fetchGlobalFeed = useCallback(async () => {
        try {
            const api = (window as any).api || (window as any).electronAPI;
            if (api.getAllRecentTransactions) {
                const data = await api.getAllRecentTransactions();
                setRecentGlobalTxs(data || []);
            }
        } catch (error) {
            console.error("Failed to fetch global feed", error);
        }
    }, []);

    const fetchLedger = useCallback(async (accountId: string) => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getAccountLedger(accountId);
            if (!data.error) setLedgerData(data);
            else setLedgerData(null);
        } catch (err) {
            console.error("Failed to fetch ledger", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const api = (window as any).api || (window as any).electronAPI;
        if (api && api.getAccounts) {
            api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
        }
        fetchGlobalFeed();
    }, [fetchGlobalFeed]);

    useEffect(() => {
        if (!selectedAccountId) {
            setLedgerData(null);
            fetchGlobalFeed();
            return;
        }
        fetchLedger(selectedAccountId);
    }, [selectedAccountId, fetchLedger, fetchGlobalFeed]);

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

    const filteredTransactions = useMemo(() => {
        if (!ledgerData?.transactions) return [];
        return ledgerData.transactions.filter((tx: any) => {
            const matchesSearch = tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  tx.referenceNo?.toLowerCase().includes(searchQuery.toLowerCase());
            
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

    const totalFilteredDebit = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.debit) || 0), 0);
    const totalFilteredCredit = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.credit) || 0), 0);

    const formatCurrency = (amount: number, isBalanceColumn: boolean = false) => {
        if (!amount || amount === 0) return '-';
        const absAmount = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (isBalanceColumn && amount < 0) return `(₱ ${absAmount})`;
        return `₱ ${absAmount}`;
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
    };

    const exportToCSV = () => {
        if (!ledgerData || filteredTransactions.length === 0) return;
        const headers = ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance', 'Status'];
        const csvRows = filteredTransactions.map((tx: any) => {
            const date = formatDate(tx.date);
            const desc = `"${tx.description.replace(/"/g, '""')}"`;
            const debit = tx.debit > 0 ? tx.debit : '';
            const credit = tx.credit > 0 ? tx.credit : '';
            const balance = tx.balance;
            const status = tx.status || 'ACTIVE';
            return `${date},${tx.referenceNo},${desc},${debit},${credit},${balance},${status}`;
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

    // ---> UPDATED: No more alert() boxes! <---
    const submitVoidRequest = async () => {
        setStatus(null);

        if (!voidReason || !voidReason.trim()) {
            setStatus({ type: 'error', msg: "Please enter a reason for voiding this transaction." });
            return;
        }

        try {
            const api = (window as any).api || (window as any).electronAPI;
            const targetId = selectedTx.entryId || selectedTx.id; 
            
            const response = await api.requestVoid(targetId, voidReason);
            if (response.success || !response.error) {
                setStatus({ type: 'success', msg: `Void requested for ${selectedTx.referenceNo}! The manager must approve it.` });
                closeModal();
                if (selectedAccountId) fetchLedger(selectedAccountId);
                else fetchGlobalFeed();
            } else {
                setStatus({ type: 'error', msg: "Failed to request void: " + response.error });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', msg: "System Error: Could not request void." });
        }
    };

    const closeModal = () => {
        setSelectedTx(null);
        setShowVoidInput(false);
        setVoidReason('');
    };

    const renderStatusBadge = (status: string) => {
        if (status === 'PENDING_VOID') {
            return <span className="ml-2 text-[9px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Pending Void</span>;
        }
        if (status === 'VOIDED') {
            return <span className="ml-2 text-[9px] bg-red-500/20 text-red-400 border border-red-500/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Voided</span>;
        }
        return null;
    };

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200">
            
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
                                clearFilters(); 
                            }}
                            className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 pr-10 text-sm text-white focus:border-[#4f46e5] outline-none transition appearance-none cursor-pointer shadow-lg"
                        >
                            <option value="">-- View Global Recent Feed --</option>
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

            {/* ---> NEW: React Status Banner <--- */}
            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-medium ${
                    status.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden relative">
                
                {/* GLOBAL RECENT FEED */}
                {!selectedAccountId ? (
                    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
                        <div className="bg-[#1a1a1e] p-6 border-b border-[#29292e]">
                            <h3 className="text-xl font-bold text-white mb-1">Recent Global Transactions</h3>
                            <p className="text-xs text-gray-400">Showing the latest 50 line entries across all accounts in the clinic.</p>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm relative">
                                <thead className="bg-[#121214] sticky top-0 z-10 shadow-md">
                                    <tr className="text-[#8d8d99] uppercase tracking-wider text-xs border-b border-[#29292e]">
                                        <th className="p-4 font-bold">Date</th>
                                        <th className="p-4 font-bold">Reference</th>
                                        <th className="p-4 font-bold">Account</th>
                                        <th className="p-4 font-bold">Description</th>
                                        <th className="p-4 font-bold text-right">Debit</th>
                                        <th className="p-4 font-bold text-right">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#29292e]/50">
                                    {recentGlobalTxs.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">No transactions found.</td></tr>
                                    ) : (
                                        recentGlobalTxs.map((tx, idx) => (
                                            <tr key={idx} className={`hover:bg-[#2a2a2f] transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                                <td className="p-4 text-gray-400 whitespace-nowrap">{formatDate(tx.date)}</td>
                                                <td className="p-4 font-mono">
                                                    <button onClick={() => setSelectedTx(tx)} className="text-[#4f46e5] hover:text-[#5b54f6] hover:underline font-bold transition cursor-pointer flex items-center">
                                                        {tx.referenceNo}
                                                    </button>
                                                    {renderStatusBadge(tx.status)}
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-mono text-gray-300">{tx.accountCode}</span>
                                                    <span className="text-gray-500 ml-2">{tx.accountName}</span>
                                                </td>
                                                <td className="p-4 text-white max-w-sm truncate" title={tx.description}>{tx.description}</td>
                                                <td className="p-4 text-right font-mono text-emerald-400">{tx.debit > 0 ? formatCurrency(tx.debit) : '-'}</td>
                                                <td className="p-4 text-right font-mono text-[#f75a68]">{tx.credit > 0 ? formatCurrency(tx.credit) : '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex-1 flex items-center justify-center text-[#4f46e5] font-bold animate-pulse p-12">
                        Loading Ledger Data...
                    </div>
                ) : ledgerData ? (
                    <>
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

                        <div className="p-4 border-l border-r border-[#29292e] flex justify-between items-center bg-[#121214]/50">
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
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                                    <span className="text-xs text-gray-500 uppercase font-bold pl-2 border-l border-[#29292e]">To:</span>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                                </div>

                                {(searchQuery || startDate || endDate) && (
                                    <button onClick={clearFilters} className="text-xs text-[#f75a68] hover:text-red-400 font-bold uppercase transition cursor-pointer">
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                onClick={exportToCSV}
                                className="flex items-center space-x-2 bg-[#29292e] hover:bg-[#323238] text-gray-300 hover:text-white px-4 py-2 rounded-md text-sm font-bold transition-colors border border-[#323238] cursor-pointer"
                            >
                                <span>📥</span>
                                <span>Export to CSV</span>
                            </button>
                        </div>

                        <div className="border border-[#29292e] rounded-b-md bg-[#121214] flex-1 overflow-hidden flex flex-col max-h-[500px]">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left text-sm relative">
                                    <thead className="bg-[#202024] sticky top-0 z-10 shadow-sm border-b border-[#29292e]">
                                        <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
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
                                            <tr><td colSpan={6} className="p-8 text-center text-[#8d8d99] italic">No transactions match your search.</td></tr>
                                        ) : (
                                            filteredTransactions.map((tx: any, idx: number) => {
                                                const isAbnormal = tx.balance < 0;
                                                return (
                                                    <tr key={idx} className={`hover:bg-[#2a2a2f] transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                                        <td className="p-4 text-sm text-[#8d8d99] whitespace-nowrap">{formatDate(tx.date)}</td>
                                                        <td className="p-4 font-mono">
                                                            <button onClick={() => setSelectedTx(tx)} className="text-[#4f46e5] hover:text-[#5b54f6] hover:underline font-bold transition cursor-pointer flex flex-col items-start">
                                                                <span>{tx.referenceNo}</span>
                                                            </button>
                                                            {renderStatusBadge(tx.status)}
                                                        </td>
                                                        <td className="p-4 text-white max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                                        <td className="p-4 text-sm text-right text-gray-300 font-mono">{formatCurrency(tx.debit)}</td>
                                                        <td className="p-4 text-sm text-right text-gray-300 font-mono">{formatCurrency(tx.credit)}</td>
                                                        <td className={`p-4 text-sm text-right font-bold font-mono ${isAbnormal ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                                                            {formatCurrency(tx.balance, true)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

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

            {/* ---> DRILL-DOWN MODAL WITH CUSTOM REACT INPUT <--- */}
            {selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[500px]">
                        <div className="flex justify-between items-center border-b border-[#29292e] pb-4 mb-4">
                            <div className="flex items-center space-x-3">
                                <h3 className="text-lg font-bold text-white tracking-wide uppercase">Transaction Details</h3>
                                {renderStatusBadge(selectedTx.status)}
                            </div>
                            <button onClick={closeModal} className="text-gray-500 hover:text-red-400 cursor-pointer font-bold text-xl">×</button>
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
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Line Impact</p>
                                <div className="flex justify-between border-b border-[#29292e] pb-2 mb-2">
                                    <span className="text-sm font-bold text-gray-400">Debit:</span>
                                    <span className="text-sm font-mono text-emerald-400">{formatCurrency(selectedTx.debit)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-bold text-gray-400">Credit:</span>
                                    <span className="text-sm font-mono text-[#f75a68]">{formatCurrency(selectedTx.credit)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#29292e] flex justify-between items-center min-h-[40px]">
                            
                            {/* INLINE VOID REQUEST FORM */}
                            <div className="flex-1 mr-4">
                                {(!selectedTx.status || selectedTx.status === 'ACTIVE') && !showVoidInput && (
                                    <button onClick={() => setShowVoidInput(true)} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/50 text-red-500 border border-red-900/50 rounded text-xs font-bold transition-colors cursor-pointer uppercase tracking-wider">
                                        ⚠️ Request Void
                                    </button>
                                )}

                                {showVoidInput && (
                                    <div className="flex space-x-2">
                                        <input 
                                            type="text" 
                                            autoFocus
                                            placeholder="Reason for voiding..." 
                                            value={voidReason}
                                            onChange={(e) => setVoidReason(e.target.value)}
                                            className="flex-1 bg-[#121214] border border-red-900/50 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                                        />
                                        <button onClick={submitVoidRequest} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer">Submit</button>
                                        <button onClick={() => setShowVoidInput(false)} className="bg-[#29292e] hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded text-xs transition cursor-pointer">Cancel</button>
                                    </div>
                                )}
                            </div>

                            {!showVoidInput && (
                                <button onClick={closeModal} className="px-6 py-2 bg-[#29292e] hover:bg-[#323238] text-white rounded font-bold transition-colors cursor-pointer text-sm">
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};