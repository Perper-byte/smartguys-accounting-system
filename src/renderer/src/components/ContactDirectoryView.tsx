import * as React from 'react';
import { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal';

export function ContactDirectoryView() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<any | null>(null);
    
    const fetchContacts = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getContactsWithBalances();
            setContacts(data || []);
        } catch (error) {
            console.error("Failed to fetch contacts", error);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchContacts(); }, []);

    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.tin && c.tin.includes(searchQuery))
    );

    const getTypeStyle = (type: string) => {
        switch(type) {
            case 'SUPPLIER': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'PATIENT': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
            case 'DOCTOR': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
            case 'HMO': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            case 'CORPORATE': return 'text-teal-400 bg-teal-500/10 border-teal-500/30';
            default: return 'text-gray-400 border-gray-500/30';
        }
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const formatCurrency = (amount: number) => {
        if (!amount || amount === 0) return '-';
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-800 relative">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-wide">Contacts & Entities</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage patients, doctors, HMOs, and outstanding balances.</p>
                </div>
            </div>

            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#B0DCDA] bg-[#E9FAFA]/70 flex space-x-4 items-center">
                    <input 
                        type="text" 
                        placeholder="🔍 Search by name or TIN..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-96 bg-white border border-[#B0DCDA] rounded-lg px-4 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] transition-colors" 
                    />
                    <div className="flex-1"></div>
                    <button onClick={() => setIsModalOpen(true)} className="bg-[#1B9387] hover:bg-[#167c73] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center space-x-2 cursor-pointer">
                        <span>+ New Contact</span>
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[#1B9387] animate-pulse font-bold">Loading Directory...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] sticky top-0 z-10 border-b border-[#B0DCDA]">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px]">
                                    <th className="p-4 font-bold">Contact Name</th>
                                    <th className="p-4 font-bold">Type</th>
                                    <th className="p-4 font-bold">Phone / Email</th>
                                    <th className="p-4 font-bold text-right text-orange-400">You Owe (₱)</th>
                                    <th className="p-4 font-bold text-right text-emerald-400">They Owe (₱)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E9FAFA]">
                                {filteredContacts.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">No contacts found.</td></tr>
                                ) : (
                                    filteredContacts.map(c => (
                                        <tr key={c.id} className="hover:bg-[#E9FAFA]/70 transition-colors group">
                                            <td className="p-4 flex items-center space-x-4">
                                                <div className="h-8 w-8 rounded-full bg-[#E9FAFA] text-[#1B9387] flex items-center justify-center font-bold text-xs border border-[#B0DCDA] shrink-0">
                                                    {getInitials(c.name)}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedContact(c)}
                                                    className="font-bold text-gray-900 text-base hover:text-[#1B9387] hover:underline underline-offset-4 transition-colors cursor-pointer text-left"
                                                    title={`View ${c.name}'s details`}
                                                >
                                                    {c.name}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getTypeStyle(c.type)}`}>
                                                    {c.type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-gray-500">
                                                {c.email ? c.email : c.phone ? c.phone : '-'}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-orange-600">
                                                {formatCurrency(c.youOwe)}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-[#1B9387]">
                                                {formatCurrency(c.theyOwe)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Reusing the exact same NewContactModal from the POS! */}
            <NewContactModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSaveSuccess={() => fetchContacts()} 
                defaultType="PATIENT"
            />

            {selectedContact && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden">
                    <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#B0DCDA] bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-[#B0DCDA] bg-[#FBF8F8] px-7 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#B0DCDA] bg-[#E9FAFA] text-sm font-bold text-[#1B9387]">
                                    {getInitials(selectedContact.name)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{selectedContact.name}</h3>
                                    <span className={`mt-1 inline-block rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getTypeStyle(selectedContact.type)}`}>
                                        {selectedContact.type}
                                    </span>
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelectedContact(null)} className="text-2xl font-bold leading-none text-gray-400 transition hover:text-gray-700" aria-label="Close contact details">×</button>
                        </div>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-7 py-6 text-sm">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Email</p>
                                <p className="mt-1 break-words font-medium text-gray-800">{selectedContact.email || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Phone</p>
                                <p className="mt-1 font-medium text-gray-800">{selectedContact.phone || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">TIN</p>
                                <p className="mt-1 font-mono font-medium text-gray-800">{selectedContact.tin || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Address</p>
                                <p className="mt-1 break-words font-medium text-gray-800">{selectedContact.address || 'Not provided'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-[#B0DCDA] bg-[#E9FAFA]/50 px-7 py-5">
                            <div className="rounded-lg border border-orange-200 bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-orange-600">You Owe</p>
                                <p className="mt-1 font-mono text-lg font-bold text-orange-700">{selectedContact.youOwe ? `₱ ${formatCurrency(selectedContact.youOwe)}` : '—'}</p>
                            </div>
                            <div className="rounded-lg border border-[#B0DCDA] bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#1B9387]">They Owe</p>
                                <p className="mt-1 font-mono text-lg font-bold text-[#1B9387]">{selectedContact.theyOwe ? `₱ ${formatCurrency(selectedContact.theyOwe)}` : '—'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
