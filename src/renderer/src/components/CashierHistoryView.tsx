import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

export function CashierHistoryView({ userId }: { userId: string }) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Void states
    const [voidReason, setVoidReason] = useState('');
    const [showVoidId, setShowVoidId] = useState<string | null>(null);

    // States for Search, Filter, and Pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all'); 
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getUserSalesHistory(userId);
            setTransactions(data || []);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [userId]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, dateFilter]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesSearch = tx.referenceNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  tx.payeeName.toLowerCase().includes(searchQuery.toLowerCase());
            
            const txDate = new Date(tx.date);
            const now = new Date();
            let matchesDate = true;

            if (dateFilter === 'today') {
                matchesDate = txDate.toDateString() === now.toDateString();
            } else if (dateFilter === 'week') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                matchesDate = txDate >= oneWeekAgo;
            } else if (dateFilter === 'month') {
                matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
            }

            return matchesSearch && matchesDate;
        });
    }, [transactions, searchQuery, dateFilter]);

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const getPaymentMethod = (desc: string) => {
        const d = (desc || '').toUpperCase();
        if (d.includes('GCASH')) return 'GCASH';
        if (d.includes('CASH')) return 'CASH';
        if (d.includes('CHECK')) return 'CHECK';
        if (d.includes('CARD') || d.includes('CREDIT')) return 'CARD';
        if (d.includes('HMO') || d.includes('MAXICARE')) return 'HMO';
        return 'SYSTEM';
    };

    const formatDateTime = (isoString: string) => {
        const d = new Date(isoString);
        const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
        return `${d.toLocaleDateString('en-US', dateOpts)} • ${d.toLocaleTimeString('en-US', timeOpts)}`;
    };

    const submitVoidRequest = async (id: string) => {
        setStatusMessage(null);
        if (!voidReason || !voidReason.trim()) return setStatusMessage({ type: 'error', msg: "Void reason is required." });
        
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const response = await api.requestVoid(id, voidReason);
            if (response.success) {
                setStatusMessage({ type: 'success', msg: `Void requested! Awaiting manager approval.` });
                setShowVoidId(null);
                setVoidReason('');
                fetchHistory();
                setTimeout(() => setStatusMessage(null), 4000);
            } else {
                setStatusMessage({ type: 'error', msg: "Failed: " + response.error });
            }
        } catch (error) { 
            setStatusMessage({ type: 'error', msg: "System Error." }); 
        }
    };

    const handleExportExcel = () => {
        if (filteredTransactions.length === 0) return alert("No data to export.");

        const exportData = filteredTransactions.map(tx => ({
            'Date & Time': formatDateTime(tx.date),
            'Reference No.': tx.referenceNo,
            'Patient / Entity': tx.payeeName,
            'Payment Method': getPaymentMethod(tx.description),
            'Description': tx.description,
            'Total Amount (PHP)': tx.totalAmount,
            'Status': tx.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
        XLSX.writeFile(workbook, `Transaction_History_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const renderStatusBadge = (status: string) => {
        if (status === 'ACTIVE') return <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Active</span>;
        if (status === 'PENDING_VOID') return <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Pending Void</span>;
        if (status === 'VOIDED') return <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-500 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm line-through">Voided</span>;
        return null;
    };

    return (
        /* 🔥 ADDED 'w-full px-6 py-4' HERE TO FORCE CENTERING */
        <div className="w-full max-w-7xl mx-auto px-6 py-4 h-full flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">
            
            {/* HEADER & CONTROLS */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6 border-b border-[#B0DCDA] pb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Transaction History</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Review your recent invoices and receipts, or request a void for mistakes.</p>
                </div>
                
                <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                    <div className="flex-1 lg:w-64">
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Search</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-sm">🔍</span>
                            <input
                                type="text"
                                placeholder="Patient or Ref No..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md py-2 pl-8 pr-3 text-sm text-gray-800 font-bold outline-none focus:border-[#1B9387]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Date Range</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-sm">📅</span>
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-36 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md py-2 pl-8 pr-3 text-sm text-gray-800 font-bold outline-none cursor-pointer focus:border-[#1B9387]"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>
                    </div>

                    <button onClick={handleExportExcel} className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2 cursor-pointer h-[38px]">
                        <span>📊</span> <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

            {/* TABLE */}
            <div className="bg-white border border-[#B0DCDA] rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[#1B9387]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] sticky top-0 z-10 border-b border-[#B0DCDA] shadow-sm">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100">Date & Time</th>
                                    <th className="p-4 border-r border-gray-100">Reference No.</th>
                                    <th className="p-4 border-r border-gray-100">Patient / Entity</th>
                                    <th className="p-4 border-r border-gray-100">Method</th>
                                    <th className="p-4 text-right border-r border-gray-100">Total Amount</th>
                                    <th className="p-4 text-center border-r border-gray-100">Status</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedTransactions.length === 0 ? (
                                    <tr><td colSpan={7} className="p-12 text-center text-gray-500 italic font-medium">No transactions found.</td></tr>
                                ) : (
                                    paginatedTransactions.map((tx) => (
                                        <React.Fragment key={tx.id}>
                                            <tr className={`hover:bg-gray-50 transition-colors ${tx.status === 'VOIDED' ? 'bg-gray-100 opacity-60' : 'even:bg-gray-50/50 odd:bg-white'} group`}>
                                                
                                                <td className="p-4 text-gray-600 font-medium whitespace-nowrap border-r border-gray-100">
                                                    {formatDateTime(tx.date)}
                                                </td>
                                                
                                                <td 
                                                    onClick={() => console.log("Open receipt for:", tx.referenceNo)} 
                                                    className="p-4 border-r border-gray-100 font-mono font-extrabold text-[#1B9387] hover:underline cursor-pointer"
                                                >
                                                    {tx.referenceNo}
                                                </td>

                                                <td className="p-4 font-bold text-gray-800 border-r border-gray-100">{tx.payeeName}</td>
                                                
                                                <td className="p-4 text-gray-600 font-medium border-r border-gray-100">
                                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-[10px] font-extrabold tracking-wider">
                                                        {getPaymentMethod(tx.description)}
                                                    </span>
                                                </td>

                                                <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100">{formatCurrency(tx.totalAmount)}</td>
                                                
                                                <td className="p-4 text-center border-r border-gray-100">
                                                    {renderStatusBadge(tx.status)}
                                                </td>

                                                <td className="p-4 text-center space-x-2 whitespace-nowrap flex items-center justify-center h-full">
                                                    <button 
                                                        title="Print / View Receipt"
                                                        onClick={() => console.log("Print", tx.referenceNo)}
                                                        className="text-gray-400 group-hover:text-[#1B9387] transition p-1.5 rounded-md hover:bg-white border border-transparent hover:border-[#B0DCDA]"
                                                    >
                                                        🖨️
                                                    </button>
                                                    {tx.status === 'ACTIVE' && (
                                                        <button 
                                                            onClick={() => setShowVoidId(showVoidId === tx.id ? null : tx.id)} 
                                                            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded bg-white border border-gray-300 text-red-500 hover:bg-red-50 hover:border-red-200 transition shadow-sm cursor-pointer"
                                                        >
                                                            Void
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            
                                            {showVoidId === tx.id && (
                                                <tr className="bg-[#FBF8F8] border-b border-[#B0DCDA] shadow-inner">
                                                    <td colSpan={7} className="p-5 border-l-4 border-l-red-400">
                                                        <div className="flex items-center space-x-4 max-w-3xl mx-auto bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                                                            <span className="text-2xl">⚠️</span>
                                                            <div className="flex-1">
                                                                <p className="text-xs font-extrabold text-red-500 uppercase tracking-wider mb-1">Request Void for {tx.referenceNo}</p>
                                                                <input 
                                                                    type="text" 
                                                                    autoFocus
                                                                    placeholder="Reason for voiding this transaction..." 
                                                                    value={voidReason} 
                                                                    onChange={e => setVoidReason(e.target.value)} 
                                                                    className="w-full bg-[#FBF8F8] border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 transition" 
                                                                />
                                                            </div>
                                                            <div className="flex flex-col space-y-2 mt-4">
                                                                <button onClick={() => submitVoidRequest(tx.id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-xs font-bold transition shadow-sm cursor-pointer">Submit Request</button>
                                                                <button onClick={() => { setShowVoidId(null); setVoidReason(''); }} className="bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded text-xs font-bold transition shadow-sm cursor-pointer">Cancel</button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Pagination Footer */}
            {!loading && filteredTransactions.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 text-sm text-gray-500">
                    <div className="mb-4 sm:mb-0">
                        Showing <span className="font-bold text-gray-800">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredTransactions.length)}</span> of <span className="font-bold text-gray-800">{filteredTransactions.length}</span> transactions
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border border-[#B0DCDA] rounded-md bg-[#FBF8F8] hover:bg-[#E9FAFA] text-gray-700 font-bold text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            &larr; Prev
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage * itemsPerPage >= filteredTransactions.length}
                            className="px-4 py-2 border border-[#B0DCDA] rounded-md bg-[#FBF8F8] hover:bg-[#E9FAFA] text-gray-700 font-bold text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            Next &rarr;
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}