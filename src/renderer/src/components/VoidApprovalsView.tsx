// src/renderer/src/components/VoidApprovalsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export function VoidApprovalsView({ userId }: { userId: string }) {
    const [voids, setVoids] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // ---> NEW: React Status Banner and Custom Modal States <---
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: 'APPROVE' | 'REJECT' | null; id: string | null }>({
        isOpen: false,
        action: null,
        id: null
    });

    const fetchVoids = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getPendingVoids();
            setVoids(data || []);
        } catch (error) { 
            console.error(error); 
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchVoids(); 
    }, []);

    // 1. Opens the custom modal instead of window.confirm
    const initiateAction = (id: string, action: 'APPROVE' | 'REJECT') => {
        setConfirmDialog({ isOpen: true, action, id });
        setStatus(null); // Clear previous alerts
    };

    // 2. Executes the action after they click "Yes" inside the custom modal
    const executeAction = async () => {
        if (!confirmDialog.id || !confirmDialog.action) return;

        try {
            const api = (window as any).api || (window as any).electronAPI;
            if (confirmDialog.action === 'APPROVE') {
                await api.approveVoid(confirmDialog.id, userId);
            } else {
                await api.rejectVoid(confirmDialog.id);
            }
            
            fetchVoids(); // Refresh list automatically
            setStatus({ type: 'success', msg: `Void request ${confirmDialog.action.toLowerCase()}d successfully.` });
        } catch (error) { 
            console.error(error);
            setStatus({ type: 'error', msg: "Action failed. See console for details." });
        } finally {
            // Close modal
            setConfirmDialog({ isOpen: false, action: null, id: null });
        }
    };

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200 relative">
            
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">Void / Reversal Approvals</h2>
                    <p className="text-sm text-gray-400 mt-1">Review and approve transaction cancellations requested by staff.</p>
                </div>
                
                <button 
                    onClick={fetchVoids}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-xs font-bold text-white rounded-md tracking-wider uppercase transition cursor-pointer disabled:opacity-50"
                >
                    <span>{loading ? '⏳' : '🔄'}</span> 
                    <span>Refresh List</span>
                </button>
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

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#121214] border-b border-[#29292e] sticky top-0">
                        <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
                            <th className="p-4">Date</th>
                            <th className="p-4">Reference</th>
                            <th className="p-4">Requested By</th>
                            <th className="p-4">Reason for Void</th>
                            <th className="p-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#29292e]/50">
                        {voids.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-emerald-400 italic">No pending void requests.</td></tr>
                        ) : (
                            voids.map(v => (
                                <tr key={v.id} className="hover:bg-[#2a2a2f] transition-colors">
                                    <td className="p-4 text-gray-400">{new Date(v.date).toLocaleDateString()}</td>
                                    <td className="p-4 font-mono text-white font-bold">{v.reference_no}</td>
                                    <td className="p-4 text-gray-300">{v.user?.username || 'Unknown User'}</td>
                                    <td className="p-4 text-red-400 italic">"{v.void_reason}"</td>
                                    <td className="p-4 text-center space-x-2">
                                        <button 
                                            onClick={() => initiateAction(v.id, 'APPROVE')} 
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors shadow"
                                        >
                                            Approve
                                        </button>
                                        <button 
                                            onClick={() => initiateAction(v.id, 'REJECT')} 
                                            className="bg-[#29292e] hover:bg-gray-600 border border-[#3e3e44] text-gray-300 px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ========================================== */}
            {/* ---> CUSTOM CONFIRMATION MODAL <--- */}
            {/* ========================================== */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[400px]">
                        <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">
                            Confirm Action
                        </h3>
                        <p className="text-sm text-gray-300 mb-6">
                            Are you sure you want to <strong className={confirmDialog.action === 'APPROVE' ? 'text-emerald-400' : 'text-red-400'}>{confirmDialog.action}</strong> this void request? 
                            {confirmDialog.action === 'APPROVE' && " This will permanently generate a reversing entry in the ledger."}
                        </p>
                        
                        <div className="flex justify-end space-x-3 pt-4 border-t border-[#29292e]">
                            <button 
                                onClick={() => setConfirmDialog({ isOpen: false, action: null, id: null })} 
                                className="px-4 py-2 bg-[#29292e] hover:bg-gray-600 text-gray-300 rounded text-sm font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeAction} 
                                className={`px-4 py-2 text-white rounded text-sm font-bold shadow-lg transition-colors cursor-pointer ${
                                    confirmDialog.action === 'APPROVE' 
                                    ? 'bg-emerald-600 hover:bg-emerald-500' 
                                    : 'bg-red-600 hover:bg-red-500'
                                }`}
                            >
                                Yes, {confirmDialog.action}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}