import * as React from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // 🔥 EXCEL EXPORT LIBRARY

export function CashierHistoryView({ userId }: { userId: string }) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Void states
    const [voidReason, setVoidReason] = useState('');
    const [showVoidId, setShowVoidId] = useState<string | null>(null);

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

    // 🔥 HANDLE EXCEL EXPORT
    const handleExportExcel = () => {
        if (transactions.length === 0) return alert("No data to export.");

        const exportData = transactions.map(tx => ({
            'Date': new Date(tx.date).toLocaleDateString(),
            'Reference No.': tx.referenceNo,
            'Patient / Entity': tx.payeeName,
            'Description': tx.description,
            'Total Amount (PHP)': tx.totalAmount,
            'Status': tx.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales History");
        XLSX.writeFile(workbook, `My_Sales_History_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const renderStatusBadge = (status: string) => {
        if (status === 'ACTIVE') return <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Active</span>;
        if (status === 'PENDING_VOID') return <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Pending Void</span>;
        if (status === 'VOIDED') return <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-500 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm line-through">Voided</span>;
        return null;
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">My Sales History</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Review your recent invoices and receipts, or request a void for mistakes.</p>
                </div>
                
                {/* 🔥 EXPORT BUTTON ADDED HERE */}
                <button onClick={handleExportExcel} className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2 cursor-pointer">
                    <span>📊</span> <span>Export to Excel</span>
                </button>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

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
                                    <th className="p-4 border-r border-gray-100">Date</th>
                                    <th className="p-4 border-r border-gray-100">Reference No.</th>
                                    <th className="p-4 border-r border-gray-100">Patient / Entity</th>
                                    <th className="p-4 border-r border-gray-100 w-1/3">Description</th>
                                    <th className="p-4 text-right border-r border-gray-100">Total Amount</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-gray-500 italic font-medium">No recent transactions found.</td></tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <React.Fragment key={tx.id}>
                                            <tr className={`hover:bg-gray-50 transition-colors ${tx.status === 'VOIDED' ? 'bg-gray-100 opacity-60' : 'even:bg-gray-50/50 odd:bg-white'}`}>
                                                <td className="p-4 text-gray-600 font-medium border-r border-gray-100">{new Date(tx.date).toLocaleDateString()}</td>
                                                <td className="p-4 border-r border-gray-100">
                                                    <span className="font-mono font-extrabold text-[#1B9387]">{tx.referenceNo}</span>
                                                </td>
                                                <td className="p-4 font-bold text-gray-800 border-r border-gray-100">{tx.payeeName}</td>
                                                <td className="p-4 text-sm text-gray-600 font-medium border-r border-gray-100 truncate max-w-sm" title={tx.description}>{tx.description}</td>
                                                <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100">{formatCurrency(tx.totalAmount)}</td>
                                                <td className="p-4 text-center space-x-2">
                                                    {renderStatusBadge(tx.status)}
                                                    {tx.status === 'ACTIVE' && (
                                                        <button 
                                                            onClick={() => setShowVoidId(showVoidId === tx.id ? null : tx.id)} 
                                                            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded bg-white border border-gray-300 text-red-500 hover:bg-red-50 hover:border-red-200 transition shadow-sm cursor-pointer ml-2"
                                                        >
                                                            Void
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {showVoidId === tx.id && (
                                                <tr className="bg-[#FBF8F8] border-b border-[#B0DCDA] shadow-inner">
                                                    <td colSpan={6} className="p-5 border-l-4 border-l-red-400">
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
        </div>
    );
}