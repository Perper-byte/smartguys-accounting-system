// src/renderer/src/components/VoidApprovalsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
    RefreshCw,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    XCircle,
    Search,
    Clock3
} from 'lucide-react';

type ViewMode = 'PENDING' | 'HISTORY';

export function VoidApprovalsView({ userId }: { userId: string }) {
    const [viewMode, setViewMode] = useState<ViewMode>('PENDING');
    const [voids, setVoids] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Copy-to-clipboard state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Status Banner and Custom Modal States
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

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            // Expects an IPC handler returning voids with status APPROVED/REJECTED,
            // including `status`, `approver` (or `approved_by`), and `decided_at`.
            const data = api.getVoidHistory ? await api.getVoidHistory() : [];
            setHistory(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const refresh = () => (viewMode === 'PENDING' ? fetchVoids() : fetchHistory());

    // Initial Fetch + refetch on tab switch
    useEffect(() => {
        refresh();
    }, [viewMode]);

    // Auto-dismiss success banner after 4 seconds
    useEffect(() => {
        if (status?.type === 'success') {
            const timer = setTimeout(() => setStatus(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    // Opens the custom modal
    const initiateAction = (id: string, action: 'APPROVE' | 'REJECT') => {
        setConfirmDialog({ isOpen: true, action, id });
        setStatus(null); // Clear previous alerts
    };

    // Executes the action
    const executeAction = async () => {
        if (!confirmDialog.id || !confirmDialog.action) return;

        try {
            const api = (window as any).api || (window as any).electronAPI;
            if (confirmDialog.action === 'APPROVE') {
                await api.approveVoid(confirmDialog.id, userId);
            } else {
                await api.rejectVoid(confirmDialog.id);
            }

            fetchVoids(); // Refresh pending list automatically
            setStatus({ type: 'success', msg: `Void request ${confirmDialog.action.toLowerCase()}d successfully.` });
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', msg: "Action failed. See console for details." });
        } finally {
            setConfirmDialog({ isOpen: false, action: null, id: null });
        }
    };

    // Helper to copy reference numbers
    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000); // Reset icon after 2s
    };

    const activeRows = viewMode === 'PENDING' ? voids : history;

    const filteredRows = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return activeRows;
        return activeRows.filter((v) => {
            const requester = v.user?.username || '';
            const decider = v.approver?.username || v.approved_by || '';
            return (
                (v.reference_no || '').toLowerCase().includes(q) ||
                requester.toLowerCase().includes(q) ||
                decider.toLowerCase().includes(q) ||
                (v.void_reason || '').toLowerCase().includes(q)
            );
        });
    }, [activeRows, searchQuery]);

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans relative">

            {/* Header Section */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-wide">Void / Reversal Approvals</h2>
                    <p className="text-sm text-gray-500 mt-1">Review and approve transaction cancellations requested by staff.</p>
                </div>

                <button
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-300 text-xs font-bold text-gray-700 hover:text-teal-700 rounded-md tracking-wider uppercase transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> : <RefreshCw className="w-4 h-4 text-teal-600" />}
                    <span>Refresh List</span>
                </button>
            </div>

            {/* Pending / History Toggle + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => { setViewMode('PENDING'); setSearchQuery(''); }}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${viewMode === 'PENDING' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Pending ({voids.length})
                    </button>
                    <button
                        onClick={() => { setViewMode('HISTORY'); setSearchQuery(''); }}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${viewMode === 'HISTORY' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        History ({history.length})
                    </button>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search reference, staff, or reason..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-colors"
                    />
                </div>
            </div>

            {/* Status Banner */}
            {status && (
                <div className={`mb-6 p-4 rounded-md flex items-center gap-3 text-sm font-medium border ${status.type === 'success'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {status.msg}
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr className="text-gray-500 uppercase tracking-wider text-xs">
                            <th className="p-4 font-semibold">Date & Time</th>
                            <th className="p-4 font-semibold">Reference</th>
                            <th className="p-4 font-semibold">Requested By</th>
                            <th className="p-4 font-semibold">Reason for Void</th>
                            {viewMode === 'PENDING' ? (
                                <>
                                    <th className="p-4 font-semibold text-center">Status</th>
                                    <th className="p-4 font-semibold text-center">Action</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-4 font-semibold">Decided By</th>
                                    <th className="p-4 font-semibold text-center">Status</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                                        <span>Loading void requests...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-teal-600">
                                        <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                                        <span className="font-medium text-lg">
                                            {searchQuery
                                                ? 'No matches found'
                                                : viewMode === 'PENDING' ? 'All caught up!' : 'No history yet'}
                                        </span>
                                        <span className="text-sm text-gray-500 mt-1 max-w-sm">
                                            {searchQuery
                                                ? `Nothing matches "${searchQuery}". Try a different reference, staff name, or reason.`
                                                : viewMode === 'PENDING'
                                                    ? 'No pending void requests at the moment. Staff can request voids from any transaction screen.'
                                                    : 'Approved and rejected void requests will appear here once a decision is made.'}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ) : viewMode === 'PENDING' ? (
                            filteredRows.map(v => (
                                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 text-gray-600">{new Date(v.date).toLocaleString()}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => handleCopy(v.reference_no, v.id)}
                                            className="flex items-center space-x-2 font-mono text-gray-800 font-bold hover:text-teal-600 transition-colors group"
                                            title="Click to copy"
                                        >
                                            <span>{v.reference_no}</span>
                                            {copiedId === v.id ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="p-4 text-gray-600 font-medium">{v.user?.username || 'Unknown User'}</td>
                                    <td className="p-4 text-red-600 italic">"{v.void_reason}"</td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase bg-amber-50 text-amber-700 border-amber-200">
                                            <Clock3 className="w-3 h-3" /> Awaiting Approval
                                        </span>
                                    </td>
                                    <td className="p-4 text-center space-x-2">
                                        <button
                                            onClick={() => initiateAction(v.id, 'APPROVE')}
                                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors shadow-sm"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => initiateAction(v.id, 'REJECT')}
                                            className="bg-white hover:bg-red-50 border border-gray-300 hover:border-red-200 text-gray-700 hover:text-red-600 px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            filteredRows.map(v => (
                                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 text-gray-600">{new Date(v.date).toLocaleString()}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => handleCopy(v.reference_no, v.id)}
                                            className="flex items-center space-x-2 font-mono text-gray-800 font-bold hover:text-teal-600 transition-colors group"
                                            title="Click to copy"
                                        >
                                            <span>{v.reference_no}</span>
                                            {copiedId === v.id ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="p-4 text-gray-600 font-medium">{v.user?.username || 'Unknown User'}</td>
                                    <td className="p-4 text-red-600 italic">"{v.void_reason}"</td>
                                    <td className="p-4 text-gray-600 font-medium">
                                        {v.approver?.username || v.approved_by || '—'}
                                        {v.decided_at && (
                                            <span className="block text-xs text-gray-400 font-normal">
                                                {new Date(v.decided_at).toLocaleString()}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {v.status === 'APPROVED' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase bg-teal-50 text-teal-700 border-teal-200">
                                                <CheckCircle2 className="w-3 h-3" /> Approved
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase bg-rose-50 text-rose-700 border-rose-200">
                                                <XCircle className="w-3 h-3" /> Rejected
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Custom Confirmation Modal */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-6 w-[420px]">

                        <div className="flex items-center space-x-3 mb-4">
                            <div className={`p-2 rounded-full ${confirmDialog.action === 'APPROVE' ? 'bg-teal-100' : 'bg-red-100'}`}>
                                <AlertCircle className={`w-6 h-6 ${confirmDialog.action === 'APPROVE' ? 'text-teal-600' : 'text-red-600'}`} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                                Confirm Action
                            </h3>
                        </div>

                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            Are you sure you want to <strong className={confirmDialog.action === 'APPROVE' ? 'text-teal-600' : 'text-red-600'}>{confirmDialog.action?.toLowerCase()}</strong> this void request?
                            {confirmDialog.action === 'APPROVE' && " This will permanently generate a reversing entry in the ledger."}
                        </p>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
                                className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeAction}
                                className={`px-4 py-2 text-white rounded-md text-sm font-bold shadow-sm transition-colors cursor-pointer ${confirmDialog.action === 'APPROVE'
                                    ? 'bg-teal-600 hover:bg-teal-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                Yes, {confirmDialog.action === 'APPROVE' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}