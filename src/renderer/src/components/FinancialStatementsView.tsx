// src/renderer/src/components/FinancialStatementsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const FinancialStatementsView: React.FC = () => {
    const [statementType, setStatementType] = useState<'trial' | 'income' | 'balance'>('trial');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setData(null);
            try {
                const api = (window as any).electronAPI;
                let result;
                if (statementType === 'trial') result = await api.getTrialBalance();
                else if (statementType === 'income') result = await api.getIncomeStatement();
                else if (statementType === 'balance') result = await api.getBalanceSheet();

                setData(result);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [statementType]);

    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined || isNaN(val) || val === 0) return '—';
        const formattedAmount = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // If negative, wrap in parentheses. If positive, standard.
        return val < 0 ? `(₱ ${formattedAmount})` : `₱ ${formattedAmount}`;
    };

    const handleExportExcel = async () => {
        const result = await (window as any).electronAPI.exportTrialBalanceExcel();
        if (result.success) {
            alert(`Report exported successfully to:\n${result.filePath}`);
        } else if (result.error) {
            alert(`Export Failed: ${result.error}`);
        }
    };

    // 🔥 THE BULLETPROOF PDF HANDLER (Same as General Ledger)
    const handleExportPDF = async () => {
        try {
            document.body.classList.add('is-printing');
            await new Promise(resolve => setTimeout(resolve, 150));

            const filename = `${statementType === 'trial' ? 'Trial_Balance' : statementType === 'income' ? 'Income_Statement' : 'Balance_Sheet'}_${new Date().toISOString().split('T')[0]}.pdf`;
            const result = await (window as any).electronAPI.exportPDF(filename);

            if (result && result.success) {
                alert(`PDF report saved successfully to:\n${result.filePath}`);
            } else if (result && result.error) {
                alert(`PDF Generation Failed: ${result.error}`);
            }
        } catch (err: any) {
            alert(`Export Error: ${err.message || "Failed to generate PDF."}`);
        } finally {
            document.body.classList.remove('is-printing');
        }
    };

    return (
        <div className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm min-h-[550px] print:border-none print:shadow-none print:p-0 print:m-0">

            {/* HEADER & CONTROLS */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6 border-b border-[#B0DCDA] pb-6">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">Monthly Financial Statements</h2>
                    <div className="no-print flex space-x-3 mt-3">
                        {/* Export PDF Button */}
                        <button
                            onClick={handleExportPDF}
                            className="px-4 py-2 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2"
                        >
                            <span className="text-base">📄</span> <span>Export PDF</span>
                        </button>

                        {/* Export Excel Button (Trial Balance Only) */}
                        {statementType === 'trial' && (
                            <button
                                onClick={handleExportExcel}
                                className="px-4 py-2 bg-[#E9FAFA] hover:bg-[#B0DCDA]/50 border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2"
                            >
                                <span className="text-base">📊</span> <span>Export Excel</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Toggle Switch */}
                <div className="no-print flex bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner">
                    {(['trial', 'income', 'balance'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setStatementType(type)}
                            className={`px-5 py-2 text-xs font-extrabold rounded-md transition uppercase tracking-wider ${statementType === type
                                ? 'bg-[#1B9387] text-white shadow-sm'
                                : 'text-gray-500 hover:text-[#1B9387]'
                                }`}
                        >
                            {type === 'trial' ? 'Trial Balance' : type === 'income' ? 'Income Statement' : 'Balance Sheet'}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-20 text-[#1B9387]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                </div>
            )}

            {!loading && data && (
                <div className="animate-in fade-in duration-300">

                    {/* =========================================
              A. TRIAL BALANCE
          ========================================= */}
                    {statementType === 'trial' && (
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

                                    {/* Totals Row */}
                                    <tr className="bg-[#E9FAFA] border-t border-[#B0DCDA]">
                                        <td colSpan={2} className="p-4 pl-5 text-left font-extrabold text-gray-800 uppercase tracking-wider border-r border-[#B0DCDA]">Total</td>
                                        <td className="p-4 text-right font-mono font-bold text-[#1B9387] border-r border-[#B0DCDA]">{formatCurrency(data.totalDebits)}</td>
                                        <td className="p-4 pr-5 text-right font-mono font-bold text-[#1B9387]">{formatCurrency(data.totalCredits)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* =========================================
              B. INCOME STATEMENT
          ========================================= */}
                    {statementType === 'income' && (
                        <div className="space-y-8 bg-white max-w-3xl mx-auto">
                            {/* Report Header for Print */}
                            <div className="text-center pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-extrabold text-gray-800">SmartGuys Community Healthcare Inc.</h2>
                                <h3 className="text-lg font-bold text-gray-600 mt-1">Income Statement</h3>
                                <p className="text-sm text-gray-500 mt-1 italic">For the period ended {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                            </div>

                            {/* Revenues */}
                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Revenues</h3>
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

                            {/* Expenses */}
                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Operating Expenses</h3>
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

                            {/* Net Income Summary */}
                            <div className="flex justify-between items-center p-5 bg-[#E9FAFA] border border-[#B0DCDA] rounded-xl shadow-sm">
                                <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider">Net Income (Loss)</span>
                                <span className={`text-xl font-bold font-mono ${data.netIncome >= 0 ? 'text-[#1B9387]' : 'text-red-600'}`}>
                                    {formatCurrency(data.netIncome)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* =========================================
              C. BALANCE SHEET
          ========================================= */}
                    {statementType === 'balance' && (
                        <div className="space-y-8 bg-white max-w-3xl mx-auto">
                            {/* Report Header for Print */}
                            <div className="text-center pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-extrabold text-gray-800">SmartGuys Community Healthcare Inc.</h2>
                                <h3 className="text-lg font-bold text-gray-600 mt-1">Balance Sheet</h3>
                                <p className="text-sm text-gray-500 mt-1 italic">As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            </div>

                            {/* Assets */}
                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Assets</h3>
                                {data.assets?.map((asset: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{asset.name}</span>
                                        <span className={`font-mono ${asset.amount < 0 ? 'text-red-500 font-bold' : 'text-gray-800'}`}>{formatCurrency(asset.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Assets</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalAssets)}</span>
                                </div>
                            </div>

                            {/* Liabilities */}
                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Liabilities</h3>
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

                            {/* Equity */}
                            <div>
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">Equity</h3>
                                {data.equity?.map((eq: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">{eq.name}</span>
                                        <span className="font-mono text-gray-800">{formatCurrency(eq.amount)}</span>
                                    </div>
                                ))}
                                {/* Roll current Net Income into Equity equation */}
                                <div className="flex justify-between text-sm py-2 px-4 text-gray-500 italic">
                                    <span>Current Period Net Income / Loss</span>
                                    <span className="font-mono font-medium">{formatCurrency(data.netIncome)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                                    <span className="text-gray-800 uppercase tracking-wide">Total Equity</span>
                                    <span className="font-mono text-gray-800">{formatCurrency(data.totalEquity + data.netIncome)}</span>
                                </div>
                            </div>

                            {/* Equation Audit Check */}
                            <div className={`flex justify-between items-center p-5 border-t-2 border-b-4 double-border shadow-sm ${data.isEquationBalanced ? 'bg-[#E9FAFA] border-[#B0DCDA]' : 'bg-red-50 border-red-200'}`}>
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

                </div>
            )}
        </div>
    );
};