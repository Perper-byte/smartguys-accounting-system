// src/renderer/src/components/AgedReceivablesView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // 🔥 EXCEL EXPORT LIBRARY

export function AgedReceivablesView() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.getAgedReceivables();
            setData(result || []);
        } catch (error) {
            console.error("Failed to fetch aged receivables", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (val: number) => {
        if (!val || val === 0) return '-';
        return `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    };

    const handlePrint = () => {
        window.print();
    };

    // 🔥 HANDLE EXCEL EXPORT
    const handleExportExcel = () => {
        if (data.length === 0) return alert("No data to export.");

        const exportData = data.map(row => ({
            'Patient / HMO / Entity': row.payeeName,
            'Current (0-30 Days)': row.current || 0,
            '31-60 Days': row.days30 || 0,
            '61-90 Days': row.days60 || 0,
            '90+ Days': row.days90 || 0,
            'Total Outstanding (PHP)': row.total || 0
        }));

        // Add Grand Totals to the bottom of the Excel sheet
        exportData.push({
            'Patient / HMO / Entity': 'GRAND TOTALS',
            'Current (0-30 Days)': totalCurrent,
            '31-60 Days': total30,
            '61-90 Days': total60,
            '90+ Days': total90,
            'Total Outstanding (PHP)': grandTotal
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Aged Receivables");
        XLSX.writeFile(workbook, `Aged_Receivables_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const totalCurrent = data.reduce((sum, row) => sum + row.current, 0);
    const total30 = data.reduce((sum, row) => sum + row.days30, 0);
    const total60 = data.reduce((sum, row) => sum + row.days60, 0);
    const total90 = data.reduce((sum, row) => sum + row.days90, 0);
    const grandTotal = data.reduce((sum, row) => sum + row.total, 0);

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-800 font-sans animate-in fade-in duration-300">
            
            {/* HEADER */}
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Aged Receivables (HMO Tracker)</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Track outstanding balances owed by HMOs, Corporations, and Patients.</p>
                </div>
                
                <div className="flex space-x-3">
                    <button onClick={handleExportExcel} disabled={loading || data.length === 0} className="px-5 py-2.5 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-extrabold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50">
                        <span>📊</span> <span>Export Excel</span>
                    </button>
                    <button onClick={handlePrint} disabled={loading || data.length === 0} className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-extrabold rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50">
                        <span>🖨️</span> <span>Print Report</span>
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border border-[#B0DCDA] rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                    <h3 className="text-sm font-extrabold text-gray-600 uppercase tracking-wider">Outstanding Balances Summary</h3>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                         <div className="flex justify-center items-center h-full text-[#1B9387]">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                         </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-[#B0DCDA]">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100">Patient / HMO / Entity</th>
                                    <th className="p-4 text-right border-r border-gray-100 text-[#1B9387]">Current (0-30 Days)</th>
                                    <th className="p-4 text-right border-r border-gray-100 text-amber-500">31-60 Days</th>
                                    <th className="p-4 text-right border-r border-gray-100 text-orange-500">61-90 Days</th>
                                    <th className="p-4 text-right border-r border-[#B0DCDA] text-red-500">90+ Days</th>
                                    <th className="p-4 text-right text-gray-600">Total Outstanding</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-gray-500 italic font-medium">No outstanding receivables found.</td></tr>
                                ) : (
                                    data.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-[#E9FAFA]/50 transition-colors even:bg-gray-50 odd:bg-white">
                                            <td className="p-4 font-extrabold text-gray-800 border-r border-gray-100">{row.payeeName}</td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100">{formatCurrency(row.current)}</td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100">{formatCurrency(row.days30)}</td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100">{formatCurrency(row.days60)}</td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-[#B0DCDA]">{formatCurrency(row.days90)}</td>
                                            <td className="p-4 text-right font-mono font-black text-gray-800 bg-[#FBF8F8]/50">{formatCurrency(row.total)}</td>
                                        </tr>
                                    ))
                                )}
                                
                                {/* GRAND TOTALS ROW */}
                                {data.length > 0 && (
                                    <tr className="bg-white border-t-2 border-[#B0DCDA]">
                                        <td className="p-4 font-extrabold text-gray-800 text-center border-r border-gray-100 uppercase tracking-wider">Grand Totals</td>
                                        <td className="p-4 text-right font-mono font-black text-[#1B9387] border-r border-gray-100">{formatCurrency(totalCurrent)}</td>
                                        <td className="p-4 text-right font-mono font-black text-amber-500 border-r border-gray-100">{formatCurrency(total30)}</td>
                                        <td className="p-4 text-right font-mono font-black text-orange-500 border-r border-gray-100">{formatCurrency(total60)}</td>
                                        <td className="p-4 text-right font-mono font-black text-red-500 border-r border-[#B0DCDA]">{formatCurrency(total90)}</td>
                                        <td className="p-4 text-right font-mono font-black text-gray-800 text-lg">{formatCurrency(grandTotal)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}