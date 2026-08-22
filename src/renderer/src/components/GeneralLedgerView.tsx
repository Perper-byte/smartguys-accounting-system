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
    
    // Default dates from feature branch
    const [startDate, setStartDate] = useState(getLocalDateString(firstDay));
    const [endDate, setEndDate] = useState(getLocalDateString(today));
    
    // New filter from main branch
    const [journalFilter, setJournalFilter] = useState<string>('ALL');
    
    // Voiding UI states from feature branch
    const [selectedTx, setSelectedTx] = useState<any | null>(null); 
    const [showVoidInput, setShowVoidInput] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // FETCH ACCOUNTS (From main branch)
    useEffect(() => {
        const api = (window as any).electronAPI || (window as any).api;
        if (api && api.getAccounts) {
            api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
        }
    }, []);

    // GROUP ACCOUNTS BY CATEGORY (From main branch)
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

    // LEDGER FETCHERS (From feature branch)
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

// 🔥 NEW: Advanced client-side filtering for Dates and Journal Types (From main branch)
    const ledgerDisplay = useMemo(() => {
        // Using singleLedgerData to match the state we set up in the previous step!
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
                // @ts-ignore - In case selectedAccountId is defined higher up in the component
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
    }, [singleLedgerData, startDate, endDate, journalFilter]);

    // Better currency formatting for negative balances (From feature branch)
    const formatCurrency = (amount: number, isBalanceColumn: boolean = false) => {
        if (!amount || amount === 0) return '-';
        const absAmount = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isBalanceColumn && amount < 0 ? `(₱ ${absAmount})` : `₱ ${absAmount}`;
    };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    };

// 🔥 VOID LOGIC (From feature branch)
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
                // @ts-ignore - In case selectedAccountId is defined higher up
                if (typeof selectedAccountId !== 'undefined' && selectedAccountId) {
                    fetchSingleLedger(selectedAccountId); 
                } else {
                    fetchFullReport();
                }
            } else setStatus({ type: 'error', msg: "Failed: " + response.error });
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); }
    };

    // VOID STATUS BADGES (Restyled for Light Mode)
    const renderStatusBadge = (status: string) => {
        if (status === 'PENDING_VOID') return <span className="ml-2 text-[9px] bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm">Pending Void</span>;
        if (status === 'VOIDED') return <span className="ml-2 text-[9px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm">Voided</span>;
        return null;
    };

    // 🔥 THE BULLETPROOF VANILLA JS PDF EXPORT (From main branch)
    const handleExportPDF = async () => {
        if (!singleLedgerData) {
            alert("No ledger data available to export.");
            return;
        }

        // 1. Grab all UI elements
        const sidebar = document.querySelector('aside');
        const topHeader = document.querySelector('header');
        const mainWrapper = document.querySelector('main');
        const appLayouts = document.querySelectorAll('.h-screen, .overflow-hidden, .flex-1');

        const ledgerCard = document.getElementById('ledger-card');
        const controlsDiv = document.getElementById('ledger-controls');
        const subtitle = document.getElementById('ledger-subtitle');
        const exportBtn = document.getElementById('export-pdf-btn');
        const printParams = document.getElementById('print-parameters'); // Our static text header!

        try {
            // 2. FORCE hide the unwanted interactive elements using !important
            if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
            if (topHeader) topHeader.style.setProperty('display', 'none', 'important');
            if (controlsDiv) controlsDiv.style.setProperty('display', 'none', 'important');
            if (subtitle) subtitle.style.setProperty('display', 'none', 'important');
            if (exportBtn) exportBtn.style.setProperty('display', 'none', 'important');

            // 3. FORCE show the print-only parameters
            if (printParams) printParams.style.setProperty('display', 'block', 'important');

            // 4. Stretch the layout for the A4 page
            if (mainWrapper) {
                mainWrapper.style.setProperty('overflow', 'visible', 'important');
                mainWrapper.style.setProperty('padding', '0', 'important');
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

            // 5. Wait a fraction of a second for React to repaint the screen
            await new Promise(resolve => setTimeout(resolve, 150));

            // 6. Snap the PDF
            const api = (window as any).electronAPI || (window as any).api;
            const cleanAccountName = singleLedgerData.accountName.replace(/[^a-zA-Z0-9]/g, '_');
            const journalPrefix = journalFilter === 'ALL' ? 'General_Ledger' : `${journalFilter}_Journal`;
            const filename = `${journalPrefix}_${singleLedgerData.accountCode}_${cleanAccountName}.pdf`;

            const result = await api.exportPDF(filename);

            if (result && result.success) {
                alert(`Ledger saved successfully to:\n${result.filePath}`);
            } else if (result && result.error) {
                alert(`Export Failed: ${result.error}`);
            }
        } catch (err: any) {
            console.error("PDF Export Error:", err);
            alert(`Export Error: ${err.message || "Failed to generate PDF."}`);
        } finally {
            // 7. Instantly restore everything back to normal!
            if (sidebar) sidebar.style.display = '';
            if (topHeader) topHeader.style.display = '';
            if (controlsDiv) controlsDiv.style.display = '';
            if (subtitle) subtitle.style.display = '';
            if (exportBtn) exportBtn.style.display = '';
            if (printParams) printParams.style.display = 'none'; // Hide print params again

            if (mainWrapper) {
                mainWrapper.style.overflow = '';
                mainWrapper.style.padding = '';
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
        <div id="ledger-card" className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm min-h-[550px]">

            {/* HEADER & FILTERS BAR */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6 border-b border-[#B0DCDA] pb-6">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">
                        {journalFilter === 'ALL' ? 'General Ledger' : `${journalFilter} Specialized Journal`}
                    </h2>
                    <p id="ledger-subtitle" className="text-sm text-gray-500 mt-1 font-medium">View chronological transaction history and running balances.</p>
                </div>

                {/* CONTROLS GROUP (Interactive - Hidden during Print) */}
                <div id="ledger-controls" className="flex flex-wrap items-end gap-3 w-full xl:w-auto">
                    <div className="w-48">
                        <label className="block text-[10px] font-extrabold text-[#1B9387] uppercase tracking-wider mb-1">Journal Type</label>
                        <select
                            value={journalFilter}
                            onChange={(e) => setJournalFilter(e.target.value)}
                            className="w-full bg-[#E9FAFA] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-[#1B9387] font-bold focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition cursor-pointer"
                        >
                            <option value="ALL">All (General Ledger)</option>
                            <option value="CRJ">Cash Receipts (CRJ)</option>
                            <option value="CDJ">Cash Disbursements (CDJ)</option>
                            <option value="SJ">Sales Journal (SJ)</option>
                            <option value="PJ">Purchase Journal (PJ)</option>
                            <option value="ADJ">Adjusting Entries (ADJ)</option>
                        </select>
                    </div>

                    <div className="w-64">
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Select Account</label>
                        <select
                            // @ts-ignore - Assuming selectedAccountId exists right below this component block!
                            value={typeof selectedAccountId !== 'undefined' ? selectedAccountId : ''}
                            onChange={(e) => {
                                // @ts-ignore
                                if (typeof setSelectedAccountId !== 'undefined') setSelectedAccountId(e.target.value);
                                if (e.target.value) fetchSingleLedger(e.target.value);
                            }}
                            className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition cursor-pointer"
                        >
                            <option value="">-- Choose Account --</option>
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
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 text-xs text-gray-800 outline-none focus:border-[#1B9387]" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">To Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 text-xs text-gray-800 outline-none focus:border-[#1B9387]" />
                    </div>

                    {(startDate || endDate || journalFilter !== 'ALL') && (
                        <button onClick={() => { setStartDate(''); setEndDate(''); setJournalFilter('ALL'); }} className="p-2 text-xs text-red-500 hover:underline font-bold" title="Clear all filters">
                            Clear
                        </button>
                    )}
                </div>
                
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-[#121214] border border-[#29292e] rounded-md px-3 py-1.5">
                        <span className="text-xs text-gray-500 uppercase font-bold">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <span className="text-xs text-gray-500 uppercase font-bold pl-2 border-l border-[#29292e]">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <button onClick={() => { if(selectedAccountId) fetchSingleLedger(selectedAccountId); else fetchFullReport(); }} className="ml-2 bg-[#4f46e5] hover:bg-[#5b54f6] text-white px-3 py-1 rounded text-xs font-bold transition cursor-pointer">Apply</button>
                    </div>

{/* 🔥 PRINT-ONLY STATIC HEADER (Replaces the controls during PDF export) */}
            <div id="print-parameters" style={{ display: 'none' }} className="mb-6 pb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex space-x-2">
                        <span className="font-extrabold text-gray-500 uppercase tracking-wider">Journal Type:</span>
                        <span className="font-bold text-[#1B9387]">
                            {journalFilter === 'ALL' ? 'General Ledger' : `${journalFilter} Specialized Journal`}
                        </span>
                    </div>
                    <div className="flex space-x-2">
                        <span className="font-extrabold text-gray-500 uppercase tracking-wider">Account Selected:</span>
                        <span className="font-bold text-[#1B9387]">
                            {singleLedgerData ? `${singleLedgerData.accountCode} - ${singleLedgerData.accountName}` : 'All Accounts (Full Ledger)'}
                        </span>
                    </div>
                    {/* Only print Date Range if it was actively filtered */}
                    {(startDate || endDate) && (
                        <div className="flex space-x-2 col-span-2 mt-2">
                            <span className="font-extrabold text-gray-500 uppercase tracking-wider">Filtered Date Range:</span>
                            <span className="font-bold text-[#1B9387]">
                                {startDate ? formatDate(startDate) : 'Beginning of Records'}
                                <span className="text-gray-400 mx-2">TO</span>
                                {endDate ? formatDate(endDate) : 'Present Date'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* STATUS BANNER (From Feature Branch) */}
            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border border-[#B0DCDA]' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            {/* REST OF COMPONENT */}
            {loading && <div className="flex justify-center items-center py-20 text-[#1B9387]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div></div>}

            {/* FULL LEDGER REPORT (From feature branch, styled for light mode) */}
            {!loading && !selectedAccountId && fullLedgerReport.length > 0 && (
                <div className="animate-in fade-in duration-300">
                    <div className="border border-[#B0DCDA] rounded-xl bg-white overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-[#B0DCDA]">
                                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="p-3.5 pl-5 font-extrabold border-r border-[#B0DCDA]">Date</th>
                                    <th className="p-3.5 font-extrabold border-r border-[#B0DCDA]">Reference</th>
                                    <th className="p-3.5 font-extrabold border-r border-[#B0DCDA]">Description</th>
                                    <th className="p-3.5 font-extrabold border-r border-[#B0DCDA]">Contact / Entity</th>
                                    <th className="p-3.5 text-right font-extrabold border-r border-[#B0DCDA]">Debit</th>
                                    <th className="p-3.5 text-right font-extrabold border-r border-[#B0DCDA]">Credit</th>
                                    <th className="p-3.5 pr-5 text-right font-extrabold">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {fullLedgerReport.map((accData: any) => (
                                    <React.Fragment key={accData.accountCode}>
                                        <tr className="bg-[#E9FAFA] border-t-4 border-[#B0DCDA]">
                                            <td colSpan={7} className="p-3.5 pl-5 font-extrabold text-[#1B9387] text-sm tracking-wide">
                                                {accData.accountCode} {accData.accountName}
                                            </td>
                                        </tr>
                                        <tr className="bg-[#FBF8F8]">
                                            <td colSpan={4} className="p-3.5 pl-5 font-bold text-gray-500">Opening Balance</td>
                                            <td className="p-3.5 text-right text-gray-400">-</td>
                                            <td className="p-3.5 text-right text-gray-400">-</td>
                                            <td className={`p-3.5 pr-5 text-right font-mono font-bold ${accData.openingBalance < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                                {formatCurrency(accData.openingBalance, accData.openingBalance < 0)}
                                            </td>
                                        </tr>
                                        {accData.transactions.map((tx: any) => (
                                            <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                                <td className="p-3.5 pl-5 text-sm text-gray-700 font-medium whitespace-nowrap border-r border-[#B0DCDA]">{formatDate(tx.date)}</td>
                                                <td className="p-3.5 text-sm font-mono border-r border-[#B0DCDA]">
                                                    <button onClick={() => setSelectedTx(tx)} className="text-[#1B9387] hover:underline font-bold transition cursor-pointer flex flex-col items-start text-left">
                                                        <span>{tx.referenceNo}</span>
                                                    </button>
                                                    {renderStatusBadge(tx.status)}
                                                </td>
                                                <td className="p-3.5 text-sm text-gray-800 border-r border-[#B0DCDA] max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                                                <td className="p-3.5 text-sm text-gray-800 border-r border-[#B0DCDA]">{tx.payeeName}</td>
                                                <td className="p-3.5 text-sm text-right font-mono font-medium text-gray-800 border-r border-[#B0DCDA]">{formatCurrency(tx.debit)}</td>
                                                <td className="p-3.5 text-sm text-right font-mono font-medium text-gray-800 border-r border-[#B0DCDA]">{formatCurrency(tx.credit)}</td>
                                                <td className={`p-3.5 pr-5 text-sm text-right font-bold font-mono ${tx.balance < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                                                    {formatCurrency(tx.balance, tx.balance < 0)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 border-b-4 border-[#B0DCDA]">
                                            <td colSpan={4} className="p-3.5 pl-5 font-bold text-gray-800 tracking-wide">
                                                {accData.accountCode} {accData.accountName} Closing Balance
                                            </td>
                                            <td className="p-3.5 text-right font-mono text-gray-800 font-bold">{formatCurrency(accData.totalDebit)}</td>
                                            <td className="p-3.5 text-right font-mono text-gray-800 font-bold">{formatCurrency(accData.totalCredit)}</td>
                                            <td className={`p-3.5 pr-5 text-right font-mono font-bold text-lg ${accData.closingBalance < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                                                {formatCurrency(accData.closingBalance, accData.closingBalance < 0)}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* FALLBACK FOR NO DATA */}
            {!loading && !selectedAccountId && fullLedgerReport.length === 0 && (
                <div className="text-center py-24 bg-[#FBF8F8] border border-dashed border-[#B0DCDA] rounded-xl">
                    <div className="text-4xl mb-3">📖</div>
                    <h3 className="text-base font-bold text-gray-700">No Account Selected & No Full Ledger Data</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Please select an account from the dropdown above to inspect its ledger transactions, or hit search for the full ledger.</p>
                </div>
            )}

            {!loading && !singleLedgerData && selectedAccountId && (
                <div className="text-center py-20 bg-[#FBF8F8] border border-dashed border-[#B0DCDA] rounded-xl text-gray-500">
                    <p className="font-medium">No recorded transactions found for this account.</p>
                </div>
            )}

            {/* SINGLE LEDGER VIEW (From main branch) */}
            {!loading && singleLedgerData && selectedAccountId && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center justify-between bg-[#E9FAFA] border border-[#B0DCDA] rounded-t-xl p-5 shadow-sm">
                        <div className="flex items-center space-x-3">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-extrabold text-gray-800">{singleLedgerData.accountCode} - {singleLedgerData.accountName}</h3>
                                    <span className="bg-white text-[#1B9387] border border-[#B0DCDA] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                        {singleLedgerData.normalBalance} Normal
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    Showing {ledgerDisplay.list.length} transaction records {journalFilter !== 'ALL' && `(Filtered: ${journalFilter})`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6">
                            <button id="export-pdf-btn" onClick={handleExportPDF} className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-1.5">
                                <span>📄</span> <span>Export {journalFilter === 'ALL' ? 'Ledger' : journalFilter} PDF</span>
                            </button>

                            <div className="text-right border-l border-[#B0DCDA] pl-6">
                                <p className="text-xs text-gray-500 uppercase font-extrabold tracking-wider">Current Balance</p>
                                <p className={`text-2xl font-bold font-mono mt-0.5 ${ledgerDisplay.list.length > 0 && ledgerDisplay.list[ledgerDisplay.list.length - 1].balance < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                                    {ledgerDisplay.list.length > 0 ? formatCurrency(ledgerDisplay.list[ledgerDisplay.list.length - 1].balance, true) : '₱ 0.00'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border border-t-0 border-[#B0DCDA] rounded-b-xl bg-white overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-[#B0DCDA]">
                                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="p-3.5 pl-5 font-extrabold border-r border-[#B0DCDA]">Date</th>
                                    <th className="p-3.5 font-extrabold border-r border-[#B0DCDA]">Reference</th>
                                    <th className="p-3.5 font-extrabold border-r border-[#B0DCDA]">Description</th>
                                    <th className="p-3.5 text-right font-extrabold border-r border-[#B0DCDA]">Debit</th>
                                    <th className="p-3.5 text-right font-extrabold border-r border-[#B0DCDA]">Credit</th>
                                    <th className="p-3.5 pr-5 text-right font-extrabold">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {startDate && (
                                    <tr className="bg-[#E9FAFA]/30 border-b border-[#B0DCDA]">
                                        <td className="p-3.5 pl-5 text-sm text-gray-500 font-bold italic border-r border-[#B0DCDA]" colSpan={3}>
                                            Beginning Balance (Carried Forward)
                                        </td>
                                        <td className="p-3.5 border-r border-[#B0DCDA]"></td>
                                        <td className="p-3.5 border-r border-[#B0DCDA]"></td>
                                        <td className={`p-3.5 pr-5 text-sm text-right font-bold font-mono ${ledgerDisplay.beginningBalance < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                                            {formatCurrency(ledgerDisplay.beginningBalance, true)}
                                        </td>
                                    </tr>
                                )}

                                {ledgerDisplay.list.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-500 text-sm italic">
                                            No transactions match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    ledgerDisplay.list.map((tx: any) => (
                                        <tr key={tx.id} className={`even:bg-[#FBF8F8] odd:bg-white hover:bg-[#E9FAFA]/60 transition ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                            <td className="p-3.5 pl-5 text-sm text-gray-700 font-medium whitespace-nowrap border-r border-[#B0DCDA]">{formatDate(tx.date)}</td>
                                            <td className="p-3.5 text-sm text-gray-800 font-mono font-bold whitespace-nowrap border-r border-[#B0DCDA]">
                                                <button onClick={() => setSelectedTx(tx)} className="text-[#1B9387] hover:underline transition cursor-pointer flex flex-col items-start text-left">
                                                    <span>{tx.referenceNo}</span>
                                                </button>
                                                {renderStatusBadge(tx.status)}
                                            </td>
                                            <td className="p-3.5 text-sm text-gray-800 border-r border-[#B0DCDA]">
                                                <span className="font-medium">{tx.description}</span>
                                                {tx.payee && tx.payee !== '-' && (
                                                    <span className="block text-xs text-gray-500 mt-0.5 font-sans">Payee / Source: {tx.payee}</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-sm text-right text-gray-800 font-mono font-medium border-r border-[#B0DCDA]">{formatCurrency(tx.debit)}</td>
                                            <td className="p-3.5 text-sm text-right text-gray-800 font-mono font-medium border-r border-[#B0DCDA]">{formatCurrency(tx.credit)}</td>
                                            <td className={`p-3.5 pr-5 text-sm text-right font-bold font-mono ${tx.balance < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                                                {formatCurrency(tx.balance, true)}
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