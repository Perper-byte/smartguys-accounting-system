// src/renderer/src/components/JournalManagementView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Search, Download, Plus, FileText, X, Paperclip, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { JournalEntryForm } from './JournalEntryForm'; 

export function JournalManagementView({ userId }: { userId: string }) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Top Tabs (All, Manual, System)
    const [activeTab, setActiveTab] = useState<'ALL' | 'MANUAL' | 'SYSTEM'>('ALL');
    
    // 🔥 NEW: Sub-Tabs for Status (Active, Drafts, Voided)
    const [statusTab, setStatusTab] = useState<'ACTIVE' | 'DRAFTS' | 'VOIDED'>('ACTIVE');
    
    const [searchQuery, setSearchQuery] = useState('');
    
    // View States
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getAllJournalEntries();
            setEntries(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch journals:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isCreatingNew) {
            fetchEntries();
        }
    }, [isCreatingNew]);

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Helper to render the correct badge colors based on status
    const renderStatusBadge = (status: string) => {
        if (status === 'ACTIVE') {
            return <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-200">Recorded</span>;
        }
        if (status === 'VOIDED') {
            return <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-red-50 text-red-600 border-red-200">Voided</span>;
        }
        // Covers DRAFT or PENDING_VOID
        return <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">{status.replace('_', ' ')}</span>;
    };

    // Filter Logic
    const filteredEntries = entries.filter(entry => {
        // 1. Search
        const searchStr = searchQuery.toLowerCase();
        const matchesSearch = 
            (entry.reference_no?.toLowerCase().includes(searchStr)) || 
            (entry.payee?.name?.toLowerCase().includes(searchStr)) || 
            (entry.description?.toLowerCase().includes(searchStr));

        if (!matchesSearch) return false;

        // 2. Top Tabs (Manual vs System)
        const isManual = entry.reference_no.startsWith('JV-') || entry.reference_no.startsWith('ADJ-');
        if (activeTab === 'MANUAL' && !isManual) return false;
        if (activeTab === 'SYSTEM' && isManual) return false;

        // 3. 🔥 NEW: Status Sub-Tabs
        if (statusTab === 'ACTIVE' && entry.status !== 'ACTIVE') return false;
        if (statusTab === 'VOIDED' && entry.status !== 'VOIDED') return false;
        if (statusTab === 'DRAFTS' && entry.status !== 'DRAFT' && entry.status !== 'PENDING_VOID') return false;

        return true;
    });

    // ==========================================
    // VIEW 1: CREATION FORM
    // ==========================================
    if (isCreatingNew) {
        return (
            <div className="w-full min-h-[calc(100vh-64px)] p-6 bg-[#f9fafb]">
                <div className="max-w-4xl mx-auto mb-4">
                    <button 
                        onClick={() => setIsCreatingNew(false)}
                        className="text-gray-500 hover:text-[#1B9387] font-bold text-sm transition flex items-center gap-2"
                    >
                        ← Back to All Journals
                    </button>
                </div>
                <JournalEntryForm userId={userId} isAdjusting={false} />
            </div>
        );
    }

    // ==========================================
    // VIEW 2: LIST & MODAL
    // ==========================================
    return (
        <div className="w-full min-h-[calc(100vh-64px)] bg-[#f9fafb] p-6 lg:p-10 font-sans text-gray-800 animate-in fade-in duration-300">
            <div className="max-w-[1600px] mx-auto">
                
                {/* PAGE HEADER */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">All Journals</h1>
                    <div className="flex items-center gap-3">
                        <button className="p-2 border border-gray-200 bg-white rounded-md text-gray-500 hover:bg-gray-50 shadow-sm transition"><Download size={18} /></button>
                        <button 
                            onClick={() => setIsCreatingNew(true)} 
                            className="bg-[#1B9387] hover:bg-[#15796f] text-white px-4 py-2 rounded-md font-bold text-sm shadow-sm transition flex items-center gap-2 uppercase tracking-wider"
                        >
                            <Plus size={16} /> New Journal
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-6 border-b border-gray-200 mb-6">
                    {['ALL', 'MANUAL', 'SYSTEM'].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab as any)}
                            className={`pb-3 text-sm font-bold tracking-wide transition-colors border-b-2 ${activeTab === tab ? 'border-[#1B9387] text-[#1B9387]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab === 'ALL' ? 'All Journals' : tab === 'MANUAL' ? 'Manual Journals' : 'System Journals'}
                        </button>
                    ))}
                </div>

                {/* SEARCH BAR */}
                <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center mb-6">
                    <Search className="text-gray-400 ml-3 mr-2" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search reference, contact, or description..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent p-2 text-sm outline-none font-medium"
                    />
                </div>

                {/* TABLE */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    
                    {/* 🔥 UPDATED: SUB-TABS (ACTIVE, DRAFTS, VOIDED) */}
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500">
                        <div className="flex gap-4 uppercase tracking-wider">
                            <button 
                                onClick={() => setStatusTab('ACTIVE')} 
                                className={`transition pb-1 ${statusTab === 'ACTIVE' ? 'text-gray-800 border-b-2 border-gray-400' : 'hover:text-gray-800'}`}
                            >
                                Active
                            </button>
                            <button 
                                onClick={() => setStatusTab('DRAFTS')} 
                                className={`transition pb-1 ${statusTab === 'DRAFTS' ? 'text-gray-800 border-b-2 border-gray-400' : 'hover:text-gray-800'}`}
                            >
                                Drafts
                            </button>
                            <button 
                                onClick={() => setStatusTab('VOIDED')} 
                                className={`transition pb-1 ${statusTab === 'VOIDED' ? 'text-gray-800 border-b-2 border-gray-400' : 'hover:text-gray-800'}`}
                            >
                                Voided
                            </button>
                        </div>
                        <span className="capitalize">{statusTab.toLowerCase()}: {filteredEntries.length} record(s)</span>
                    </div>

                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-gray-200 bg-white text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Contact</th>
                                <th className="p-4">Reference</th>
                                <th className="p-4">Date</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right">Debit</th>
                                <th className="p-4 text-right pr-6">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-[#1B9387] font-bold animate-pulse">Loading journals...</td></tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center text-gray-400 font-medium">No journals found.</td></tr>
                            ) : (
                                filteredEntries.map((entry) => {
                                    // Calculate Total Debit for display
                                    const totalDebit = entry.lines?.reduce((sum: number, l: any) => sum + Number(l.debit), 0) || 0;
                                    
                                    return (
                                        <tr 
                                            key={entry.id} 
                                            onClick={() => setSelectedEntry(entry)}
                                            className="hover:bg-[#E9FAFA]/50 transition cursor-pointer group"
                                        >
                                            <td className="p-4 pl-6 font-bold text-gray-800">
                                                <div className="flex items-center gap-3">
                                                    {entry.attachments?.length > 0 && <Paperclip size={14} className="text-gray-300 group-hover:text-[#1B9387] shrink-0" />}
                                                    <span className="truncate">{entry.payee?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-[#1B9387] text-xs">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={14} className="text-gray-400" />
                                                    {entry.reference_no}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-500 font-medium text-xs">
                                                {new Date(entry.date).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="p-4 text-center">
                                                {/* 🔥 UPDATED: Uses dynamic badge logic */}
                                                {renderStatusBadge(entry.status)}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-800">{formatCurrency(totalDebit)}</td>
                                            <td className="p-4 text-right pr-6 font-mono font-bold text-gray-800">{formatCurrency(totalDebit)} <span className="text-[9px] text-gray-400 font-sans ml-1">PHP</span></td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================== */}
            {/* JUANTax STYLE MODAL WITH ATTACHMENTS         */}
            {/* ========================================== */}
            {selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#f4f7f6] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh]">
                        
                        {/* MODAL HEADER */}
                        <div className="bg-white p-5 border-b border-gray-200 flex justify-between items-start shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                    Journal: {selectedEntry.reference_no}
                                </h2>
                                <div className="mt-2">
                                    {renderStatusBadge(selectedEntry.status)}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 border border-gray-200 rounded text-gray-500 hover:bg-gray-50 transition"><Download size={16} /></button>
                                <button onClick={() => setSelectedEntry(null)} className="p-2 border border-transparent rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* MODAL BODY (SCROLLABLE) */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* CARD 1: TOP SUMMARY */}
                            <div className="flex gap-6">
                                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-4 gap-4 shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Type</p>
                                        <p className="font-bold text-sm text-gray-800">
                                            {selectedEntry.reference_no.startsWith('JV') ? 'Manual Journal' : 'System Journal'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Contact</p>
                                        <p className="font-bold text-sm text-[#1B9387] underline decoration-[#1B9387]/30 underline-offset-4 cursor-pointer">
                                            {selectedEntry.payee?.name || '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                        <p className="font-bold text-sm text-gray-800">{selectedEntry.status === 'ACTIVE' ? 'Recorded' : selectedEntry.status.replace('_', ' ')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Date</p>
                                        <p className="font-bold text-sm text-gray-800">{new Date(selectedEntry.date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>

                                <div className="w-64 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center items-end shadow-sm border-l-4 border-l-[#1B9387]">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total (PHP)</p>
                                    <p className="text-3xl font-black font-mono text-gray-900">
                                        {formatCurrency(selectedEntry.lines?.reduce((s:number, l:any) => s + Number(l.debit), 0) || 0)}
                                    </p>
                                </div>
                            </div>

                            {/* CARD 2: JOURNAL LINES TABLE */}
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-extrabold text-gray-500 tracking-wider">
                                        <tr>
                                            <th className="p-4">Account</th>
                                            <th className="p-4">Description</th>
                                            <th className="p-4 text-right">Debit (PHP)</th>
                                            <th className="p-4 text-right">Credit (PHP)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedEntry.lines?.map((line: any) => (
                                            <tr key={line.id}>
                                                <td className="p-4 font-bold text-gray-800">
                                                    <span className="font-mono text-[#1B9387] mr-2">{line.account?.code}</span>
                                                    {line.account?.name}
                                                </td>
                                                <td className="p-4 text-gray-500">-</td>
                                                <td className="p-4 text-right font-mono text-gray-800">{formatCurrency(Number(line.debit))}</td>
                                                <td className="p-4 text-right font-mono text-gray-800">{formatCurrency(Number(line.credit))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* CARD 3 & 4: NOTES AND TOTALS */}
                            <div className="flex gap-6 items-start">
                                <div className="flex-1 space-y-6">
                                    
                                    {/* INTERNAL NOTES */}
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Internal Notes</p>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 min-h-[80px] shadow-sm">
                                            {selectedEntry.description || <span className="text-gray-400 italic">No notes provided.</span>}
                                        </div>
                                    </div>

                                    {/* ATTACHMENTS VIEW ZONE */}
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Paperclip size={12} /> Attachments ({selectedEntry.attachments?.length || 0})
                                        </p>
                                        
                                        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 shadow-sm min-h-[100px] flex flex-col gap-3">
                                            {selectedEntry.attachments && selectedEntry.attachments.length > 0 ? (
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {selectedEntry.attachments.map((att: any) => (
                                                        <a 
                                                            key={att.id} 
                                                            href={att.fileData}
                                                            download={att.fileName}
                                                            className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-[#E9FAFA] hover:border-[#1B9387] transition cursor-pointer group text-center"
                                                        >
                                                            {att.fileType.includes('image') ? (
                                                                <ImageIcon size={24} className="text-[#1B9387] mb-2 group-hover:scale-110 transition-transform" />
                                                            ) : (
                                                                <FileIcon size={24} className="text-[#1B9387] mb-2 group-hover:scale-110 transition-transform" />
                                                            )}
                                                            <span className="text-xs font-bold text-gray-700 truncate w-full px-2" title={att.fileName}>{att.fileName}</span>
                                                            <span className="text-[9px] text-gray-400 font-mono mt-1 uppercase tracking-wider">Click to Download</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-gray-400 py-4">
                                                    <span className="text-xs font-medium">No attachments uploaded</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                </div>

                                {/* TOTAL SUMMARY */}
                                <div className="w-80 bg-gray-200 rounded-xl p-5 shrink-0">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        <span></span>
                                        <div className="flex gap-8 text-right">
                                            <span className="w-24">Debit (PHP)</span>
                                            <span className="w-24">Credit (PHP)</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                                        <span className="text-sm font-black text-gray-800">Journal Amount</span>
                                        <div className="flex gap-8 text-right font-mono font-black text-gray-900 text-base">
                                            <span className="w-24">{formatCurrency(selectedEntry.lines?.reduce((s:number, l:any) => s + Number(l.debit), 0) || 0)}</span>
                                            <span className="w-24">{formatCurrency(selectedEntry.lines?.reduce((s:number, l:any) => s + Number(l.credit), 0) || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}