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

    const formatCurrency = (amount: number) => {
        if (!amount || amount === 0) return '-';
        return `₱ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    };

    const handleExportCSV = () => {
        if (data.length === 0) return alert("No data to export.");
        
        const headers = ['Date', 'Reference No', 'Payee/Entity', 'Description', 'Account Code', 'Account Name', 'Debit', 'Credit'];
        const rows = data.map(row => [
            new Date(row.date).toLocaleDateString(),
            row.referenceNo,
            `"${row.payeeName}"`,
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
        switch(bookType) {
            case 'SJ': return 'Sales Journal';
            case 'CRJ': return 'Cash Receipts Journal';
            case 'CDJ': return 'Cash Disbursements Journal';
            case 'PJ': return 'Purchase Journal'; // ---> NEWLY ADDED TAB <---
            case 'GJ': return 'General Journal';
            default: return 'Journal';
        }
    };

    const totalDebit = data.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = data.reduce((sum, row) => sum + row.credit, 0);

    return (
        <div className="max-w-6xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg min-h-[600px] flex flex-col font-sans">
            
            <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">BIR Books of Accounts</h2>
                    <p className="text-sm text-gray-400 mt-1">CAS-compliant mandatory journals export module.</p>
                </div>
                
                <div className="flex flex-col items-end space-y-3">
                    {/* Date Filters */}
                    <div className="flex items-center space-x-2 bg-[#121214] border border-[#29292e] rounded-md px-3 py-1">
                        <span className="text-xs text-gray-500 uppercase font-bold">From:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <span className="text-xs text-gray-500 uppercase font-bold pl-2 border-l border-[#29292e]">To:</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <button onClick={fetchBooks} className="ml-2 bg-[#4f46e5] hover:bg-[#5b54f6] text-white px-3 py-1 rounded text-xs font-bold transition">Apply</button>
                    </div>

                    <div className="flex space-x-4">
                        {/* Book Selection (All 5 Books) */}
                        <div className="flex bg-[#121214] p-1 rounded-md border border-[#29292e]">
                            <button onClick={() => setBookType('SJ')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${bookType === 'SJ' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Sales</button>
                            <button onClick={() => setBookType('CRJ')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${bookType === 'CRJ' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Receipts</button>
                            <button onClick={() => setBookType('PJ')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${bookType === 'PJ' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Purchases</button>
                            <button onClick={() => setBookType('CDJ')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${bookType === 'CDJ' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Disbursements</button>
                            <button onClick={() => setBookType('GJ')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${bookType === 'GJ' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>General</button>
                        </div>
                        <button onClick={handleExportCSV} disabled={data.length === 0} className="flex items-center space-x-2 bg-[#29292e] hover:bg-[#323238] disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition border border-[#323238] cursor-pointer">
                            <span>📥</span><span>Export CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-[#121214] border border-[#29292e] rounded-md flex-1 flex flex-col overflow-hidden">
                <div className="bg-[#1a1a1e] p-4 border-b border-[#29292e]">
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest">{getBookTitle()}</h3>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                         <div className="flex justify-center items-center h-full text-[#4f46e5] animate-pulse">Loading Journal...</div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#202024] sticky top-0 z-10 shadow-sm border-b border-[#29292e]">
                                <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
                                    <th className="p-4 font-bold">Date</th>
                                    <th className="p-4 font-bold">Ref No.</th>
                                    <th className="p-4 font-bold">Account</th>
                                    <th className="p-4 font-bold">Payee / Description</th>
                                    <th className="p-4 font-bold text-right">Debit</th>
                                    <th className="p-4 font-bold text-right">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50">
                                {data.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">No entries found for this book in the selected date range.</td></tr>
                                ) : (
                                    data.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-[#2a2a2f] transition-colors">
                                            <td className="p-4 text-gray-400">{new Date(row.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono text-[#4f46e5] font-bold">{row.referenceNo}</td>
                                            <td className="p-4">
                                                <p className="font-mono text-gray-300">{row.accountCode}</p>
                                                <p className="text-xs text-gray-500 truncate w-48">{row.accountName}</p>
                                            </td>
                                            <td className="p-4">
                                                {row.payeeName && <p className="font-bold text-white">{row.payeeName}</p>}
                                                <p className="text-xs text-gray-400 truncate w-64" title={row.description}>{row.description}</p>
                                            </td>
                                            <td className="p-4 text-right font-mono text-emerald-400">{formatCurrency(row.debit)}</td>
                                            <td className="p-4 text-right font-mono text-red-400">{formatCurrency(row.credit)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="bg-[#1a1a1e] border-t border-[#29292e] p-4 flex justify-end space-x-12 shadow-inner">
                    <div className="flex justify-between items-center space-x-4">
                        <span className="text-[#8d8d99] font-bold uppercase tracking-wider text-xs">Total Debit</span>
                        <span className="text-white font-mono font-bold text-lg">₱ {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center space-x-4">
                        <span className="text-[#8d8d99] font-bold uppercase tracking-wider text-xs">Total Credit</span>
                        <span className="text-white font-mono font-bold text-lg">₱ {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}