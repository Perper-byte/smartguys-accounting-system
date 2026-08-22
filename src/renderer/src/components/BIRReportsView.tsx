// src/renderer/src/components/BIRReportsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const BIRReportsView: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

    const [year, setYear] = useState<number>(currentYear);
    const [quarter, setQuarter] = useState<number>(currentQuarter); // 0 = Annual

    const [taxData, setTaxData] = useState<any>(null);
    const [reliefData, setReliefData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'2550Q' | '1601EQ' | 'relief'>('2550Q');

    const fetchTaxData = async () => {
        setLoading(true);
        try {
            const api = (window as any).electronAPI || (window as any).api;
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

    const handleExportPDF = () => {
        window.print();
    };

    const handleDownloadSLSP = () => {
        if (!reliefData || reliefData.annexB_Purchases.length === 0) return alert("No data available.");
        const lines = reliefData.annexB_Purchases.map((p: any) => {
            const tinClean = p.tin.replace(/-/g, '').padEnd(9, '0').substring(0, 9);
            return `P,${tinClean},0000,"${p.supplierName}","","",${p.grossAmount.toFixed(2)},${p.tax.toFixed(2)},0.00,0.00,0.00`;
        });
        
        // Dynamically name the file depending on Quarter vs Annual
        const fileName = quarter === 0 ? `SLSP_Annual_${year}_Purchases.dat` : `SLSP_Q${quarter}_${year}_Purchases.dat`;
        triggerDownload(lines.join('\n'), fileName);
    };

    const handleDownloadQAP = () => {
        if (!taxData || taxData.qapList.length === 0) return alert("No EWT data available.");
        const lines = taxData.qapList.map((p: any) => {
            const tinClean = p.tin.replace(/-/g, '').padEnd(9, '0').substring(0, 9);
            return `D1,${tinClean},0000,"${p.payeeName}","${p.atc}",${p.grossAmount.toFixed(2)},${p.taxWithheld.toFixed(2)}`;
        });
        
        // Form 1604-E is the Annual equivalent of 1601-EQ!
        const fileName = quarter === 0 ? `QAP_1604E_Annual_${year}.dat` : `QAP_1601EQ_Q${quarter}_${year}.dat`;
        triggerDownload(lines.join('\n'), fileName);
    };

    const triggerDownload = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.setAttribute('download', filename);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className="max-w-5xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg min-h-[600px] flex flex-col font-sans">

            {/* HEADER & CONTROLS */}
            <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-6 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">BIR Tax Compliance</h2>
                    <p className="text-sm text-gray-400 mt-1">EOPT-Ready Tax Summaries and DAT Generators</p>
                </div>

                <div className="flex space-x-4">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Year</label>
                        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 bg-[#121214] border border-[#29292e] rounded-md p-2 text-sm text-white outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Period</label>
                        <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className="w-40 bg-[#121214] border border-[#29292e] rounded-md p-2 text-sm text-white outline-none cursor-pointer">
                            <option value={1}>Q1 (Jan-Mar)</option>
                            <option value={2}>Q2 (Apr-Jun)</option>
                            <option value={3}>Q3 (Jul-Sep)</option>
                            <option value={4}>Q4 (Oct-Dec)</option>
                            {/* ---> NEW ANNUAL OPTION <--- */}
                            <option value={0}>Annual (Full Year)</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button onClick={handleExportPDF} className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-xs font-bold text-white rounded-md tracking-wider uppercase transition flex items-center space-x-2">
                            <span>🖨️</span> <span>Print Form</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* SUB-TABS */}
            <div className="flex space-x-6 mb-6 border-b border-[#29292e] print:hidden">
                <button onClick={() => setView('2550Q')} className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition ${view === '2550Q' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8d8d99] hover:text-white'}`}>
                    Form 2550Qv2024 (VAT)
                </button>
                <button onClick={() => setView('1601EQ')} className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition ${view === '1601EQ' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8d8d99] hover:text-white'}`}>
                    {quarter === 0 ? 'Form 1604-E (Annual EWT)' : 'Form 1601-EQ (EWT)'}
                </button>
                <button onClick={() => setView('relief')} className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition ${view === 'relief' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8d8d99] hover:text-white'}`}>
                    RELIEF / SLSP Generator
                </button>
            </div>

            {loading && <div className="flex-1 flex justify-center items-center text-[#4f46e5] animate-pulse">Computing Tax Data...</div>}

            {/* ============================================================ */}
            {/* 1. FORM 2550Q (VAT) VIEW */}
            {/* ============================================================ */}
            {!loading && taxData && view === '2550Q' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-[#121214] border border-[#29292e] rounded-lg p-6">
                        <h3 className="text-base font-bold text-white mb-4 border-b border-[#29292e] pb-2">Part IV - Details of VAT Computation</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 text-sm">
                                <h4 className="text-xs font-bold uppercase text-[#8d8d99] tracking-wider mb-2">Total Sales & Output Tax</h4>
                                <div className="flex justify-between items-center"><span className="text-gray-400">Item 31A: Vatable Sales</span><span className="font-mono text-white">{formatCurrency(taxData.vatableSales)}</span></div>
                                <div className="flex justify-between items-center bg-[#202024] p-2 rounded border border-[#29292e]"><span className="text-emerald-400 font-bold">Item 31B: Output Tax (12%)</span><span className="font-mono text-emerald-400 font-bold">{formatCurrency(taxData.outputVat)}</span></div>
                                <div className="pt-2 border-t border-[#29292e]"></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400">Item 33: VAT-Exempt Sales <br/><span className="text-[10px] text-gray-500">(Consults, Labs, SC/PWD)</span></span><span className="font-mono text-white">{formatCurrency(taxData.exemptSales)}</span></div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <h4 className="text-xs font-bold uppercase text-[#8d8d99] tracking-wider mb-2">Allowable Input Tax</h4>
                                <div className="flex justify-between items-center"><span className="text-gray-400">Item 44A: Domestic Purchases</span><span className="font-mono text-white">{formatCurrency(taxData.vatablePurchases)}</span></div>
                                <div className="flex justify-between items-center bg-[#202024] p-2 rounded border border-[#29292e]"><span className="text-yellow-400 font-bold">Item 44B: Input Tax (12%)</span><span className="font-mono text-yellow-400 font-bold">{formatCurrency(taxData.inputVat)}</span></div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-[#29292e]">
                            <h4 className="text-xs font-bold uppercase text-[#8d8d99] tracking-wider mb-3">Tax Credits & Payments</h4>
                            <div className="flex justify-between items-center bg-[#202024] p-2 rounded border border-[#29292e] w-1/2">
                                <span className="text-yellow-400 font-bold">Item 16: Creditable VAT Withheld <br/><span className="text-[10px] font-normal text-gray-400">(From HMOs - Form 2307)</span></span>
                                <span className="font-mono text-yellow-400 font-bold">{formatCurrency(taxData.creditableVatWithheld)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#202024] border border-[#f75a68]/50 rounded-lg p-6 flex justify-between items-center shadow-[0_0_15px_rgba(247,90,104,0.1)]">
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Item 15: Net VAT Payable</h3>
                            <p className="text-xs text-[#8d8d99] mt-1">Output VAT less (Input VAT + CWT Credits) for {quarter === 0 ? `the Year ${year}` : `Q${quarter} ${year}`}</p>
                        </div>
                        <span className={`text-3xl font-bold font-mono ${taxData.netVatPayable <= 0 ? 'text-emerald-400' : 'text-[#f75a68]'}`}>
                            {formatCurrency(taxData.netVatPayable)}
                        </span>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* 2. FORM 1601-EQ / 1604-E VIEW + ALPHALIST (QAP) */}
            {/* ============================================================ */}
            {!loading && taxData && view === '1601EQ' && (
                <div className="space-y-6 animate-in fade-in duration-300 flex flex-col h-full">
                     <div className="bg-[#121214] border border-[#29292e] rounded-lg p-6">
                        <h3 className="text-base font-bold text-white mb-2 border-b border-[#29292e] pb-2">
                            {quarter === 0 ? 'Form 1604-E Summary (Annual)' : 'Form 1601-EQ Summary (Quarterly)'}
                        </h3>
                        <p className="text-sm text-gray-400 mb-6">Taxes withheld from Doctor Professional Fees and Rent (ATC WI010 / WI100).</p>

                        <div className="bg-[#202024] border border-emerald-500/50 rounded-lg p-6 flex justify-between items-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Total Taxes Withheld</h3>
                                <p className="text-xs text-[#8d8d99] mt-1">Total Account 2050 (EWT Payable) for the {quarter === 0 ? 'Year' : 'Quarter'}</p>
                            </div>
                            <span className="text-3xl font-bold font-mono text-emerald-400">
                                {formatCurrency(taxData.ewtWithheld)}
                            </span>
                        </div>
                     </div>

                     <div className="bg-[#121214] border border-[#29292e] rounded-md overflow-hidden flex-1 flex flex-col">
                        <div className="bg-[#202024] border-b border-[#29292e] p-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">QAP: Alphalist of Payees</h3>
                                <p className="text-xs text-gray-400 mt-1">Required electronic attachment for {quarter === 0 ? '1604-E' : '1601-EQ'}.</p>
                            </div>
                            <button onClick={handleDownloadQAP} disabled={taxData.qapList.length === 0} className="bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded transition flex items-center space-x-2">
                                <span>📥</span> <span>Download .DAT</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[300px]">
                            <table className="w-full text-sm">
                                <thead className="text-[#8d8d99] text-xs uppercase tracking-wider bg-[#121214] border-b border-[#29292e] sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left">Date</th>
                                        <th className="p-3 text-left">Payee (Doctor/Landlord)</th>
                                        <th className="p-3 text-left">TIN</th>
                                        <th className="p-3 text-center">ATC</th>
                                        <th className="p-3 text-right">Gross Payout</th>
                                        <th className="p-3 text-right text-emerald-400">Tax Withheld</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {taxData.qapList.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-[#8d8d99] italic">No withholding taxes recorded this period.</td></tr>
                                    ) : (
                                        taxData.qapList.map((p: any, i: number) => (
                                            <tr key={i} className="border-b border-[#29292e]/50 hover:bg-[#202024]/50">
                                                <td className="p-3 text-[#e1e1e6]">{new Date(p.date).toLocaleDateString()}</td>
                                                <td className="p-3 text-[#e1e1e6] font-bold">{p.payeeName}</td>
                                                <td className="p-3 text-[#8d8d99] font-mono">{p.tin}</td>
                                                <td className="p-3 text-center text-blue-400 font-mono font-bold">{p.atc}</td>
                                                <td className="p-3 text-right text-white font-mono">{formatCurrency(p.grossAmount)}</td>
                                                <td className="p-3 text-right text-emerald-400 font-bold font-mono">{formatCurrency(p.taxWithheld)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* 3. RELIEF / SLSP DAT FILE GENERATOR */}
            {/* ============================================================ */}
            {!loading && reliefData && view === 'relief' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center bg-[#202024] border border-[#29292e] p-4 rounded-lg">
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Annex B: Summary List of Purchases</h3>
                            <p className="text-xs text-gray-400 mt-1">Required electronic attachment for Form 2550Q.</p>
                        </div>
                        <button onClick={handleDownloadSLSP} disabled={reliefData.annexB_Purchases.length === 0} className="bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest px-4 py-3 rounded transition flex items-center space-x-2">
                            <span>📥</span> <span>Download .DAT</span>
                        </button>
                    </div>

                    <div className="bg-[#121214] border border-[#29292e] rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="text-[#8d8d99] text-xs uppercase tracking-wider bg-[#202024] border-b border-[#29292e] sticky top-0">
                                <tr>
                                    <th className="p-4 text-left">Date</th>
                                    <th className="p-4 text-left">Payee/Supplier</th>
                                    <th className="p-4 text-left">TIN</th>
                                    <th className="p-4 text-right">Gross</th>
                                    <th className="p-4 text-right text-yellow-400">Input Tax (12%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reliefData.annexB_Purchases.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-[#8d8d99] italic">No vatable purchases recorded with Payee TINs this period.</td></tr>
                                ) : (
                                    reliefData.annexB_Purchases.map((p: any, i: number) => (
                                        <tr key={i} className="border-b border-[#29292e]/50 hover:bg-[#202024]/50">
                                            <td className="p-4 text-[#e1e1e6]">{new Date(p.date).toLocaleDateString()}</td>
                                            <td className="p-4 text-[#e1e1e6] font-medium">{p.supplierName}</td>
                                            <td className="p-4 text-[#8d8d99] font-mono">{p.tin}</td>
                                            <td className="p-4 text-right text-white font-mono">{formatCurrency(p.grossAmount)}</td>
                                            <td className="p-4 text-right text-yellow-400 font-bold font-mono">{formatCurrency(p.tax)}</td>
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