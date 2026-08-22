import * as React from 'react';
import { useState, useEffect } from 'react';

export function CashierHistoryView({ userId }: { userId: string }) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    const [showVoidInput, setShowVoidInput] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    
    // ---> NEW: React Status Banner State <---
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getUserSalesHistory(userId);
            setHistory(data || []);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [userId]);

    const formatCurrency = (amount: number) => {
        return `₱ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    };

    // ---> UPDATED: No more alert() boxes! <---
    const submitVoidRequest = async () => {
        setStatus(null); // Clear old status

        if (!voidReason || !voidReason.trim()) {
            setStatus({ type: 'error', msg: "Please enter a reason for voiding this transaction." });
            return;
        }

        try {
            const api = (window as any).api || (window as any).electronAPI;
            const response = await api.requestVoid(selectedTx.id, voidReason);
            
            if (response.success || !response.error) {
                setStatus({ type: 'success', msg: `Void requested for ${selectedTx.referenceNo}! The manager must approve it to reverse the balances.` });
                closeModal();
                fetchHistory(); // Refresh to show the yellow pending badge
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
        if (status === 'PENDING_VOID') return <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Pending Void</span>;
        if (status === 'VOIDED') return <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Voided</span>;
        return <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>;
    };

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200 relative">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">My Sales History</h2>
                    <p className="text-sm text-gray-400 mt-1">Review your recent invoices and receipts, or request a void for mistakes.</p>
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

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[#4f46e5] animate-pulse">Loading history...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#121214] sticky top-0 z-10 shadow-md">
                                <tr className="text-[#8d8d99] uppercase tracking-wider text-xs border-b border-[#29292e]">
                                    <th className="p-4 font-bold">Date</th>
                                    <th className="p-4 font-bold">Reference No.</th>
                                    <th className="p-4 font-bold">Patient / Entity</th>
                                    <th className="p-4 font-bold">Description</th>
                                    <th className="p-4 font-bold text-right">Total Amount</th>
                                    <th className="p-4 font-bold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50">
                                {history.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">No recent transactions found.</td></tr>
                                ) : (
                                    history.map((tx) => (
                                        <tr key={tx.id} className={`hover:bg-[#2a2a2f] transition-colors ${tx.status === 'VOIDED' ? 'opacity-50 line-through' : ''}`}>
                                            <td className="p-4 text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono">
                                                <button onClick={() => setSelectedTx(tx)} className="text-[#4f46e5] hover:text-[#5b54f6] hover:underline font-bold transition cursor-pointer">
                                                    {tx.referenceNo}
                                                </button>
                                            </td>
                                            <td className="p-4 font-bold text-white">{tx.payeeName}</td>
                                            <td className="p-4 text-gray-400 truncate max-w-xs">{tx.description}</td>
                                            <td className="p-4 text-right font-mono font-bold text-white">{formatCurrency(tx.totalAmount)}</td>
                                            <td className="p-4 text-center">{renderStatusBadge(tx.status)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

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
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Reference No.</p>
                                    <p className="text-sm text-[#4f46e5] font-bold font-mono">{selectedTx.referenceNo}</p>
                                </div>
                                <div className="bg-[#121214] p-3 rounded border border-[#29292e]">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Amount</p>
                                    <p className="text-sm text-white font-bold font-mono">{formatCurrency(selectedTx.totalAmount)}</p>
                                </div>
                            </div>

                            <div className="bg-[#121214] p-3 rounded border border-[#29292e]">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Description</p>
                                <p className="text-sm text-gray-300">{selectedTx.description}</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#29292e] flex justify-between items-center min-h-[40px]">
                            
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
}