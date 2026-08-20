import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';

const getLocalDateString = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export const GeneralLedgerView: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const [singleLedgerData, setSingleLedgerData] = useState<any | null>(null);
    const [fullLedgerReport, setFullLedgerReport] = useState<any[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(getLocalDateString(firstDay));
    const [endDate, setEndDate] = useState(getLocalDateString(today));
    
    const [selectedTx, setSelectedTx] = useState<any | null>(null); 
    const [showVoidInput, setShowVoidInput] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

   const fetchFullReport = useCallback(async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getFullLedgerReport(startDate, endDate);
            
            // Safety Net: Ensures data is always an array so .map() doesn't crash!
            if (Array.isArray(data)) {
                setFullLedgerReport(data);
            } else {
                setFullLedgerReport([]);
                console.error("Ledger returned an error instead of an array:", data);
            }
        } catch (error) { 
            console.error(error); 
            setFullLedgerReport([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    const fetchSingleLedger = useCallback(async (accountId: string) => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getAccountLedger(accountId);
            setSingleLedgerData(!data.error ? data : null);
        } catch (err) { 
            console.error(err); 
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const api = (window as any).api || (window as any).electronAPI;
        if (api && api.getAccounts) api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
        fetchFullReport();
    }, [fetchFullReport]);

    useEffect(() => {
        if (!selectedAccountId) { setSingleLedgerData(null); fetchFullReport(); return; }
        fetchSingleLedger(selectedAccountId);
    }, [selectedAccountId, fetchSingleLedger, fetchFullReport]);

    const groupedAccounts = useMemo(() => {
        return accounts.reduce((groups: any, acc: any) => {
            const cat = acc.account_type?.name || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(acc);
            return groups;
        }, {});
    }, [accounts]);

    const formatCurrency = (amount: number, isBalanceColumn: boolean = false) => {
        if (!amount || amount === 0) return '-';
        const absAmount = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isBalanceColumn && amount < 0 ? `(₱ ${absAmount})` : `₱ ${absAmount}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    };

    const submitVoidRequest = async () => {
        setStatus(null);
        if (!voidReason || !voidReason.trim()) return setStatus({ type: 'error', msg: "Reason required." });
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const targetId = selectedTx.entryId || selectedTx.id; 
            const response = await api.requestVoid(targetId, voidReason);
            if (response.success || !response.error) {
                setStatus({ type: 'success', msg: `Void requested for ${selectedTx.referenceNo}! Manager approval needed.` });
                setSelectedTx(null); setShowVoidInput(false); setVoidReason('');
                if (selectedAccountId) fetchSingleLedger(selectedAccountId); else fetchFullReport();
            } else setStatus({ type: 'error', msg: "Failed: " + response.error });
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); }
    };

    const renderStatusBadge = (status: string) => {
        if (status === 'PENDING_VOID') return <span className="ml-2 text-[9px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Pending Void</span>;
        if (status === 'VOIDED') return <span className="ml-2 text-[9px] bg-red-500/20 text-red-400 border border-red-500/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Voided</span>;
        return null;
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-200">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">Detailed General Ledger</h2>
                    <p className="text-sm text-gray-400">Showing activity for the period of {formatDate(startDate)} to {formatDate(endDate)}</p>
                </div>
                
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-[#121214] border border-[#29292e] rounded-md px-3 py-1.5">
                        <span className="text-xs text-gray-500 uppercase font-bold">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <span className="text-xs text-gray-500 uppercase font-bold pl-2 border-l border-[#29292e]">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <button onClick={() => { if(selectedAccountId) fetchSingleLedger(selectedAccountId); else fetchFullReport(); }} className="ml-2 bg-[#4f46e5] hover:bg-[#5b54f6] text-white px-3 py-1 rounded text-xs font-bold transition cursor-pointer">Apply</button>
                    </div>

                    <div className="w-72">
                        <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:outline-none cursor-pointer">
                            <option value="">-- All Accounts --</option>
                            {Object.entries(groupedAccounts).map(([category, accs]: any) => (
                                <optgroup key={category} label={`━━━ ${category.toUpperCase()} ━━━`} className="text-[#8d8d99] font-bold bg-[#121214]">
                                    {accs.map((acc: any) => (<option key={acc.code} value={acc.code} className="bg-[#202024] text-white font-normal">{acc.code} - {acc.name}</option>))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <button onClick={() => window.print()} className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-white rounded-md text-sm font-bold transition">🖨️ Print</button>
                </div>
            </div>

            {status && <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>{status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}</div>}

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden relative print:bg-white print:border-none print:shadow-none print:text-black">
                
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-[#4f46e5] animate-pulse">Computing Ledger Details...</div>
                ) : (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#121214] print:bg-gray-200 sticky top-0 z-10 shadow-sm border-b border-[#29292e] print:border-gray-400">
                                <tr className="text-[#8d8d99] print:text-black uppercase tracking-wider text-xs">
                                    <th className="p-4 font-bold">Date</th>
                                    <th className="p-4 font-bold">Transaction / Ref</th>
                                    <th className="p-4 font-bold">Description</th>
                                    <th className="p-4 font-bold">Contact / Entity</th>
                                    <th className="p-4 font-bold text-right">Debit</th>
                                    <th className="p-4 font-bold text-right">Credit</th>
                                    <th className="p-4 font-bold text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50 print:divide-gray-300">
                                
                                {/* ---> THE "NO DATA" FALLBACK <--- */}
                                {!selectedAccountId && fullLedgerReport.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-[#8d8d99] italic">
                                            No transactions or account activity found in this date range.
                                        </td>
                                    </tr>
                                )}

                                {/* FULL REPORT VIEW */}
                                {!selectedAccountId && fullLedgerReport.map((accData: any) => (
                                    <React.Fragment key={accData.accountCode}>
                                        <tr className="bg-[#2a2a2f] print:bg-gray-100 border-t-4 border-[#121214] print:border-white">
                                            <td colSpan={7} className="p-3 font-bold text-white print:text-black text-sm tracking-wide">
                                                {accData.accountCode} {accData.accountName}
                                            </td>
                                        </tr>
                                        <tr className="bg-[#1a1a1e] print:bg-transparent">
                                            <td colSpan={4} className="p-3 font-bold text-gray-300 print:text-gray-700">Opening Balance</td>
                                            <td className="p-3 text-right text-gray-500">-</td>
                                            <td className="p-3 text-right text-gray-500">-</td>
                                            <td className="p-3 text-right font-mono font-bold text-white print:text-black">{formatCurrency(accData.openingBalance, accData.openingBalance < 0)}</td>
                                        </tr>
                                        {accData.transactions.map((tx: any) => (
                                            <tr key={tx.id} className={`hover:bg-[#202024] print:hover:bg-transparent transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                                <td className="p-3 text-gray-400 print:text-black whitespace-nowrap">{formatDate(tx.date)}</td>
                                                <td className="p-3 font-mono print:text-black">
                                                    <button onClick={() => setSelectedTx(tx)} className="text-[#4f46e5] print:text-black hover:underline font-bold transition cursor-pointer flex flex-col items-start">
                                                        <span>{tx.referenceNo}</span>
                                                    </button>
                                                    {renderStatusBadge(tx.status)}
                                                </td>
                                                <td className="p-3 text-gray-300 print:text-black max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                                                <td className="p-3 text-gray-300 print:text-black">{tx.payeeName}</td>
                                                <td className="p-3 text-right font-mono text-emerald-400 print:text-black">{formatCurrency(tx.debit)}</td>
                                                <td className="p-3 text-right font-mono text-[#f75a68] print:text-black">{formatCurrency(tx.credit)}</td>
                                                <td className={`p-3 text-right font-bold font-mono ${tx.balance < 0 ? 'text-[#f75a68]' : 'text-gray-200 print:text-black'}`}>
                                                    {formatCurrency(tx.balance, true)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-[#1a1a1e] print:bg-gray-50 border-b-4 border-[#121214] print:border-gray-400">
                                            <td colSpan={4} className="p-3 font-bold text-white print:text-black tracking-wide">
                                                {accData.accountCode} {accData.accountName} Closing Balance
                                            </td>
                                            <td className="p-3 text-right font-mono text-white print:text-black font-bold">{formatCurrency(accData.totalDebit)}</td>
                                            <td className="p-3 text-right font-mono text-white print:text-black font-bold">{formatCurrency(accData.totalCredit)}</td>
                                            <td className={`p-3 text-right font-mono font-bold text-lg ${accData.closingBalance < 0 ? 'text-[#f75a68]' : 'text-emerald-400 print:text-black'}`}>
                                                {formatCurrency(accData.closingBalance, accData.closingBalance < 0)}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}

                                {/* SINGLE ACCOUNT VIEW */}
                                {selectedAccountId && singleLedgerData && singleLedgerData.transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-[#8d8d99] italic">
                                            No transactions found for this account.
                                        </td>
                                    </tr>
                                )}
                                {selectedAccountId && singleLedgerData && singleLedgerData.transactions.map((tx: any) => (
                                    <tr key={tx.id} className={`hover:bg-[#202024] print:hover:bg-transparent transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                        <td className="p-3 text-gray-400 print:text-black whitespace-nowrap">{formatDate(tx.date)}</td>
                                        <td className="p-3 font-mono">
                                            <button onClick={() => setSelectedTx(tx)} className="text-[#4f46e5] print:text-black hover:underline font-bold transition cursor-pointer flex flex-col items-start">
                                                <span>{tx.referenceNo}</span>
                                            </button>
                                            {renderStatusBadge(tx.status)}
                                        </td>
                                        <td className="p-3 text-gray-300 print:text-black">{tx.description}</td>
                                        <td className="p-3 text-gray-500 print:text-black">-</td>
                                        <td className="p-3 text-right font-mono text-emerald-400 print:text-black">{formatCurrency(tx.debit)}</td>
                                        <td className="p-3 text-right font-mono text-[#f75a68] print:text-black">{formatCurrency(tx.credit)}</td>
                                        <td className={`p-3 text-right font-bold font-mono ${tx.balance < 0 ? 'text-[#f75a68]' : 'text-gray-200 print:text-black'}`}>
                                            {formatCurrency(tx.balance, true)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ---> DRILL-DOWN MODAL <--- */}
            {selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm print:hidden">
                    <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[500px]">
                        <div className="flex justify-between items-center border-b border-[#29292e] pb-4 mb-4">
                            <div className="flex items-center space-x-3">
                                <h3 className="text-lg font-bold text-white tracking-wide uppercase">Transaction Details</h3>
                                {renderStatusBadge(selectedTx.status)}
                            </div>
                            <button onClick={() => { setSelectedTx(null); setShowVoidInput(false); }} className="text-gray-500 hover:text-red-400 font-bold text-xl cursor-pointer">×</button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#121214] p-3 rounded border border-[#29292e]"><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Date</p><p className="text-sm text-white font-mono">{formatDate(selectedTx.date)}</p></div>
                                <div className="bg-[#121214] p-3 rounded border border-[#29292e]"><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Reference No.</p><p className="text-sm text-[#4f46e5] font-bold font-mono">{selectedTx.referenceNo}</p></div>
                            </div>
                            <div className="bg-[#121214] p-3 rounded border border-[#29292e]"><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Description</p><p className="text-sm text-gray-300">{selectedTx.description}</p></div>
                            <div className="bg-[#121214] p-4 rounded border border-[#29292e]">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Line Impact</p>
                                <div className="flex justify-between border-b border-[#29292e] pb-2 mb-2"><span className="text-sm font-bold text-gray-400">Debit:</span><span className="text-sm font-mono text-emerald-400">{formatCurrency(selectedTx.debit)}</span></div>
                                <div className="flex justify-between"><span className="text-sm font-bold text-gray-400">Credit:</span><span className="text-sm font-mono text-[#f75a68]">{formatCurrency(selectedTx.credit)}</span></div>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-[#29292e] flex justify-between items-center min-h-[40px]">
                            <div className="flex-1 mr-4">
                                {(!selectedTx.status || selectedTx.status === 'ACTIVE') && !showVoidInput && (
                                    <button onClick={() => setShowVoidInput(true)} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/50 text-red-500 border border-red-900/50 rounded text-xs font-bold transition-colors cursor-pointer">⚠️ Request Void</button>
                                )}
                                {showVoidInput && (
                                    <div className="flex space-x-2">
                                        <input type="text" autoFocus placeholder="Reason..." value={voidReason} onChange={e => setVoidReason(e.target.value)} className="flex-1 bg-[#121214] border border-red-900/50 rounded px-3 py-1.5 text-xs text-white outline-none" />
                                        <button onClick={submitVoidRequest} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer">Submit</button>
                                        <button onClick={() => setShowVoidInput(false)} className="bg-[#29292e] hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded text-xs cursor-pointer">Cancel</button>
                                    </div>
                                )}
                            </div>
                            {!showVoidInput && <button onClick={() => setSelectedTx(null)} className="px-6 py-2 bg-[#29292e] hover:bg-[#323238] text-white rounded font-bold transition-colors text-sm cursor-pointer">Close</button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};