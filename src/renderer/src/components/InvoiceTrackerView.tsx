// src/renderer/src/components/InvoiceTrackerView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Printer, RefreshCw, Search, Eye, CreditCard, Clock, FileText, X } from 'lucide-react';

interface InvoiceTrackerProps {
    onNavigate?: (viewName: string, data?: any) => void;
}

export function InvoiceTrackerView({ onNavigate }: InvoiceTrackerProps) {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const fallbackData = [
                { referenceNo: 'INV-001', payeeName: 'Maxicare Healthcare', date: '2026-08-13', status: 'Partially Paid', total: 5600, paid: 4100, balance: 1500 },
                { referenceNo: 'INV-002', payeeName: 'John Doe', date: '2026-08-20', status: 'Unpaid', total: 2500, paid: 0, balance: 2500 },
                { referenceNo: 'INV-003', payeeName: 'Intellicare', date: '2026-08-15', status: 'Fully Paid', total: 10000, paid: 10000, balance: 0 },
                { referenceNo: 'INV-004', payeeName: 'Asian Hospital', date: '2026-08-18', status: 'Fully Paid', total: 4500, paid: 4500, balance: 0 },
            ];
            const data = api ? await api.getInvoiceTracker() : fallbackData;
            setInvoices(data || []);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch invoice tracker:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, []);

    const formatCurrency = (amount: number, showSymbol = false) => {
        if (!amount || amount === 0) return '-';
        const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return showSymbol ? `₱ ${formatted}` : formatted;
    };

    const getInitials = (name: string) => {
        if (!name) return '';
        const words = name.trim().split(/\s+/);
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    };

    // Filter Logic
    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.payeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' ? true :
            statusFilter === 'Outstanding' ? (inv.status === 'Unpaid' || inv.status === 'Partially Paid') :
                inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // KPI Math (Calculated from ALL invoices, not just filtered ones, so cards remain stable)
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paid || 0), 0);
    const totalBalance = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const percentCollected = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    const renderStatusBadge = (status: string) => {
        if (status === 'Fully Paid') return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow-sm">Paid</span>;
        if (status === 'Partially Paid') return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow-sm">Partial</span>;
        return <span className="bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow-sm">Unpaid</span>;
    };

    // Filter Chips Component
    const filterOptions = ['All', 'Unpaid', 'Partially Paid', 'Fully Paid'];

    return (
        // 🔥 FIX: Standard block centering with padding guarantees it sits perfectly in the middle
        <div className="w-full min-h-full p-6 md:p-8">
            <div className="max-w-7xl mx-auto flex flex-col font-sans text-gray-800 animate-in fade-in duration-300 space-y-6">

                {/* HEADER */}
                <div className="flex justify-between items-end pb-4 border-b border-[#B0DCDA] print:hidden">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Invoice Tracker</h2>
                        <div className="flex items-center space-x-3 mt-1">
                            <p className="text-sm text-gray-500 font-medium">Live status of all patient and HMO invoices.</p>
                            {lastUpdated && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-xs font-bold text-[#1B9387] flex items-center gap-1">
                                        <Clock size={12} /> Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={fetchInvoices} className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-md transition flex items-center justify-center shadow-sm" title="Refresh">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => window.print()} className="px-4 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-extrabold rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2">
                            <Printer size={16} /> <span>Print List</span>
                        </button>
                    </div>
                </div>

                {/* CLICKABLE KPI SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                    <div
                        onClick={() => setStatusFilter('All')}
                        className={`bg-white p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'All' ? 'border-[#1B9387] ring-1 ring-[#1B9387]/20' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Total Billed</span>
                            <FileText size={16} className="text-gray-400" />
                        </div>
                        <span className="text-2xl font-black text-gray-800 tabular-nums">{formatCurrency(totalBilled, true)}</span>
                    </div>

                    <div
                        onClick={() => setStatusFilter('Fully Paid')}
                        className={`bg-white p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'Fully Paid' ? 'border-teal-500 ring-1 ring-teal-500/20' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Total Collected</span>
                            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{percentCollected}% Collected</span>
                        </div>
                        <span className="text-2xl font-black text-teal-600 tabular-nums">{formatCurrency(totalCollected, true)}</span>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="bg-teal-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${percentCollected}%` }}></div>
                        </div>
                    </div>

                    <div
                        onClick={() => setStatusFilter('Outstanding')}
                        className={`bg-white p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'Outstanding' ? 'border-red-400 ring-1 ring-red-400/20' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Total Outstanding</span>
                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{100 - percentCollected}% Pending</span>
                        </div>
                        <span className="text-2xl font-black text-red-500 tabular-nums">{formatCurrency(totalBalance, true)}</span>
                    </div>
                </div>

                {/* SEARCH & QUICK-FILTER CHIPS */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm print:hidden gap-4">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search patient, HMO, or invoice..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1B9387] focus:border-transparent bg-gray-50"
                        />
                    </div>

                    <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        {filterOptions.map(option => (
                            <button
                                key={option}
                                onClick={() => setStatusFilter(option)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${statusFilter === option
                                    ? 'bg-[#1B9387] text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {option}
                            </button>
                        ))}
                        <div className="pl-4 ml-2 border-l border-gray-200 text-xs font-bold text-gray-400 whitespace-nowrap">
                            {filteredInvoices.length} RESULT{filteredInvoices.length !== 1 ? 'S' : ''}
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="bg-white border border-[#B0DCDA] rounded-xl flex flex-col shadow-sm overflow-hidden max-h-[60vh]">
                    <div className="overflow-auto relative flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white/95 backdrop-blur sticky top-0 z-20 shadow-sm border-b border-[#B0DCDA]">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100">Customer / Patient</th>
                                    <th className="p-4 border-r border-gray-100">Invoice Ref #</th>
                                    <th className="p-4 border-r border-gray-100 text-center">Date</th>
                                    <th className="p-4 border-r border-gray-100 text-center">Status</th>
                                    <th className="p-4 border-r border-gray-100 text-right">Total Amount</th>
                                    <th className="p-4 border-r border-gray-100 text-right text-teal-600">Paid</th>
                                    <th className="p-4 text-right text-red-500 border-r border-gray-100">Balance</th>
                                    <th className="p-4 text-center text-gray-400 print:hidden">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    // SKELETON LOADING
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse bg-white">
                                            <td className="p-4 border-r border-gray-100 flex items-center space-x-3">
                                                <div className="h-7 w-7 rounded-full bg-gray-200"></div>
                                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                                            </td>
                                            <td className="p-4 border-r border-gray-100"><div className="h-4 bg-gray-100 rounded w-16"></div></td>
                                            <td className="p-4 border-r border-gray-100 flex justify-center"><div className="h-4 bg-gray-100 rounded w-20"></div></td>
                                            <td className="p-4 border-r border-gray-100"><div className="h-6 bg-gray-100 rounded-md w-16 mx-auto"></div></td>
                                            <td className="p-4 border-r border-gray-100"><div className="h-4 bg-gray-100 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4 border-r border-gray-100"><div className="h-4 bg-gray-100 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4 border-r border-gray-100"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4"><div className="h-6 bg-gray-100 rounded-md w-16 mx-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-16 text-center bg-gray-50">
                                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 mb-3 text-gray-400">
                                                <Search size={20} />
                                            </div>
                                            <p className="text-gray-500 font-bold text-sm">No invoices found</p>
                                            <p className="text-gray-400 text-xs mt-1">Try adjusting your search or filters.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInvoices.map((inv: any, i: number) => (
                                        // ZEBRA STRIPING & HOVER
                                        <tr key={i} className="hover:bg-[#E9FAFA]/60 transition-colors even:bg-gray-50 odd:bg-white group">
                                            <td className="p-4 font-bold text-gray-800 flex items-center space-x-3 border-r border-gray-100">
                                                <div className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm shrink-0">
                                                    {getInitials(inv.payeeName)}
                                                </div>
                                                <span className="truncate">{inv.payeeName}</span>
                                            </td>
                                            <td className="p-4 font-mono text-gray-600 border-r border-gray-100 text-xs">{inv.referenceNo}</td>
                                            <td className="p-4 text-gray-500 border-r border-gray-100 text-center text-xs font-medium">
                                                {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="p-4 text-center border-r border-gray-100">{renderStatusBadge(inv.status)}</td>

                                            {/* TABULAR NUMBERS FOR PERFECT ALIGNMENT */}
                                            <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100 tabular-nums">{formatCurrency(inv.total)}</td>
                                            <td className="p-4 text-right font-mono font-bold text-teal-600 border-r border-gray-100 tabular-nums">{formatCurrency(inv.paid)}</td>
                                            <td className={`p-4 text-right font-mono font-black border-r border-gray-100 tabular-nums ${inv.balance > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                {formatCurrency(inv.balance)}
                                            </td>

                                            {/* MULTIPLE EXPLICIT ACTIONS */}
                                            {/* 🔥 HIGH-CONTRAST ALWAYS-VISIBLE ACTION BUTTONS */}
                                            <td className="p-3 text-center print:hidden">
                                                <div className="flex items-center justify-center space-x-2">

                                                    {/* VIEW BUTTON - Clean, solid secondary style */}
                                                    <button
                                                        onClick={() => setSelectedInvoice(inv)}
                                                        className="px-2.5 py-1.5 text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                                                        title="View Details"
                                                    >
                                                        <Eye size={13} className="text-gray-500" />
                                                        <span>View</span>
                                                    </button>

                                                    {/* PAY BUTTON - Solid primary clinic-teal button */}
                                                    {inv.balance > 0 && (
                                                        <button
                                                            onClick={() => onNavigate && onNavigate('collections', {
                                                                prefillEntity: inv.payeeName,
                                                                prefillAmount: inv.balance,
                                                                referenceNo: inv.referenceNo
                                                            })}
                                                            className="px-3 py-1.5 text-[11px] font-bold text-white bg-[#1B9387] hover:bg-[#147067] rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                                                            title="Record Payment"
                                                        >
                                                            <CreditCard size={13} />
                                                            <span>Pay</span>
                                                        </button>
                                                    )}

                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>

                            {/* GRAND TOTALS */}
                            {!loading && filteredInvoices.length > 0 && (
                                <tfoot className="sticky bottom-0 z-20 bg-gray-100 shadow-[0_-1px_2px_rgba(0,0,0,0.05)] border-t-2 border-[#B0DCDA]">
                                    <tr>
                                        <td colSpan={4} className="p-4 font-extrabold text-gray-600 text-right border-r border-gray-200 uppercase tracking-wider text-xs">Filtered Totals</td>
                                        <td className="p-4 text-right font-mono font-black text-gray-800 border-r border-gray-200 tabular-nums">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0), true)}</td>
                                        <td className="p-4 text-right font-mono font-black text-teal-600 border-r border-gray-200 tabular-nums">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.paid || 0), 0), true)}</td>
                                        <td className="p-4 text-right font-mono font-black text-red-500 border-r border-gray-200 tabular-nums">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0), true)}</td>
                                        <td className="print:hidden"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>

            {/* INVOICE DETAILS MODAL */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setSelectedInvoice(null)}></div>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">

                        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
                            <div>
                                <h3 className="text-xl font-extrabold text-gray-800 tracking-wide">{selectedInvoice.referenceNo}</h3>
                                <p className="text-xs font-bold text-gray-500 uppercase mt-1 tracking-wider">{selectedInvoice.payeeName}</p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Issue Date</span>
                                    <span className="font-medium text-gray-800 text-sm">
                                        {new Date(selectedInvoice.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Current Status</span>
                                    {renderStatusBadge(selectedInvoice.status)}
                                </div>
                            </div>

                            <div className="bg-[#FBF8F8] border border-gray-200 rounded-lg p-5">
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200 border-dashed">
                                    <span className="text-sm font-bold text-gray-500">Total Billed</span>
                                    <span className="font-mono font-bold text-gray-800">{formatCurrency(selectedInvoice.total, true)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200 border-dashed">
                                    <span className="text-sm font-bold text-gray-500">Amount Paid</span>
                                    <span className="font-mono font-bold text-teal-600">{formatCurrency(selectedInvoice.paid, true)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-gray-800 uppercase tracking-wider text-sm">Remaining Balance</span>
                                    <span className={`text-2xl font-black ${selectedInvoice.balance > 0 ? 'text-red-500' : 'text-teal-600'}`}>
                                        {formatCurrency(selectedInvoice.balance, true)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
                            <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition">
                                Close
                            </button>
                            {selectedInvoice.balance > 0 && (
                                <button
                                    className="px-5 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-extrabold rounded-md tracking-wider uppercase transition shadow-sm flex items-center gap-2"
                                    onClick={() => {
                                        if (onNavigate) onNavigate('collections', { prefillEntity: selectedInvoice.payeeName, prefillAmount: selectedInvoice.balance, referenceNo: selectedInvoice.referenceNo });
                                        setSelectedInvoice(null);
                                    }}
                                >
                                    <CreditCard size={14} /> Record Payment
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}