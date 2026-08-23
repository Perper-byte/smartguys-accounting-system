// src/renderer/src/components/FinancialStatementsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const FinancialStatementsView: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [statementType, setStatementType] = useState<'trial' | 'income' | 'balance' | 'cash-flow'>('trial');
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setData(null);
            try {
                const api = (window as any).electronAPI || (window as any).api;
                let result;
                if (statementType === 'trial') result = await api.getTrialBalance(selectedYear, selectedMonth);
                else if (statementType === 'income') result = await api.getIncomeStatement(selectedYear, selectedMonth);
                else if (statementType === 'balance') result = await api.getBalanceSheet(selectedYear, selectedMonth);
                else if (statementType === 'cash-flow') result = await api.getCashFlowStatement(selectedYear, selectedMonth);

                setData(result);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [statementType, selectedYear, selectedMonth]);

    const formatCurrency = (val: number | null | undefined, isAbnormal: boolean = false) => {
        if (val === null || val === undefined || isNaN(val) || val === 0) return '—';
        const formattedAmount = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isAbnormal || val < 0 ? `(₱ ${formattedAmount})` : `₱ ${formattedAmount}`;
    };

    const handleExportExcel = async () => {
        const api = (window as any).electronAPI || (window as any).api;
        const result = await api.exportTrialBalanceExcel(selectedYear, selectedMonth);
        if (result.success) alert(`Report exported successfully to:\n${result.filePath}`);
        else if (result.error) alert(`Export Failed: ${result.error}`);
    };

    const handleExportPDF = async () => {
        if (!data) return;

        const sidebar = document.querySelector('aside');
        const topHeader = document.querySelector('header');
        const mainWrapper = document.querySelector('main');
        const appLayouts = document.querySelectorAll('.h-screen, .overflow-hidden, .flex-1');

        const statementCard = document.getElementById('statement-card');
        const controlsDiv = document.getElementById('fs-controls');
        const exportBtn = document.getElementById('export-pdf-btn');
        const excelBtn = document.getElementById('export-excel-btn');
        const tabsDiv = document.getElementById('fs-tabs');

        try {
            if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
            if (topHeader) topHeader.style.setProperty('display', 'none', 'important');
            if (controlsDiv) controlsDiv.style.setProperty('display', 'none', 'important');
            if (tabsDiv) tabsDiv.style.setProperty('display', 'none', 'important');
            if (exportBtn) exportBtn.style.setProperty('display', 'none', 'important');
            if (excelBtn) excelBtn.style.setProperty('display', 'none', 'important');

            if (mainWrapper) {
                mainWrapper.style.setProperty('overflow', 'visible', 'important');
                mainWrapper.style.setProperty('padding', '0', 'important');
                mainWrapper.style.setProperty('background-color', 'white', 'important');
            }
            if (statementCard) {
                statementCard.style.setProperty('border', 'none', 'important');
                statementCard.style.setProperty('box-shadow', 'none', 'important');
                statementCard.style.setProperty('padding', '0', 'important');
            }
            appLayouts.forEach(el => {
                (el as HTMLElement).style.setProperty('height', 'auto', 'important');
                (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
            });

            await new Promise(resolve => setTimeout(resolve, 150));

            const api = (window as any).electronAPI || (window as any).api;
            const filename = `${statementType.toUpperCase()}_Statement_${selectedYear}_${selectedMonth}.pdf`;
            const result = await api.exportPDF(filename);

            if (result && result.success) {
                alert(`Report saved successfully to:\n${result.filePath}`);
            } else if (result && result.error) {
                alert(`Export Failed: ${result.error}`);
            }
        } catch (err: any) {
            alert(`Export Error: ${err.message || "Failed to generate PDF."}`);
        } finally {
            if (sidebar) sidebar.style.display = '';
            if (topHeader) topHeader.style.display = '';
            if (controlsDiv) controlsDiv.style.display = '';
            if (tabsDiv) tabsDiv.style.display = '';
            if (exportBtn) exportBtn.style.display = '';
            if (excelBtn) excelBtn.style.display = '';

            if (mainWrapper) {
                mainWrapper.style.overflow = '';
                mainWrapper.style.padding = '';
                mainWrapper.style.backgroundColor = '';
            }
            if (statementCard) {
                statementCard.style.border = '';
                statementCard.style.boxShadow = '';
                statementCard.style.padding = '';
            }
            appLayouts.forEach(el => {
                (el as HTMLElement).style.height = '';
                (el as HTMLElement).style.overflow = '';
            });
        }
    };

    const getMonthName = (monthNum: number) => {
        return new Date(2000, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' });
    };

    return (
        <div id="statement-card" className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm min-h-[550px]">

            {/* HEADER & CONTROLS */}
            <div id="fs-controls" className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6 border-b border-[#B0DCDA] pb-6">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">Monthly Financial Statements</h2>
                    <div className="flex space-x-3 mt-3">
                        <button id="export-pdf-btn" onClick={handleExportPDF} className="px-4 py-2 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2">
                            <span className="text-base">📄</span> <span>Export PDF</span>
                        </button>
                        {statementType === 'trial' && (
                            <button id="export-excel-btn" onClick={handleExportExcel} className="px-4 py-2 bg-[#E9FAFA] hover:bg-[#B0DCDA]/50 border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2">
                                <span className="text-base">📊</span> <span>Export Excel</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Year</label>
                        <input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-24 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 text-sm text-gray-800 font-bold outline-none focus:border-[#1B9387]" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Month</label>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="w-40 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 text-sm text-gray-800 font-bold outline-none cursor-pointer focus:border-[#1B9387]">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{getMonthName(m)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div id="fs-tabs" className="flex flex-wrap gap-2 mb-6 bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner w-fit">
                {(['trial', 'income', 'balance', 'cash-flow'] as const).map((type) => (
                    <button
                        key={type}
                        onClick={() => setStatementType(type)}
                        className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${
                            statementType === type
                            ? 'bg-[#1B9387] text-white shadow-md'
                            : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
                        }`}
                    >
                        {type === 'trial' ? 'Trial Balance' : type === 'income' ? 'Income Statement' : type === 'balance' ? 'Balance Sheet' : 'Cash Flow'}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex justify-center items-center py-20 text-[#1B9387] print:hidden">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                </div>
            )}

            {!loading && data && (
                <div className="animate-in fade-in duration-300">
                    
                    {/* =========================================
                        A. TRIAL BALANCE
                    ========================================= */}
                    {statementType === 'trial' && (
                        <div className="space-y-6 bg-white max-w-4xl mx-auto">
                            <div className="text-center pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-extrabold text-gray-800">SmartGuys Community Healthcare Inc.</h2>
                                <h3 className="text-lg font-bold text-gray-600 mt-1">Trial Balance</h3>
                                <p className="text-sm text-gray-500 mt-1 italic">As of {getMonthName(selectedMonth)} {selectedYear}</p>
                            </div>

                            <div className="border border-[#B0DCDA] rounded-xl bg-white overflow-hidden shadow-sm">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-[#B0DCDA] text-gray-500 text-xs uppercase tracking-wider sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3.5 pl-5 text-left font-extrabold border-r border-[#B0DCDA]">Account Code</th>
                                            <th className="p-3.5 text-left font-extrabold border-r border-[#B0DCDA]">Account Name</th>
                                            <th className="p-3.5 text-right font-extrabold border-r border-[#B0DCDA]">Debit</th>
                                            <th className="p-3.5 pr-5 text-right font-extrabold">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {data.lines?.length === 0 && (
                                            <tr><td colSpan={4} className="p-6 text-center text-gray-500 italic">No activity recorded prior to this period.</td></tr>
                                        )}
                                        {data.lines?.map((line: any) => (
                                            <tr key={line.accountCode} className="even:bg-[#FBF8F8] odd:bg-white hover:bg-[#E9FAFA]/60 transition">
                                                <td className="p-3.5 pl-5 text-gray-800 font-mono font-bold border-r border-[#B0DCDA]">{line.accountCode}</td>
                                                <td className="p-3.5 text-gray-800 font-medium border-r border-[#B0DCDA]">{line.accountName}</td>
                                                <td className="p-3.5 text-right font-mono font-medium text-gray-800 border-r border-[#B0DCDA]">
                                                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                                </td>
                                                <td className="p-3.5 pr-5 text-right font-mono font-medium text-gray-800">
                                                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-[#E9FAFA] border-t-2 border-[#B0DCDA]">
                                            <td colSpan={2} className="p-4 pl-5 text-left font-extrabold text-gray-800 uppercase tracking-wider border-r border-[#B0DCDA]">Total</td>
                                            <td className="p-4 text-right font-mono font-bold text-[#1B9387] border-r border-[#B0DCDA]">{formatCurrency(data.totalDebits)}</td>
                                            <td className="p-4 pr-5 text-right font-mono font-bold text-[#1B9387]">{formatCurrency(data.totalCredits)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* =========================================
                        B. INCOME STATEMENT
                    ========================================= */}
                    {statementType === 'income' && (
                        <div className="space-y-8 bg-white max-w-3xl mx-auto">
                            <div className="text-center pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-extrabold text-gray-800">SmartGuys Community Healthcare Inc.</h2>
                                <h3 className="text-lg font-bold text-gray-600 mt-1">Income Statement</h3>
                                <p className="text-sm text-gray-500 mt-1 italic">For the month ended {getMonthName(selectedMonth)} {selectedYear}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Revenues</h3>
                                {data.revenue?.length === 0 && <p className="text-sm text-gray-400 px-4 pl-8 italic">No revenue recorded this month.</p>}
                                {data.revenue?.map((rev: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{rev.name}</span>
                                        <span className="font-mono text-gray-800">{formatCurrency(rev.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Revenue</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalRevenue)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Operating Expenses</h3>
                                {data.expenses?.length === 0 && <p className="text-sm text-gray-400 px-4 pl-8 italic">No operating expenses recorded this month.</p>}
                                {data.expenses?.map((exp: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{exp.name}</span>
                                        <span className="font-mono text-gray-800">{formatCurrency(exp.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Operating Expenses</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalExpenses)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-5 bg-[#E9FAFA] border-t-2 border-b-4 border-[#B0DCDA] rounded-md shadow-sm">
                                <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider">Net Income (Loss)</span>
                                <span className={`text-xl font-bold font-mono ${data.netIncome >= 0 ? 'text-[#1B9387]' : 'text-red-600'}`}>
                                    {formatCurrency(data.netIncome, data.netIncome < 0)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* =========================================
                        C. BALANCE SHEET
                    ========================================= */}
                    {statementType === 'balance' && (
                        <div className="space-y-8 bg-white max-w-3xl mx-auto">
                            <div className="text-center pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-extrabold text-gray-800">SmartGuys Community Healthcare Inc.</h2>
                                <h3 className="text-lg font-bold text-gray-600 mt-1">Balance Sheet</h3>
                                <p className="text-sm text-gray-500 mt-1 italic">As of {getMonthName(selectedMonth)} {selectedYear}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Assets</h3>
                                {data.assets?.map((asset: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{asset.name}</span>
                                        <span className={`font-mono ${asset.amount < 0 ? 'text-red-500 font-bold' : 'text-gray-800'}`}>{formatCurrency(asset.amount, asset.amount < 0)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Assets</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalAssets)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Liabilities</h3>
                                {data.liabilities?.length === 0 && <p className="text-sm text-gray-400 px-4 pl-8 italic">No liabilities recorded.</p>}
                                {data.liabilities?.map((lia: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{lia.name}</span>
                                        <span className="font-mono text-gray-800">{formatCurrency(lia.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Liabilities</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalLiabilities)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Equity</h3>
                                {data.equity?.map((eq: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{eq.name}</span>
                                        <span className="font-mono text-gray-800">{formatCurrency(eq.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm py-2 px-4 pl-8 text-gray-500 italic border-t border-gray-100 mt-2 pt-2">
                                    <span>Accumulated Net Income / Loss</span>
                                    <span className="font-mono font-medium">{formatCurrency(data.netIncome, data.netIncome < 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Equity</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalEquity + data.netIncome)}</span>
                                </div>
                            </div>

                            <div className={`flex justify-between items-center p-5 border-t-2 border-b-4 shadow-sm rounded-md ${data.isEquationBalanced ? 'bg-[#E9FAFA] border-[#B0DCDA]' : 'bg-red-50 border-red-200'}`}>
                                <div>
                                    <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider block">Total Liabilities & Equity</span>
                                    {!data.isEquationBalanced && <span className="text-xs text-red-500 font-bold uppercase mt-1 block">⚠️ Equation out of balance</span>}
                                </div>
                                <span className="text-xl font-bold font-mono text-gray-800">
                                    {formatCurrency(data.totalLiabilitiesAndEquity)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* =========================================
                        D. CASH FLOW STATEMENT
                    ========================================= */}
                    {statementType === 'cash-flow' && (
                        <div className="space-y-8 bg-white max-w-3xl mx-auto">
                            <div className="text-center pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-extrabold text-gray-800">SmartGuys Community Healthcare Inc.</h2>
                                <h3 className="text-lg font-bold text-gray-600 mt-1">Statement of Cash Flows</h3>
                                <p className="text-sm text-gray-500 mt-1 italic">For the month ended {getMonthName(selectedMonth)} {selectedYear}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Cash Flows from Operating Activities</h3>
                                {data.operating?.details.length === 0 && <p className="text-sm text-gray-400 px-4 pl-8 italic">No operating activities this month.</p>}
                                {data.operating?.details.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition">
                                        <span className="text-gray-700">{item.description}</span>
                                        <span className={`font-mono ${item.amount < 0 ? 'text-red-500 font-medium' : 'text-gray-800'}`}>{formatCurrency(item.amount, item.amount < 0)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-3 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Net Cash from Operating Activities</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.operating?.net, data.operating?.net < 0)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Cash Flows from Investing Activities</h3>
                                {data.investing?.details.length === 0 && <p className="text-sm text-gray-400 px-4 pl-8 italic">No investing activities this month.</p>}
                                {data.investing?.details.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition">
                                        <span className="text-gray-700">{item.description}</span>
                                        <span className={`font-mono ${item.amount < 0 ? 'text-red-500 font-medium' : 'text-gray-800'}`}>{formatCurrency(item.amount, item.amount < 0)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-3 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Net Cash from Investing Activities</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.investing?.net, data.investing?.net < 0)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Cash Flows from Financing Activities</h3>
                                {data.financing?.details.length === 0 && <p className="text-sm text-gray-400 px-4 pl-8 italic">No financing activities this month.</p>}
                                {data.financing?.details.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition">
                                        <span className="text-gray-700">{item.description}</span>
                                        <span className={`font-mono ${item.amount < 0 ? 'text-red-500 font-medium' : 'text-gray-800'}`}>{formatCurrency(item.amount, item.amount < 0)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-3 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Net Cash from Financing Activities</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.financing?.net, data.financing?.net < 0)}</span>
                                </div>
                            </div>

                            <div className={`flex justify-between items-center p-5 border-t-2 border-b-4 shadow-sm mt-8 rounded-md ${data.netIncreaseInCash < 0 ? 'bg-red-50 border-red-200' : 'bg-[#E9FAFA] border-[#B0DCDA]'}`}>
                                <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider">Net Increase (Decrease) in Cash</span>
                                <span className={`text-xl font-bold font-mono ${data.netIncreaseInCash < 0 ? 'text-red-600' : 'text-[#1B9387]'}`}>
                                    {formatCurrency(data.netIncreaseInCash, data.netIncreaseInCash < 0)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};