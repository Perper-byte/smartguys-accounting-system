// src/renderer/src/components/BIRReportsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const BIRReportsView: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentQuarter = Math.ceil(currentMonth / 3);

    const [year, setYear] = useState<number>(currentYear);
    const [quarter, setQuarter] = useState<number>(currentQuarter);

    const [taxData, setTaxData] = useState<any>(null);
    const [reliefData, setReliefData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'2550Q' | 'relief'>('2550Q');

    const fetchTaxData = async () => {
        setLoading(true);
        try {
            const api = (window as any).electronAPI;
            const data2550 = await api.generate2550Q(year, quarter);
            const dataRelief = await api.generateRelief(year, quarter);

            setTaxData(data2550.error ? null : data2550);
            setReliefData(dataRelief.error ? null : dataRelief);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTaxData();
    }, [year, quarter]);

    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined || isNaN(val)) return '₱ 0.00';
        return `₱ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleExportPDF = async () => {
        const filename = `BIR_${view}_Y${year}_Q${quarter}.pdf`;
        const result = await (window as any).electronAPI.exportPDF(filename);
        if (result.success) alert(`PDF saved successfully to: ${result.filePath}`);
        else if (result.error) alert(`Export Failed: ${result.error}`);
    };

    return (
        <div className="max-w-5xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg min-h-[500px]">

            {/* HEADER & CONTROLS */}
            <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-6">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">BIR Tax Compliance</h2>
                    <div className="flex space-x-3 mt-3">
                        <button
                            onClick={handleExportPDF}
                            className="px-3 py-1.5 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-[10px] font-bold text-white rounded-md tracking-wider uppercase transition flex items-center space-x-2"
                        >
                            <span>📄</span> <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                <div className="flex space-x-4">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Year</label>
                        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 bg-[#121214] border border-[#29292e] rounded-md p-2 text-sm text-white outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Quarter</label>
                        <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className="w-32 bg-[#121214] border border-[#29292e] rounded-md p-2 text-sm text-white outline-none cursor-pointer">
                            <option value={1}>Q1 (Jan-Mar)</option>
                            <option value={2}>Q2 (Apr-Jun)</option>
                            <option value={3}>Q3 (Jul-Sep)</option>
                            <option value={4}>Q4 (Oct-Dec)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* SUB-TABS */}
            <div className="flex space-x-4 mb-6 border-b border-[#29292e]">
                <button onClick={() => setView('2550Q')} className={`pb-2 px-2 text-sm font-bold uppercase tracking-wider transition ${view === '2550Q' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8d8d99] hover:text-white'}`}>
                    Form 2550Q (VAT)
                </button>
                <button onClick={() => setView('relief')} className={`pb-2 px-2 text-sm font-bold uppercase tracking-wider transition ${view === 'relief' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8d8d99] hover:text-white'}`}>
                    Relief Annexes
                </button>
            </div>

            {loading && <div className="text-center py-10 text-[#4f46e5] animate-pulse">Computing VAT...</div>}

            {/* FORM 2550Q VIEW */}
            {!loading && taxData && view === '2550Q' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-6">

                        <div className="bg-[#121214] border border-[#29292e] rounded-md p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] mb-4">Output VAT (Sales)</h3>
                            <div className="flex justify-between py-2 border-b border-[#29292e]/50"><span className="text-[#c4c4cc]">Gross Sales</span><span className="font-mono text-white">{formatCurrency(taxData.grossSales)}</span></div>
                            <div className="flex justify-between py-2 border-b border-[#29292e]/50"><span className="text-[#c4c4cc]">Net of VAT ( ÷ 1.12 )</span><span className="font-mono text-white">{formatCurrency(taxData.netSales)}</span></div>
                            <div className="flex justify-between py-2 mt-2 font-bold"><span className="text-[#c4c4cc]">Total Output VAT</span><span className="font-mono text-emerald-400">{formatCurrency(taxData.outputVat)}</span></div>
                        </div>

                        <div className="bg-[#121214] border border-[#29292e] rounded-md p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] mb-4">Input VAT (Purchases)</h3>
                            <div className="flex justify-between py-2 border-b border-[#29292e]/50"><span className="text-[#c4c4cc]">Gross Purchases</span><span className="font-mono text-white">{formatCurrency(taxData.grossPurchases)}</span></div>
                            <div className="flex justify-between py-2 border-b border-[#29292e]/50"><span className="text-[#c4c4cc]">Net of VAT ( ÷ 1.12 )</span><span className="font-mono text-white">{formatCurrency(taxData.netPurchases)}</span></div>
                            <div className="flex justify-between py-2 mt-2 font-bold"><span className="text-[#c4c4cc]">Total Input VAT</span><span className="font-mono text-red-400">{formatCurrency(taxData.inputVat)}</span></div>
                        </div>

                    </div>

                    <div className="bg-[#202024] border border-[#4f46e5]/50 rounded-md p-6 flex justify-between items-center shadow-[0_0_15px_rgba(79,70,229,0.1)]">
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Net VAT Payable</h3>
                            <p className="text-xs text-[#8d8d99] mt-1">Output VAT less Input VAT for Q{taxData.quarter} {taxData.year}</p>
                        </div>
                        <span className={`text-2xl font-bold font-mono ${taxData.netVatPayable >= 0 ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                            {formatCurrency(taxData.netVatPayable)}
                        </span>
                    </div>
                </div>
            )}

            {/* RELIEF VIEW */}
            {!loading && reliefData && view === 'relief' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-[#121214] border border-[#29292e] rounded-md overflow-hidden">
                        <div className="bg-[#202024] border-b border-[#29292e] p-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Annex B: Summary List of Purchases</h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="text-[#8d8d99] text-xs uppercase tracking-wider bg-[#121214] border-b border-[#29292e]">
                                <tr>
                                    <th className="p-3 text-left">Date</th>
                                    <th className="p-3 text-left">Payee/Supplier</th>
                                    <th className="p-3 text-left">TIN</th>
                                    <th className="p-3 text-right">Gross</th>
                                    <th className="p-3 text-right">Input Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reliefData.annexB_Purchases.length === 0 ? (
                                    <tr><td colSpan={5} className="p-6 text-center text-[#8d8d99]">No vatable purchases recorded with Payee info.</td></tr>
                                ) : (
                                    reliefData.annexB_Purchases.map((p: any, i: number) => (
                                        <tr key={i} className="border-b border-[#29292e]/50 hover:bg-[#202024]/50">
                                            <td className="p-3 text-[#e1e1e6]">{new Date(p.date).toLocaleDateString()}</td>
                                            <td className="p-3 text-[#e1e1e6] font-medium">{p.supplierName}</td>
                                            <td className="p-3 text-[#8d8d99] font-mono">{p.tin}</td>
                                            <td className="p-3 text-right text-white font-mono">{formatCurrency(p.grossAmount)}</td>
                                            <td className="p-3 text-right text-red-400 font-mono">{formatCurrency(p.tax)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};