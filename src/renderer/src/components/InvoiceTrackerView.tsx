// src/renderer/src/components/InvoiceTrackerView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export function InvoiceTrackerView() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getInvoiceTracker();
            setInvoices(data || []);
        } catch (error) {
            console.error("Failed to fetch invoice tracker:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, []);

    const formatCurrency = (amount: number) => `₱ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const filteredInvoices = invoices.filter(inv => 
        inv.payeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        inv.referenceNo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderStatusBadge = (status: string) => {
        if (status === 'Fully Paid') return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Fully Paid</span>;
        if (status === 'Partially Paid') return <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Partially Paid</span>;
        return <span className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Unpaid</span>;
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-200">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">Invoice Tracker</h2>
                    <p className="text-sm text-gray-400 mt-1">Live status of all patient and HMO invoices.</p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={fetchInvoices} className="flex items-center space-x-2 px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-xs font-bold text-white rounded-md tracking-wider uppercase transition cursor-pointer">
                        <span>🔄</span> <span>Refresh</span>
                    </button>
                    <button onClick={() => window.print()} className="flex items-center space-x-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#5b54f6] text-xs font-bold text-white rounded-md tracking-wider uppercase transition cursor-pointer shadow-lg">
                        <span>🖨️</span> <span>Print List</span>
                    </button>
                </div>
            </div>

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden">
                <div className="bg-[#1a1a1e] p-4 border-b border-[#29292e]">
                    <input 
                        type="text" 
                        placeholder="🔍 Search patient, HMO, or invoice number..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full bg-[#121214] border border-[#29292e] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-[#4f46e5] text-white placeholder-gray-600 transition-colors" 
                    />
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                         <div className="flex justify-center items-center h-full text-[#4f46e5] animate-pulse font-bold">Loading Invoices...</div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#121214] sticky top-0 z-10 shadow-sm border-b border-[#29292e]">
                                <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
                                    <th className="p-4 font-bold">Customer / Patient</th>
                                    <th className="p-4 font-bold">Invoice Ref #</th>
                                    <th className="p-4 font-bold">Date</th>
                                    <th className="p-4 font-bold text-center">Status</th>
                                    <th className="p-4 font-bold text-right">Total Amount</th>
                                    <th className="p-4 font-bold text-right">Paid</th>
                                    <th className="p-4 font-bold text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50">
                                {filteredInvoices.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-500 italic">No invoices found.</td></tr>
                                ) : (
                                    filteredInvoices.map((inv: any, i: number) => (
                                        <tr key={i} className="hover:bg-[#2a2a2f] transition-colors">
                                            <td className="p-4 font-bold text-white flex items-center space-x-3">
                                                <div className="h-8 w-8 rounded-full bg-[#4f46e5]/20 text-[#4f46e5] flex items-center justify-center font-bold text-xs border border-[#4f46e5]/50">
                                                    {inv.payeeName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span>{inv.payeeName}</span>
                                            </td>
                                            <td className="p-4 font-mono text-gray-300">{inv.referenceNo}</td>
                                            <td className="p-4 text-gray-400">{new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                            <td className="p-4 text-center">{renderStatusBadge(inv.status)}</td>
                                            <td className="p-4 text-right font-mono text-gray-300">{formatCurrency(inv.total)}</td>
                                            <td className="p-4 text-right font-mono text-gray-300">{formatCurrency(inv.paid)}</td>
                                            <td className={`p-4 text-right font-mono font-bold ${inv.balance > 0 ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                                                {formatCurrency(inv.balance)}
                                            </td>
                                        </tr>
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