// src/renderer/src/components/ContactDirectoryView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal';

export function ContactDirectoryView() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal & UI States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
    
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
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-200 relative">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">Contacts & Entities</h2>
                    <p className="text-sm text-gray-400 mt-1">Manage Patients, Doctors, HMOs, and view outstanding balances.</p>
                </div>
            </div>

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#29292e] bg-[#1a1a1e] flex space-x-4 items-center">
                    <input 
                        type="text" 
                        placeholder="🔍 Search by name or TIN..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-96 bg-[#121214] border border-[#29292e] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white transition-colors" 
                    />
                    <div className="flex-1"></div>
                    <button onClick={() => setIsModalOpen(true)} className="bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-white px-5 py-2 rounded-md text-sm font-bold shadow transition-colors flex items-center space-x-2 cursor-pointer">
                        <span>+ New Contact</span>
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[#4f46e5] animate-pulse font-bold">Loading Directory...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#121214] sticky top-0 z-10 border-b border-[#29292e] shadow-sm">
                                <tr className="text-[#8d8d99] uppercase tracking-wider text-[10px]">
                                    {/* Removed Checkbox Column Header */}
                                    <th className="p-4 font-bold">Contact Name</th>
                                    <th className="p-4 font-bold">Type</th>
                                    <th className="p-4 font-bold">Phone / Email</th>
                                    <th className="p-4 font-bold text-right text-orange-400">You Owe (₱)</th>
                                    <th className="p-4 font-bold text-right text-emerald-400">They Owe (₱)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50">
                                {filteredContacts.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500 italic">No contacts found.</td></tr>
                                ) : (
                                    filteredContacts.map(c => (
                                        <React.Fragment key={c.id}>
                                            {/* MAIN CLICKABLE ROW */}
                                            <tr 
                                                onClick={() => setExpandedContactId(expandedContactId === c.id ? null : c.id)}
                                                className={`cursor-pointer transition-colors group ${expandedContactId === c.id ? 'bg-[#2a2a2f]' : 'hover:bg-[#2a2a2f]'}`}
                                            >
                                                <td className="p-4 flex items-center space-x-4">
                                                    <div className="h-8 w-8 rounded-full bg-[#4f46e5]/20 text-[#4f46e5] flex items-center justify-center font-bold text-xs border border-[#4f46e5]/50 shrink-0">
                                                        {getInitials(c.name)}
                                                    </div>
                                                    <span className="font-bold text-white text-base">{c.name}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getTypeStyle(c.type)}`}>
                                                        {c.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs text-gray-400">
                                                    {c.email ? c.email : c.phone ? c.phone : '-'}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-orange-400">
                                                    {formatCurrency(c.youOwe)}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-emerald-400">
                                                    {formatCurrency(c.theyOwe)}
                                                </td>
                                            </tr>

                                            {/* EXPANDED DETAILS ROW */}
                                            {expandedContactId === c.id && (
                                                <tr className="bg-[#1a1a1e] border-b border-[#29292e]">
                                                    <td colSpan={5} className="p-6 border-l-4 border-l-[#4f46e5]">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <div>
                                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Contact Information</p>
                                                                <div className="space-y-1.5">
                                                                    <p className="text-sm text-gray-300"><span className="text-gray-500 mr-2 inline-block w-12">Email:</span> {c.email || <span className="italic text-gray-600">Not provided</span>}</p>
                                                                    <p className="text-sm text-gray-300"><span className="text-gray-500 mr-2 inline-block w-12">Phone:</span> {c.phone || <span className="italic text-gray-600">Not provided</span>}</p>
                                                                    <p className="text-sm text-gray-300"><span className="text-gray-500 mr-2 inline-block w-12">TIN:</span> <span className="font-mono">{c.tin || <span className="italic text-gray-600 font-sans">Not provided</span>}</span></p>
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#202024] p-4 rounded-lg border border-[#29292e]">
                                                                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-1">Accounts Payable (Clinic Owes)</p>
                                                                <p className="text-2xl font-mono font-bold text-orange-400 mt-2">
                                                                    ₱ {c.youOwe ? c.youOwe.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-[#202024] p-4 rounded-lg border border-[#29292e]">
                                                                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Accounts Receivable (They Owe)</p>
                                                                <p className="text-2xl font-mono font-bold text-emerald-400 mt-2">
                                                                    ₱ {c.theyOwe ? c.theyOwe.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                                                                </p>
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

            <NewContactModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSaveSuccess={() => fetchContacts()} 
                defaultType="PATIENT"
            />
        </div>
    );
}