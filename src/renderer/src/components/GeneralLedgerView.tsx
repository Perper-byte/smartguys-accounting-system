// src/renderer/src/components/GeneralLedgerView.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';

export const GeneralLedgerView: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [ledgerData, setLedgerData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

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

        return { list: filtered, beginningBalance };
    }, [ledgerData, startDate, endDate]);

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

        try {
            // 1. Add global printing class to instantly hide UI sidebars/headers
            document.body.classList.add('is-printing');

            // 2. Wait 150ms for the browser to visually apply the CSS
            await new Promise(resolve => setTimeout(resolve, 150));

            // 3. Tell Electron to snap the PDF
            const api = (window as any).electronAPI;
            const cleanAccountName = ledgerData.accountName.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `General_Ledger_${ledgerData.accountCode}_${cleanAccountName}.pdf`;

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
            // 4. Instantly restore everything back to normal!
            document.body.classList.remove('is-printing');
        }
    };

    return (
        <div id="ledger-card" className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm min-h-[550px]">

            {/* HEADER & FILTERS BAR */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6 border-b border-[#B0DCDA] pb-6">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">General Ledger</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">View chronological transaction history and running balances.</p>
                </div>

                {/* CONTROLS GROUP (Given an ID for hiding) */}
                <div id="ledger-controls" className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
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
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 text-xs text-gray-800 outline-none focus:border-[#1B9387]"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 text-xs text-gray-800 outline-none focus:border-[#1B9387]"
                        />
                    </div>

                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="p-2 text-xs text-red-500 hover:underline font-bold"
                            title="Clear date filter"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-20 text-[#1B9387]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                </div>
            )}

            {!loading && !selectedAccountId && (
                <div className="text-center py-24 bg-[#FBF8F8] border border-dashed border-[#B0DCDA] rounded-xl">
                    <div className="text-4xl mb-3">📖</div>
                    <h3 className="text-base font-bold text-gray-700">No Account Selected</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                        Please select an account from the dropdown above to inspect its ledger transactions, debits, credits, and chronological running balance.
                    </p>
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
                                    Showing {ledgerDisplay.list.length} transaction records
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6">
                            {/* EXPORT BUTTON (Given an ID for hiding) */}
                            <button
                                id="export-pdf-btn"
                                onClick={handleExportPDF}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-1.5"
                            >
                                <span>📄</span> <span>Export Ledger PDF</span>
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
                                    <th className="p-3.5 pr-5 text-right font-extrabold">Running Balance</th>
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
                                            No transactions match the selected date range.
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