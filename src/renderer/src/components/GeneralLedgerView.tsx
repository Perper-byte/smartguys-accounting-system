// src/renderer/src/components/GeneralLedgerView.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';

export const GeneralLedgerView: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [ledgerData, setLedgerData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    // DATE RANGE FILTER STATES
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [journalFilter, setJournalFilter] = useState<string>('ALL');

    useEffect(() => {
        const api = (window as any).electronAPI;
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

    const ledgerDisplay = useMemo(() => {
        if (!ledgerData || !ledgerData.transactions) return { list: [], beginningBalance: 0 };

        let beginningBalance = 0;
        let filtered = ledgerData.transactions;

        if (startDate) {
            const pastTx = ledgerData.transactions.filter((tx: any) => new Date(tx.date).toISOString().split('T')[0] < startDate);
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
                if (journalFilter === 'CRJ') return ref.startsWith('OR-') || (selectedAccountId === '1010' && tx.debit > 0);
                if (journalFilter === 'CDJ') return ref.startsWith('CV-') || (selectedAccountId === '1010' && tx.credit > 0);
                if (journalFilter === 'PJ') return ref.startsWith('PV-') || (selectedAccountId === '2010' && tx.credit > 0);
                if (journalFilter === 'SJ') return ref.startsWith('INV-') || (selectedAccountId === '1200' && tx.debit > 0);
                if (journalFilter === 'ADJ') return ref.startsWith('ADJ-');
                return true;
            });
        }

        return { list: filtered, beginningBalance };
    }, [ledgerData, startDate, endDate, journalFilter, selectedAccountId]);

    const formatCurrency = (amount: number) => {
        if (amount === 0) return '—';
        return `₱ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    // 🔥 THE BULLETPROOF VANILLA JS PDF EXPORT
    const handleExportPDF = async () => {
        if (!ledgerData) {
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
        const printParams = document.getElementById('print-parameters'); // Our new static text header!

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
            const api = (window as any).electronAPI;
            const cleanAccountName = ledgerData.accountName.replace(/[^a-zA-Z0-9]/g, '_');
            const journalPrefix = journalFilter === 'ALL' ? 'General_Ledger' : `${journalFilter}_Journal`;
            const filename = `${journalPrefix}_${ledgerData.accountCode}_${cleanAccountName}.pdf`;

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
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
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
                            {ledgerData ? `${ledgerData.accountCode} - ${ledgerData.accountName}` : 'None'}
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

            {/* REST OF COMPONENT */}
            {loading && <div className="flex justify-center items-center py-20 text-[#1B9387]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div></div>}

            {!loading && !selectedAccountId && (
                <div className="text-center py-24 bg-[#FBF8F8] border border-dashed border-[#B0DCDA] rounded-xl">
                    <div className="text-4xl mb-3">📖</div>
                    <h3 className="text-base font-bold text-gray-700">No Account Selected</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Please select an account from the dropdown above to inspect its ledger transactions.</p>
                </div>
            )}

            {!loading && !ledgerData && selectedAccountId && (
                <div className="text-center py-20 bg-[#FBF8F8] border border-dashed border-[#B0DCDA] rounded-xl text-gray-500">
                    <p className="font-medium">No recorded transactions found for this account.</p>
                </div>
            )}

            {!loading && ledgerData && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center justify-between bg-[#E9FAFA] border border-[#B0DCDA] rounded-t-xl p-5 shadow-sm">
                        <div className="flex items-center space-x-3">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-extrabold text-gray-800">{ledgerData.accountCode} - {ledgerData.accountName}</h3>
                                    <span className="bg-white text-[#1B9387] border border-[#B0DCDA] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                        {ledgerData.normalBalance} Normal
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
                                    {ledgerDisplay.list.length > 0 ? formatCurrency(ledgerDisplay.list[ledgerDisplay.list.length - 1].balance) : '₱ 0.00'}
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
                                            {formatCurrency(ledgerDisplay.beginningBalance)}
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
                                        <tr key={tx.id} className="even:bg-[#FBF8F8] odd:bg-white hover:bg-[#E9FAFA]/60 transition">
                                            <td className="p-3.5 pl-5 text-sm text-gray-700 font-medium whitespace-nowrap border-r border-[#B0DCDA]">{formatDate(tx.date)}</td>
                                            <td className="p-3.5 text-sm text-gray-800 font-mono font-bold whitespace-nowrap border-r border-[#B0DCDA]">{tx.referenceNo}</td>
                                            <td className="p-3.5 text-sm text-gray-800 border-r border-[#B0DCDA]">
                                                <span className="font-medium">{tx.description}</span>
                                                {tx.payee && tx.payee !== '-' && (
                                                    <span className="block text-xs text-gray-500 mt-0.5 font-sans">Payee / Source: {tx.payee}</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-sm text-right text-gray-800 font-mono font-medium border-r border-[#B0DCDA]">{formatCurrency(tx.debit)}</td>
                                            <td className="p-3.5 text-sm text-right text-gray-800 font-mono font-medium border-r border-[#B0DCDA]">{formatCurrency(tx.credit)}</td>
                                            <td className={`p-3.5 pr-5 text-sm text-right font-bold font-mono ${tx.balance < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
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