// src/renderer/src/components/GeneralLedgerView.tsx
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
    
    const [journalFilter, setJournalFilter] = useState<string>('ALL');
    
    const [selectedTx, setSelectedTx] = useState<any | null>(null); 
    const [showVoidInput, setShowVoidInput] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Edit Reference States
    const [isEditingRef, setIsEditingRef] = useState(false);
    const [newRefNo, setNewRefNo] = useState('');

    useEffect(() => {
        const api = (window as any).electronAPI || (window as any).api;
        if (api && api.getAccounts) {
            api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
        }
    }, []);

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

    const fetchFullReport = useCallback(async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getFullLedgerReport(startDate, endDate);
            
            if (Array.isArray(data)) {
                setFullLedgerReport(data);
            } else {
                setFullLedgerReport([]);
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
        if (!selectedAccountId) { 
            setSingleLedgerData(null); 
            fetchFullReport(); 
            return; 
        }
        fetchSingleLedger(selectedAccountId);
    }, [selectedAccountId, fetchSingleLedger, fetchFullReport]);

    const ledgerDisplay = useMemo(() => {
        if (!singleLedgerData || !singleLedgerData.transactions) return { list: [], beginningBalance: 0 };

        let beginningBalance = 0;
        let filtered = singleLedgerData.transactions;

        if (startDate) {
            const pastTx = singleLedgerData.transactions.filter((tx: any) => new Date(tx.date).toISOString().split('T')[0] < startDate);
            if (pastTx.length > 0) {
                beginningBalance = pastTx[pastTx.length - 1].balance;
            }
            filtered = filtered.filter((tx: any) => new Date(tx.date).toISOString().split('T')[0] >= startDate);
        }

        if (endDate) {
            filtered = filtered.filter((tx: any) => new Date(tx.date).toISOString().split('T')[0] <= endDate);
        }

        if (journalFilter !== 'ALL') {
            filtered = filtered.filter((tx: any) => {
                const ref = tx.referenceNo.toUpperCase();
                const accId = typeof selectedAccountId !== 'undefined' ? selectedAccountId : '';
                
                if (journalFilter === 'CRJ') return ref.startsWith('OR-') || (accId === '1010' && tx.debit > 0);
                if (journalFilter === 'CDJ') return ref.startsWith('CV-') || (accId === '1010' && tx.credit > 0);
                if (journalFilter === 'PJ') return ref.startsWith('PV-') || (accId === '2010' && tx.credit > 0);
                if (journalFilter === 'SJ') return ref.startsWith('INV-') || (accId === '1200' && tx.debit > 0);
                if (journalFilter === 'ADJ') return ref.startsWith('ADJ-');
                return true;
            });
        }

        return { list: filtered, beginningBalance };
    }, [singleLedgerData, startDate, endDate, journalFilter, selectedAccountId]);

    const formatCurrency = (amount: number, isBalanceColumn: boolean = false) => {
        if (!amount || amount === 0) return '-';
        const absAmount = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isBalanceColumn && amount < 0 ? `(${absAmount})` : absAmount;
    };

    const formatDate = (dateString: string) => {
        // Formats as "20 Aug 2026" exactly like the screenshot
        return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatVerboseDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
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

    const handleUpdateRefNo = async () => {
        if (!newRefNo.trim() || newRefNo === selectedTx.referenceNo) {
            setIsEditingRef(false);
            return;
        }
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const targetId = selectedTx.entryId || selectedTx.id; 
            const response = await api.updateReferenceNumber(targetId, newRefNo);
            
            if (response.success) {
                setStatus({ type: 'success', msg: `Reference number successfully updated to ${newRefNo}.` });
                setSelectedTx({ ...selectedTx, referenceNo: newRefNo }); 
                setIsEditingRef(false);
                if (selectedAccountId) fetchSingleLedger(selectedAccountId); else fetchFullReport();
            } else {
                setStatus({ type: 'error', msg: "Failed to update reference number." });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: "System Error." });
        }
    };

    const renderStatusBadge = (status: string) => {
        if (status === 'PENDING_VOID') return <span className="ml-2 text-[9px] bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider print:hidden">Pending Void</span>;
        if (status === 'VOIDED') return <span className="ml-2 text-[9px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider print:hidden">Voided</span>;
        return null;
    };

    const handleExportPDF = async () => {
        if (!singleLedgerData && fullLedgerReport.length === 0) {
            alert("No ledger data available to export.");
            return;
        }

        const sidebar = document.querySelector('aside');
        const topHeader = document.querySelector('header');
        const mainWrapper = document.querySelector('main');
        const appLayouts = document.querySelectorAll('.h-screen, .overflow-hidden, .flex-1');
        const ledgerCard = document.getElementById('ledger-card');
        const controlsDiv = document.getElementById('ledger-controls');
        const exportBtn = document.getElementById('export-pdf-btn');

        try {
            if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
            if (topHeader) topHeader.style.setProperty('display', 'none', 'important');
            if (controlsDiv) controlsDiv.style.setProperty('display', 'none', 'important');
            if (exportBtn) exportBtn.style.setProperty('display', 'none', 'important');

            if (mainWrapper) {
                mainWrapper.style.setProperty('overflow', 'visible', 'important');
                mainWrapper.style.setProperty('padding', '0', 'important');
                mainWrapper.style.setProperty('background-color', 'white', 'important');
            }
            if (ledgerCard) {
                ledgerCard.style.setProperty('border', 'none', 'important');
                ledgerCard.style.setProperty('box-shadow', 'none', 'important');
                ledgerCard.style.setProperty('padding', '0', 'important');
            }
            appLayouts.forEach(el => {
                (el as HTMLElement).style.setProperty('height', 'auto', 'important');
                (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
            });

            await new Promise(resolve => setTimeout(resolve, 150));

            const api = (window as any).electronAPI || (window as any).api;
            const cleanAccountName = singleLedgerData ? singleLedgerData.accountName.replace(/[^a-zA-Z0-9]/g, '_') : 'Full_Ledger';
            const journalPrefix = journalFilter === 'ALL' ? 'General_Ledger' : `${journalFilter}_Journal`;
            const filename = `${journalPrefix}_${cleanAccountName}.pdf`;

            const result = await api.exportPDF(filename);

            if (result && result.success) alert(`Ledger saved successfully to:\n${result.filePath}`);
            else if (result && result.error) alert(`Export Failed: ${result.error}`);
            
        } catch (err: any) {
            alert(`Export Error: ${err.message || "Failed to generate PDF."}`);
        } finally {
            if (sidebar) sidebar.style.display = '';
            if (topHeader) topHeader.style.display = '';
            if (controlsDiv) controlsDiv.style.display = '';
            if (exportBtn) exportBtn.style.display = '';

            if (mainWrapper) {
                mainWrapper.style.overflow = '';
                mainWrapper.style.padding = '';
                mainWrapper.style.backgroundColor = '';
            }
            if (ledgerCard) {
                ledgerCard.style.border = '';
                ledgerCard.style.boxShadow = '';
                ledgerCard.style.padding = '';
            }
            appLayouts.forEach(el => {
                (el as HTMLElement).style.height = '';
                (el as HTMLElement).style.overflow = '';
            });
        }
    };

    return (
        <div id="ledger-card" className="w-full bg-white border border-gray-200 rounded-xl p-8 shadow-sm min-h-[600px] font-sans text-gray-800 animate-in fade-in duration-300">
            
            {/* HEADER MATCHING THE SCREENSHOT */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Ledger</h2>
                    <p className="text-sm font-medium text-gray-600 mt-1">SmartGuys Clinic</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                        For the period of {startDate ? formatVerboseDate(startDate) : 'Start'} to {endDate ? formatVerboseDate(endDate) : 'End'}
                    </p>
                </div>
                <div className="flex gap-2 print:hidden">
                    <button id="export-pdf-btn" onClick={handleExportPDF} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-md text-sm font-bold transition flex items-center space-x-2 cursor-pointer shadow-sm">
                        <span>📄</span> <span>Export</span>
                    </button>
                </div>
            </div>

            {/* STATUS MESSAGE */}
            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border print:hidden ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            {/* CONTROLS (Hidden during Print) */}
            <div id="ledger-controls" className="flex flex-wrap items-end gap-3 mb-6 pb-6 border-b border-gray-100 w-full">
                <div className="w-48">
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Journal Type</label>
                    <select value={journalFilter} onChange={(e) => setJournalFilter(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 font-bold focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition cursor-pointer">
                        <option value="ALL">All (General Ledger)</option>
                        <option value="CRJ">Cash Receipts</option>
                        <option value="CDJ">Cash Disbursements</option>
                        <option value="SJ">Sales Journal</option>
                        <option value="PJ">Purchase Journal</option>
                        <option value="ADJ">Adjusting Entries</option>
                    </select>
                </div>

                <div className="w-72">
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Select Account</label>
                    <select
                        value={selectedAccountId}
                        onChange={(e) => {
                            setSelectedAccountId(e.target.value);
                            if (e.target.value) fetchSingleLedger(e.target.value);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 font-bold focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition cursor-pointer"
                    >
                        <option value="">-- All Accounts --</option>
                        {Object.entries(groupedAccounts).map(([category, accs]: any) => (
                            <optgroup key={category} label={`━━━ ${category.toUpperCase()} ━━━`} className="text-gray-400 font-bold bg-white">
                                {accs.map((acc: any) => (
                                    <option key={acc.code} value={acc.code} className="text-gray-800 font-normal">
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">From Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 font-medium outline-none focus:border-[#1B9387] cursor-pointer" />
                </div>

                <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">To Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 font-medium outline-none focus:border-[#1B9387] cursor-pointer" />
                </div>

                <button onClick={() => { if(selectedAccountId) fetchSingleLedger(selectedAccountId); else fetchFullReport(); }} className="p-2.5 px-6 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition shadow-sm cursor-pointer">
                    Update
                </button>
            </div>

            {loading && <div className="flex justify-center items-center py-20 text-[#1B9387]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div></div>}

            {/* FULL LEDGER REPORT */}
            {!loading && !selectedAccountId && fullLedgerReport.length > 0 && (
                <div className="animate-in fade-in duration-300">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                    <th className="py-3 px-4 font-bold">Date</th>
                                    <th className="py-3 px-4 font-bold">Transaction</th>
                                    <th className="py-3 px-4 font-bold">Description</th>
                                    <th className="py-3 px-4 font-bold">Contact</th>
                                    <th className="py-3 px-4 text-right font-bold">Debit (PHP)</th>
                                    <th className="py-3 px-4 text-right font-bold">Credit (PHP)</th>
                                    <th className="py-3 px-4 text-right font-bold">Balance (PHP)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fullLedgerReport.map((accData: any) => (
                                    <React.Fragment key={accData.accountCode}>
                                        {/* ACCOUNT HEADER */}
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <td colSpan={7} className="py-3 px-4 font-extrabold text-gray-800 text-sm">
                                                {accData.accountCode} {accData.accountName}
                                            </td>
                                        </tr>
                                        {/* OPENING BALANCE */}
                                        <tr className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td colSpan={4} className="py-3 px-4 font-bold text-gray-700 text-sm">Opening Balance</td>
                                            <td className="py-3 px-4 text-right text-sm font-medium text-gray-800">-</td>
                                            <td className="py-3 px-4 text-right text-sm font-medium text-gray-800">-</td>
                                            <td className="py-3 px-4 text-right font-bold text-gray-800 text-sm">
                                                {formatCurrency(accData.openingBalance, true)}
                                            </td>
                                        </tr>
                                        {/* TRANSACTIONS */}
                                        {accData.transactions.map((tx: any) => (
                                            <tr key={tx.id} className={`bg-white hover:bg-gray-50 border-b border-gray-100 transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                                <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">{formatDate(tx.date)}</td>
                                                <td className="py-3 px-4 text-sm font-medium text-gray-800">
                                                    <button onClick={() => { setSelectedTx(tx); setNewRefNo(tx.referenceNo); setIsEditingRef(false); }} className="hover:text-[#1B9387] hover:underline transition cursor-pointer text-left">
                                                        {tx.referenceNo}
                                                    </button>
                                                    {renderStatusBadge(tx.status)}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-700 truncate max-w-[250px]" title={tx.description}>{tx.description}</td>
                                                <td className="py-3 px-4 text-sm text-gray-700">{tx.payeeName === '-' ? '' : tx.payeeName}</td>
                                                <td className="py-3 px-4 text-right text-sm text-gray-800">{formatCurrency(tx.debit)}</td>
                                                <td className="py-3 px-4 text-right text-sm text-gray-800">{formatCurrency(tx.credit)}</td>
                                                <td className="py-3 px-4 text-right text-sm text-gray-800">
                                                    {formatCurrency(tx.balance, true)}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* CLOSING BALANCE */}
                                        <tr className="bg-white border-b-4 border-gray-200">
                                            <td colSpan={4} className="py-3 px-4 font-bold text-gray-800 text-sm">
                                                {accData.accountCode} {accData.accountName} Closing Balance
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-gray-800 text-sm">{formatCurrency(accData.totalDebit)}</td>
                                            <td className="py-3 px-4 text-right font-bold text-gray-800 text-sm">{formatCurrency(accData.totalCredit)}</td>
                                            <td className="py-3 px-4 text-right font-extrabold text-gray-800 text-sm">
                                                {formatCurrency(accData.closingBalance, true)}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SINGLE LEDGER VIEW */}
            {!loading && singleLedgerData && selectedAccountId && (
                <div className="animate-in fade-in duration-300">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                    <th className="py-3 px-4 font-bold">Date</th>
                                    <th className="py-3 px-4 font-bold">Transaction</th>
                                    <th className="py-3 px-4 font-bold">Description</th>
                                    <th className="py-3 px-4 font-bold">Contact</th>
                                    <th className="py-3 px-4 text-right font-bold">Debit (PHP)</th>
                                    <th className="py-3 px-4 text-right font-bold">Credit (PHP)</th>
                                    <th className="py-3 px-4 text-right font-bold">Balance (PHP)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <td colSpan={7} className="py-3 px-4 font-extrabold text-gray-800 text-sm">
                                        {singleLedgerData.accountCode} {singleLedgerData.accountName}
                                    </td>
                                </tr>
                                {startDate && (
                                    <tr className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td colSpan={4} className="py-3 px-4 font-bold text-gray-700 text-sm">Opening Balance</td>
                                        <td className="py-3 px-4 text-right text-sm font-medium text-gray-800">-</td>
                                        <td className="py-3 px-4 text-right text-sm font-medium text-gray-800">-</td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-800 text-sm">
                                            {formatCurrency(ledgerDisplay.beginningBalance, true)}
                                        </td>
                                    </tr>
                                )}

                                {ledgerDisplay.list.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-gray-500 italic text-sm">
                                            No transactions match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    ledgerDisplay.list.map((tx: any) => (
                                        <tr key={tx.id} className={`bg-white hover:bg-gray-50 border-b border-gray-100 transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                            <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">{formatDate(tx.date)}</td>
                                            <td className="py-3 px-4 text-sm font-medium text-gray-800">
                                                <button onClick={() => { setSelectedTx(tx); setNewRefNo(tx.referenceNo); setIsEditingRef(false); }} className="hover:text-[#1B9387] hover:underline transition cursor-pointer text-left">
                                                    {tx.referenceNo}
                                                </button>
                                                {renderStatusBadge(tx.status)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-700 truncate max-w-[250px]" title={tx.description}>{tx.description}</td>
                                            <td className="py-3 px-4 text-sm text-gray-700">{tx.payee === '-' ? '' : tx.payee}</td>
                                            <td className="py-3 px-4 text-right text-sm text-gray-800">{formatCurrency(tx.debit)}</td>
                                            <td className="py-3 px-4 text-right text-sm text-gray-800">{formatCurrency(tx.credit)}</td>
                                            <td className="py-3 px-4 text-right text-sm text-gray-800">
                                                {formatCurrency(tx.balance, true)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* FALLBACK FOR NO DATA */}
            {!loading && !selectedAccountId && fullLedgerReport.length === 0 && (
                <div className="text-center py-20 mt-10">
                    <p className="text-gray-400 italic">No transactions found in this date range.</p>
                </div>
            )}

            {/* ---> DRILL-DOWN MODAL <--- */}
            {selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden p-4">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-full max-w-lg animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                            <div className="flex items-center space-x-3">
                                <h3 className="text-xl font-extrabold text-gray-800 tracking-wide uppercase">Transaction Details</h3>
                                {renderStatusBadge(selectedTx.status)}
                            </div>
                            <button onClick={() => { setSelectedTx(null); setShowVoidInput(false); setIsEditingRef(false); }} className="text-gray-400 hover:text-red-500 font-bold text-xl cursor-pointer transition">×</button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#FBF8F8] p-3 rounded-lg border border-[#B0DCDA] shadow-inner">
                                    <p className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest mb-1">Date</p>
                                    <p className="text-sm text-gray-800 font-mono font-bold">{formatDate(selectedTx.date)}</p>
                                </div>
                                
                                <div className="bg-[#E9FAFA] p-3 rounded-lg border border-[#1B9387]/30 shadow-inner relative group">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-[#1B9387] uppercase font-extrabold tracking-widest">Reference No.</p>
                                        {!isEditingRef && (
                                            <button onClick={() => setIsEditingRef(true)} className="text-[10px] font-bold text-gray-400 hover:text-[#1B9387] uppercase tracking-wider underline cursor-pointer">
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                    
                                    {isEditingRef ? (
                                        <div className="flex mt-1">
                                            <input 
                                                type="text" 
                                                value={newRefNo} 
                                                onChange={(e) => setNewRefNo(e.target.value)} 
                                                className="w-full bg-white border border-[#1B9387] rounded-l px-2 py-1 text-sm font-mono font-bold text-gray-800 outline-none"
                                                autoFocus
                                            />
                                            <button onClick={handleUpdateRefNo} className="bg-[#1B9387] hover:bg-[#28958B] text-white px-3 text-[10px] font-bold uppercase rounded-r cursor-pointer transition">
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#1B9387] font-black font-mono">{selectedTx.referenceNo}</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-[#FBF8F8] p-4 rounded-lg border border-[#B0DCDA] shadow-inner">
                                <p className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest mb-1">Description</p>
                                <p className="text-sm text-gray-800 font-medium">{selectedTx.description}</p>
                            </div>
                            
                            <div className="bg-white p-5 rounded-lg border border-[#B0DCDA] shadow-sm">
                                <p className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest mb-3 border-b border-gray-100 pb-2">Line Impact</p>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-extrabold text-gray-600 uppercase tracking-wider">Debit:</span>
                                    <span className="text-sm font-mono font-bold text-blue-600">{formatCurrency(selectedTx.debit)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-extrabold text-gray-600 uppercase tracking-wider">Credit:</span>
                                    <span className="text-sm font-mono font-bold text-red-500">{formatCurrency(selectedTx.credit)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-6 pt-5 border-t border-gray-100 flex justify-between items-center min-h-[40px]">
                            <div className="flex-1 mr-4">
                                {(!selectedTx.status || selectedTx.status === 'ACTIVE') && !showVoidInput && (
                                    <button onClick={() => setShowVoidInput(true)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md text-xs font-bold transition-colors cursor-pointer uppercase tracking-wider shadow-sm">
                                        ⚠️ Request Void
                                    </button>
                                )}
                                {showVoidInput && (
                                    <div className="flex space-x-2">
                                        <input type="text" autoFocus placeholder="Reason..." value={voidReason} onChange={e => setVoidReason(e.target.value)} className="flex-1 bg-[#FBF8F8] border border-red-200 rounded px-3 py-1.5 text-xs text-gray-800 font-medium outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100" />
                                        <button onClick={submitVoidRequest} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer shadow-sm">Submit</button>
                                        <button onClick={() => setShowVoidInput(false)} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-xs font-bold cursor-pointer shadow-sm">Cancel</button>
                                    </div>
                                )}
                            </div>
                            {!showVoidInput && (
                                <button onClick={() => { setSelectedTx(null); setIsEditingRef(false); }} className="px-6 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md font-bold transition-colors text-sm cursor-pointer shadow-sm">
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