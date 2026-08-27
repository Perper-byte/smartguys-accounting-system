import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { NewContactModal } from './NewContactModal';
import * as XLSX from 'xlsx';

export function ContactDirectoryView() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'PATIENT' | 'DOCTOR' | 'HMO' | 'SUPPLIER'>('ALL');
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    // New Contact Flow
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNewContactMenuOpen, setIsNewContactMenuOpen] = useState(false);
    const [newContactType, setNewContactType] = useState('PATIENT');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getContactsWithBalances();

            // Mocking a 'status' field for the UI if it doesn't exist in your DB yet
            const enrichedData = (data || []).map((c: any) => ({
                ...c,
                status: c.status || 'ACTIVE'
            }));

            setContacts(enrichedData);
        } catch (error) {
            console.error("Failed to fetch contacts", error);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchContacts(); }, []);

    // Reset pagination when searching or filtering
    useEffect(() => { setCurrentPage(1); }, [searchQuery, filterType]);

    // Summary Card Calculations
    const counts = useMemo(() => ({
        ALL: contacts.length,
        PATIENT: contacts.filter(c => c.type === 'PATIENT').length,
        DOCTOR: contacts.filter(c => c.type === 'DOCTOR').length,
        HMO: contacts.filter(c => c.type === 'HMO').length,
        SUPPLIER: contacts.filter(c => c.type === 'SUPPLIER').length,
    }), [contacts]);

    // Apply Filters & Search
    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.tin && c.tin.includes(searchQuery));
            const matchesType = filterType === 'ALL' || c.type === filterType;
            return matchesSearch && matchesType;
        });
    }, [contacts, searchQuery, filterType]);

    const paginatedContacts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredContacts.slice(start, start + itemsPerPage);
    }, [filteredContacts, currentPage]);

    // 🔥 Systematized Colors: Warm (Money Out) vs Cool (Money In)
    const getTypeStyle = (type: string) => {
        switch (type) {
            // Money-Out (Payables -> Warm Colors)
            case 'SUPPLIER': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'DOCTOR': return 'text-rose-600 bg-rose-50 border-rose-200';
            // Money-In (Receivables -> Cool Colors)
            case 'PATIENT': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'HMO':
            case 'CORPORATE': return 'text-[#1B9387] bg-[#E9FAFA] border-[#B0DCDA]';
            default: return 'text-gray-500 bg-gray-50 border-gray-200';
        }
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const formatCurrency = (amount: number) => {
        if (!amount || amount === 0) return '—';
        return `₱ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const openNewContactModal = (type: string) => {
        setNewContactType(type);
        setIsNewContactMenuOpen(false);
        setIsModalOpen(true);
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 relative animate-in fade-in duration-300">

            {/* Global Overlay to close dropdowns */}
            {(actionMenuId || isNewContactMenuOpen) && (
                <div className="fixed inset-0 z-20" onClick={() => { setActionMenuId(null); setIsNewContactMenuOpen(false); }}></div>
            )}

            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Contacts & Entities</h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">Manage patients, doctors, HMOs, and outstanding balances.</p>
            </div>

            {/* Summary / Filter Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {[
                    { label: 'All Contacts', type: 'ALL', count: counts.ALL },
                    { label: 'Patients', type: 'PATIENT', count: counts.PATIENT },
                    { label: 'Doctors', type: 'DOCTOR', count: counts.DOCTOR },
                    { label: 'HMOs', type: 'HMO', count: counts.HMO },
                    { label: 'Suppliers', type: 'SUPPLIER', count: counts.SUPPLIER },
                ].map(card => (
                    <div
                        key={card.type}
                        onClick={() => setFilterType(card.type as any)}
                        className={`p-4 rounded-xl border cursor-pointer transition shadow-sm text-center ${filterType === card.type
                                ? 'bg-[#1B9387] border-[#1B9387] text-white'
                                : 'bg-white border-[#B0DCDA] hover:bg-[#E9FAFA] text-gray-600'
                            }`}
                    >
                        <p className={`text-[10px] font-extrabold uppercase tracking-wider mb-1 ${filterType === card.type ? 'text-[#E9FAFA]' : 'text-gray-500'}`}>
                            {card.label}
                        </p>
                        <p className="text-2xl font-black">{card.count}</p>
                    </div>
                ))}
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-4">
                <div className="relative w-full lg:w-96">
                    <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="Search name, TIN, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-[#B0DCDA] rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] text-gray-800 shadow-sm"
                    />
                </div>

                <div className="flex items-center space-x-3 w-full lg:w-auto">
                    <button className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-4 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2">
                        <span>📥</span> <span>Import</span>
                    </button>
                    <button className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-4 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2">
                        <span>📤</span> <span>Export</span>
                    </button>

                    {/* Improved New Contact Flow */}
                    <div className="relative z-30">
                        <button
                            onClick={() => setIsNewContactMenuOpen(!isNewContactMenuOpen)}
                            className="bg-[#1B9387] hover:bg-[#28958B] border border-transparent text-white px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2"
                        >
                            <span>+ New Contact ▾</span>
                        </button>
                        {isNewContactMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#B0DCDA] rounded-lg shadow-xl overflow-hidden py-1">
                                <div className="px-3 py-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">What Type?</div>
                                <button onClick={() => openNewContactModal('PATIENT')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition">👤 Patient</button>
                                <button onClick={() => openNewContactModal('DOCTOR')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition">🩺 Doctor</button>
                                <button onClick={() => openNewContactModal('HMO')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition">🏥 HMO</button>
                                <button onClick={() => openNewContactModal('SUPPLIER')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition">📦 Supplier</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden mb-4">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA]">
                        <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                            <th className="p-4">Contact</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Phone / Email</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-right text-orange-500" title="Amount the clinic owes them">Payable</th>
                            <th className="p-4 text-right text-[#1B9387]" title="Amount they owe the clinic">Receivable</th>
                            <th className="p-4 w-12 text-center">⋮</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={7} className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B9387] mx-auto"></div></td></tr>
                        ) : paginatedContacts.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-gray-500 italic font-medium">No contacts match your filters.</td></tr>
                        ) : (
                            paginatedContacts.map(c => (
                                <React.Fragment key={c.id}>
                                    {/* Clickable Rows */}
                                    <tr
                                        onClick={() => setExpandedContactId(expandedContactId === c.id ? null : c.id)}
                                        className={`cursor-pointer transition-colors group ${expandedContactId === c.id ? 'bg-[#E9FAFA]' : 'hover:bg-gray-50 even:bg-gray-50/50 odd:bg-white'}`}
                                    >
                                        <td className="p-4 flex items-center space-x-4">
                                            <div className="h-8 w-8 rounded-full bg-white text-[#1B9387] flex items-center justify-center font-extrabold text-xs border border-[#B0DCDA] shadow-sm shrink-0">
                                                {getInitials(c.name)}
                                            </div>
                                            <span className="font-extrabold text-gray-800 text-base group-hover:text-[#1B9387] transition">{c.name}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getTypeStyle(c.type)}`}>
                                                {c.type}
                                            </span>
                                        </td>

                                        {/* 🔥 Flagging missing contact info */}
                                        <td className="p-4 text-xs text-gray-500 font-medium">
                                            {c.email ? c.email : c.phone ? c.phone : <span className="italic text-gray-400">Missing info</span>}
                                        </td>

                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </td>

                                        <td className="p-4 text-right font-mono font-bold text-orange-500">{formatCurrency(c.youOwe)}</td>
                                        <td className="p-4 text-right font-mono font-bold text-[#1B9387]">{formatCurrency(c.theyOwe)}</td>

                                        {/* Actions (⋮) Menu */}
                                        <td className="p-4 text-center relative z-30">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === c.id ? null : c.id); }}
                                                className="text-gray-400 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-200 transition text-lg font-bold"
                                            >
                                                ⋮
                                            </button>

                                            {actionMenuId === c.id && (
                                                <div className="absolute right-8 top-10 w-40 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden py-1 text-left z-40">
                                                    <button onClick={(e) => { e.stopPropagation(); alert('View Contact'); setActionMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]">👁️ View Details</button>
                                                    <button onClick={(e) => { e.stopPropagation(); alert('Edit Contact'); setActionMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]">✏️ Edit</button>
                                                    <button onClick={(e) => { e.stopPropagation(); alert('Transactions'); setActionMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]">🧾 Transactions</button>
                                                    <div className="border-t border-gray-100 my-1"></div>
                                                    {/* Confirmed logic term: Archive */}
                                                    <button onClick={(e) => { e.stopPropagation(); alert('Archive'); setActionMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50">🗑️ Archive</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded Details Row */}
                                    {expandedContactId === c.id && (
                                        <tr className="bg-[#FBF8F8] border-b border-[#B0DCDA] shadow-inner">
                                            <td colSpan={7} className="p-6 border-l-4 border-l-[#1B9387]">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                                                    <div className="md:col-span-2">
                                                        <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Contact Information</p>
                                                        <div className="space-y-1.5 mt-2">
                                                            <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-16 font-bold">Email:</span> {c.email || <span className="italic text-gray-400 font-normal">Missing info</span>}</p>
                                                            <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-16 font-bold">Phone:</span> {c.phone || <span className="italic text-gray-400 font-normal">Missing info</span>}</p>
                                                            <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-16 font-bold">TIN:</span> <span className="font-mono font-bold">{c.tin || <span className="italic text-gray-400 font-sans font-normal">Not provided</span>}</span></p>
                                                            <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-16 font-bold">Address:</span> {c.address || <span className="italic text-gray-400 font-normal">Not provided</span>}</p>
                                                        </div>
                                                    </div>

                                                    {/* Financial Summary inside Expansion */}
                                                    <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm flex flex-col justify-center text-center h-full">
                                                        <p className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider mb-1">Payable (Clinic Owes)</p>
                                                        <p className="text-2xl font-mono font-black text-orange-500 mt-1">{formatCurrency(c.youOwe)}</p>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-lg border border-[#B0DCDA] shadow-sm flex flex-col justify-center text-center h-full">
                                                        <p className="text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider mb-1">Receivable (They Owe)</p>
                                                        <p className="text-2xl font-mono font-black text-[#1B9387] mt-1">{formatCurrency(c.theyOwe)}</p>
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
            </div>

            {/* Pagination Footer */}
            {!loading && filteredContacts.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 pt-2">
                    <div className="mb-4 sm:mb-0">
                        Showing <span className="font-bold text-gray-800">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredContacts.length)}</span> of <span className="font-bold text-gray-800">{filteredContacts.length}</span> contacts
                    </div>
                    <div className="flex space-x-2">
                        {/* 🔥 Visually distinct disabled states for pagination */}
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm
                                       disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed
                                       enabled:bg-[#FBF8F8] enabled:hover:bg-[#E9FAFA] enabled:text-gray-700 enabled:border-[#B0DCDA]"
                        >
                            &larr; Prev
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage * itemsPerPage >= filteredContacts.length}
                            className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm
                                       disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed
                                       enabled:bg-[#FBF8F8] enabled:hover:bg-[#E9FAFA] enabled:text-gray-700 enabled:border-[#B0DCDA]"
                        >
                            Next &rarr;
                        </button>
                    </div>
                </div>
            )}

            <NewContactModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSaveSuccess={() => fetchContacts()}
                defaultType={newContactType}
            />
        </div>
    );
}