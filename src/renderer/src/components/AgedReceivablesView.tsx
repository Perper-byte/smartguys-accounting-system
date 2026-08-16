// src/renderer/src/components/AgedReceivablesView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const AgedReceivablesView: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const result = await api.getAgedReceivables();
                setData(result || []);
            } catch (err) {
                console.error("Failed to fetch aging report", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, []);

    const formatCurrency = (val: number) => {
        if (!val || val === 0) return '-';
        return `₱ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handlePrint = () => window.print();

    const totalCurrent = data.reduce((sum, row) => sum + row.current, 0);
    const total30 = data.reduce((sum, row) => sum + row.days30, 0);
    const total60 = data.reduce((sum, row) => sum + row.days60, 0);
    const total90 = data.reduce((sum, row) => sum + row.days90, 0);
    const grandTotal = data.reduce((sum, row) => sum + row.total, 0);

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200">
            
            <div className="flex justify-between items-end mb-6 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">Aged Receivables (HMO Tracker)</h2>
                    <p className="text-sm text-gray-400 mt-1">Track outstanding balances owed by HMOs, Corporations, and Patients.</p>
                </div>
                <button onClick={handlePrint} disabled={loading || data.length === 0} className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-xs font-bold text-white rounded-md tracking-wider uppercase transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer">
                    <span>🖨️</span> <span>Print Report</span>
                </button>
            </div>

            <div className="hidden print:block text-center mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">SmartGuys Clinic Inc.</h1>
                <h2 className="text-lg font-bold uppercase mt-1 text-black">Aged Accounts Receivable Report</h2>
                <p className="text-sm italic text-gray-600">As of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden print:border-none print:shadow-none print:bg-white">
                <div className="p-4 border-b border-[#29292e] bg-[#1a1a1e] print:hidden">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#8d8d99]">Outstanding Balances Summary</h3>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[#4f46e5] animate-pulse">Computing Aging Data...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#121214] print:bg-transparent sticky top-0 z-10">
                                <tr className="text-[#8d8d99] print:text-black uppercase tracking-wider text-xs border-b border-[#29292e] print:border-black">
                                    <th className="p-4 font-bold">Patient / HMO / Entity</th>
                                    <th className="p-4 font-bold text-right text-emerald-400">Current (0-30 Days)</th>
                                    <th className="p-4 font-bold text-right text-yellow-500">31-60 Days</th>
                                    <th className="p-4 font-bold text-right text-orange-400">61-90 Days</th>
                                    <th className="p-4 font-bold text-right text-[#f75a68]">90+ Days</th>
                                    <th className="p-4 font-bold text-right">Total Outstanding</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50 print:divide-gray-300">
                                {data.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic print:text-black">No outstanding receivables found. Everyone is paid up!</td></tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-[#2a2a2f] print:hover:bg-transparent transition-colors">
                                            <td className="p-4 font-bold text-white print:text-black">{row.payeeName}</td>
                                            <td className="p-4 text-right font-mono text-gray-300 print:text-black">{formatCurrency(row.current)}</td>
                                            <td className="p-4 text-right font-mono text-gray-300 print:text-black">{formatCurrency(row.days30)}</td>
                                            <td className="p-4 text-right font-mono text-gray-300 print:text-black">{formatCurrency(row.days60)}</td>
                                            <td className="p-4 text-right font-mono text-[#f75a68] print:text-red-600 font-bold">{formatCurrency(row.days90)}</td>
                                            <td className="p-4 text-right font-mono text-white print:text-black font-bold">{formatCurrency(row.total)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {data.length > 0 && (
                                <tfoot className="bg-[#121214] print:bg-transparent border-t-2 border-[#29292e] print:border-black sticky bottom-0">
                                    <tr className="font-bold">
                                        <td className="p-4 text-right text-white print:text-black uppercase tracking-wider text-xs">Grand Totals</td>
                                        <td className="p-4 text-right font-mono text-emerald-400 print:text-black">{formatCurrency(totalCurrent)}</td>
                                        <td className="p-4 text-right font-mono text-yellow-500 print:text-black">{formatCurrency(total30)}</td>
                                        <td className="p-4 text-right font-mono text-orange-400 print:text-black">{formatCurrency(total60)}</td>
                                        <td className="p-4 text-right font-mono text-[#f75a68] print:text-black">{formatCurrency(total90)}</td>
                                        <td className="p-4 text-right font-mono text-white print:text-black text-lg border-l border-[#29292e]">{formatCurrency(grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};