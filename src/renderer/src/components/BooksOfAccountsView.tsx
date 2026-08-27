// src/renderer/src/components/BooksOfAccountsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

const getLocalDateString = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export function BooksOfAccountsView() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getLocalDateString(firstDay));
    const [endDate, setEndDate] = useState(getLocalDateString(today));

    // Defaulting to the Sales Journal
    const [bookType, setBookType] = useState('SJ');

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.getBooksOfAccounts(bookType, startDate, endDate);
            setData(result || []);
        } catch (error) {
            console.error("Failed to fetch books", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, [bookType]);

    // UX: Return null/dash for zeros to keep the ledger clean
    const formatCurrency = (amount: number) => {
        if (!amount || amount === 0) return null;
        return `₱ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleExportCSV = () => {
        if (data.length === 0) return alert("No data to export.");

        const headers = ['Date', 'Reference No', 'Payee/Entity', 'Description', 'Account Code', 'Account Name', 'Debit', 'Credit'];
        const rows = data.map(row => [
            new Date(row.date).toLocaleDateString(),
            row.referenceNo,
            `"${row.payeeName || ''}"`,
            `"${row.description.replace(/"/g, '""')}"`,
            row.accountCode,
            `"${row.accountName}"`,
            row.debit > 0 ? row.debit : '',
            row.credit > 0 ? row.credit : ''
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `BIR_Book_${bookType}_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getBookTitle = () => {
        switch (bookType) {
            case 'SJ': return 'Sales Journal';
            case 'CRJ': return 'Cash Receipts Journal';
            case 'CDJ': return 'Cash Disbursements Journal';
            case 'PJ': return 'Purchase Journal';
            case 'GJ': return 'General Journal';
            default: return 'Journal';
        }
    };

    const totalDebit = data.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = data.reduce((sum, row) => sum + row.credit, 0);

    return (
        // ✨ UX FIX: Full-page flex centering wrapper
        <div className="w-full h-full flex items-center justify-center p-4 lg:p-8 bg-gray-50/30">
            <div className="w-full max-w-7xl h-full bg-white border border-transparent rounded-xl p-6 shadow-sm flex flex-col font-sans text-gray-800">

                {/* HEADER */}
                <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-6 shrink-0">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">BIR Books of Accounts</h2>
                        <p className="text-sm text-gray-500 mt-1 font-medium">CAS-compliant mandatory journals export module.</p>
                    </div>

                    <div className="flex flex-col items-end space-y-4">

                        {/* DATE FILTERS */}
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-white border border-[#B0DCDA] rounded-md px-3 py-1.5 shadow-sm">
                                <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider">From</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm text-gray-800 font-bold outline-none cursor-pointer" />
                                <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider pl-3 border-l border-gray-200">To</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm text-gray-800 font-bold outline-none cursor-pointer" />
                            </div>
                            <button onClick={fetchBooks} disabled={loading} className="bg-[#E9FAFA] hover:bg-[#1B9387] text-[#1B9387] hover:text-white border border-[#B0DCDA] hover:border-[#1B9387] px-4 py-2 rounded-md text-xs font-extrabold uppercase tracking-wider transition cursor-pointer shadow-sm disabled:opacity-50">
                                {loading ? '...' : 'Apply'}
                            </button>
                        </div>

                        {/* TABS & EXPORT */}
                        <div className="flex space-x-4">
                            {/* Segmented Control for Books */}
                            <div className="flex bg-[#FBF8F8] p-1 rounded-lg border border-[#B0DCDA] shadow-inner">
                                {(['SJ', 'CRJ', 'PJ', 'CDJ', 'GJ']).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setBookType(type)}
                                        className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${bookType === type ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
                                    >
                                        {type === 'SJ' ? 'Sales' : type === 'CRJ' ? 'Receipts' : type === 'PJ' ? 'Purchases' : type === 'CDJ' ? 'Disbursements' : 'General'}
                                    </button>
                                ))}
                            </div>
                            <button onClick={handleExportCSV} disabled={data.length === 0} className="flex items-center space-x-2 bg-white hover:bg-[#FBF8F8] disabled:opacity-50 text-gray-700 px-4 py-2 rounded-md text-sm font-bold transition border border-[#B0DCDA] cursor-pointer shadow-sm">
                                <span>📥</span><span className="text-xs uppercase tracking-wider">Export CSV</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* MAIN LEDGER TABLE */}
                <div className="bg-white border border-[#B0DCDA] rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">

                    {/* Table Title Bar */}
                    <div className="bg-[#FBF8F8] p-4 border-b border-[#B0DCDA] flex justify-between items-center shrink-0">
                        <h3 className="text-base font-extrabold text-gray-800 uppercase tracking-widest">{getBookTitle()}</h3>
                        <span className="text-xs font-bold text-gray-500">{data.length} entries found</span>
                    </div>

                    {/* Table Content */}
                    <div className="flex-1 overflow-auto relative">
                        {loading ? (
                            <div className="absolute inset-0 flex justify-center items-center bg-white/50 backdrop-blur-sm z-20 text-[#1B9387] font-bold animate-pulse">
                                Loading Journal Data...
                            </div>
                        ) : null}

                        <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                            <thead className="bg-white sticky top-0 z-10 shadow-[0_2px_5px_rgba(0,0,0,0.02)] border-b-2 border-gray-100">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 pl-6">Date</th>
                                    <th className="p-4">Ref No.</th>
                                    <th className="p-4">Account</th>
                                    <th className="p-4">Payee / Description</th>
                                    <th className="p-4 text-right">Debit (₱)</th>
                                    <th className="p-4 text-right pr-6">Credit (₱)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-16 text-center text-gray-400">
                                            <span className="block text-4xl mb-3 opacity-50">📂</span>
                                            <span className="italic font-medium text-sm">No entries found for this book in the selected date range.</span>
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row: any, i: number) => {
                                        const debitStr = formatCurrency(row.debit);
                                        const creditStr = formatCurrency(row.credit);

                                        return (
                                            <tr key={i} className="hover:bg-[#E9FAFA]/40 transition-colors group">
                                                <td className="p-4 pl-6 text-gray-500 font-medium">{new Date(row.date).toLocaleDateString()}</td>
                                                <td className="p-4 font-mono text-[#1B9387] font-extrabold">{row.referenceNo}</td>
                                                <td className="p-4">
                                                    <p className="font-mono font-bold text-gray-800">{row.accountCode}</p>
                                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 truncate w-48 font-bold mt-0.5">{row.accountName}</p>
                                                </td>
                                                <td className="p-4">
                                                    {row.payeeName && <p className="font-extrabold text-gray-800">{row.payeeName}</p>}
                                                    <p className={`text-xs truncate w-72 mt-0.5 ${row.payeeName ? 'text-gray-500' : 'text-gray-800 font-bold'}`} title={row.description}>{row.description}</p>
                                                </td>
                                                <td className="p-4 text-right font-mono tabular-nums text-gray-800">
                                                    {debitStr ? <span className="font-bold">{debitStr}</span> : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="p-4 pr-6 text-right font-mono tabular-nums text-gray-800">
                                                    {creditStr ? <span className="font-bold">{creditStr}</span> : <span className="text-gray-300">-</span>}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* STICKY FOOTER TOTALS */}
                    <div className="bg-[#FBF8F8] border-t border-[#B0DCDA] p-5 px-6 flex justify-end space-x-16 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] shrink-0 z-20">
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-500 font-extrabold uppercase tracking-widest text-[10px]">Total Debit</span>
                            <span className="text-gray-800 font-mono font-black text-xl tabular-nums">₱ {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-500 font-extrabold uppercase tracking-widest text-[10px]">Total Credit</span>
                            <span className="text-gray-800 font-mono font-black text-xl tabular-nums">₱ {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}