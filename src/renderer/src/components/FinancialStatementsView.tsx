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

    // Safeguarded to handle undefined, null, or invalid numbers cleanly
    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined || isNaN(val)) {
            return '₱ 0.00';
        }
        return `₱ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleExportExcel = async () => {
        const result = await (window as any).electronAPI.exportTrialBalanceExcel();
        if (result.success) {
            alert(`Report exported successfully to: ${result.filePath}`);
        } else if (result.error) {
            alert(`Export Failed: ${result.error}`);
        }
    };

    const handleExportPDF = async () => {
        const filename = `${statementType === 'trial' ? 'Trial_Balance' : statementType === 'income' ? 'Income_Statement' : 'Balance_Sheet'}.pdf`;
        const result = await (window as any).electronAPI.exportPDF(filename);
        if (result.success) {
            alert(`PDF report saved successfully to: ${result.filePath}`);
        } else if (result.error) {
            alert(`PDF Generation Failed: ${result.error}`);
        }
    };

    return (
        <div className="max-w-5xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b border-[#29292e] pb-4">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">Monthly Financial Statements</h2>
                    <div className="flex space-x-3 mt-3">
                        {/* Export PDF Button (Works on all tabs) */}
                        <button
                            onClick={handleExportPDF}
                            className="px-3 py-1.5 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-[10px] font-bold text-white rounded-md tracking-wider uppercase transition flex items-center space-x-2"
                        >
                            <span>📄</span> <span>Export PDF</span>
                        </button>

                        {/* Export Excel Button (Only active/visible on Trial Balance) */}
                        {statementType === 'trial' && (
                            <button
                                onClick={handleExportExcel}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 rounded-md tracking-wider uppercase transition flex items-center space-x-2"
                            >
                                <span>📊</span> <span>Export Excel</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex bg-[#121214] p-1 rounded-md border border-[#29292e]">
                    {(['trial', 'income', 'balance'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setStatementType(type)}
                            className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${statementType === type
                                ? 'bg-[#4f46e5] text-white'
                                : 'text-[#8d8d99] hover:text-white'
                                }`}
                        >
                            {type === 'trial' ? 'Trial Balance' : type === 'income' ? 'Income Statement' : 'Balance Sheet'}
                        </button>
                    ))}
                </div>
            </div>

            {loading && <p className="text-center text-[#8d8d99] py-12">Generating statement...</p>}

            {!loading && data && (
                <div className="space-y-6">

                    {/* A. TRIAL BALANCE */}
                    {statementType === 'trial' && (
                        <div className="border border-[#29292e] rounded-md overflow-hidden bg-[#121214]">
                            <table className="w-full">
                                <thead className="bg-[#202024] border-b border-[#29292e] text-[#8d8d99] text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3 text-left">Account Code</th>
                                        <th className="p-3 text-left">Account Name</th>
                                        <th className="p-3 text-right">Debit</th>
                                        <th className="p-3 text-right">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {data.lines?.map((line: any) => (
                                        <tr key={line.accountCode} className="border-b border-[#29292e]/40 hover:bg-[#202024]/30 transition">
                                            <td className="p-3 text-[#8d8d99] font-mono">{line.accountCode}</td>
                                            <td className="p-3 text-white font-medium">{line.accountName}</td>
                                            <td className="p-3 text-right font-mono text-emerald-400">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                                            <td className="p-3 text-right font-mono text-red-400">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-[#202024] font-bold text-white border-t-2 border-[#29292e]">
                                        <td colSpan={2} className="p-3 text-left uppercase tracking-wider">Total</td>
                                        <td className="p-3 text-right font-mono">{formatCurrency(data.totalDebits)}</td>
                                        <td className="p-3 text-right font-mono">{formatCurrency(data.totalCredits)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* B. INCOME STATEMENT */}
                    {statementType === 'income' && (
                        <div className="space-y-6 bg-[#121214] p-6 rounded-md border border-[#29292e]">
                            <div className="border-b border-[#29292e] pb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99]">Revenues</h3>
                                {data.revenue?.map((rev: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2">
                                        <span className="text-white">{rev.name}</span>
                                        <span className="font-mono text-emerald-400">{formatCurrency(rev.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#29292e]/30">
                                    <span className="text-white">Total Revenue</span>
                                    <span className="font-mono text-emerald-400">{formatCurrency(data.totalRevenue)}</span>
                                </div>
                            </div>

                            <div className="border-b border-[#29292e] pb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99]">Operating Expenses</h3>
                                {data.expenses?.map((exp: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2">
                                        <span className="text-white">{exp.name}</span>
                                        <span className="font-mono text-red-400">{formatCurrency(exp.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#29292e]/30">
                                    <span className="text-white">Total Operating Expenses</span>
                                    <span className="font-mono text-red-400">{formatCurrency(data.totalExpenses)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-[#202024] border border-[#29292e] rounded">
                                <span className="text-base font-bold text-white uppercase tracking-wider">Net Income (Loss)</span>
                                <span className={`text-lg font-bold font-mono ${data.netIncome >= 0 ? 'text-emerald-400' : 'text-[#f75a68]'}`}>
                                    {formatCurrency(data.netIncome)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* C. BALANCE SHEET */}
                    {statementType === 'balance' && (
                        <div className="space-y-6 bg-[#121214] p-6 rounded-md border border-[#29292e]">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] border-b border-[#29292e] pb-2 mb-2">Assets</h3>
                                {data.assets?.map((asset: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2">
                                        <span className="text-white">{asset.name}</span>
                                        <span className={`font-mono ${asset.amount < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(asset.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-[#29292e]/30 bg-[#202024]/40 p-2 rounded">
                                    <span className="text-white">Total Assets</span>
                                    <span className="font-mono text-white">{formatCurrency(data.totalAssets)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] border-b border-[#29292e] pb-2 mb-2">Liabilities</h3>
                                {data.liabilities?.map((lia: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2">
                                        <span className="text-white">{lia.name}</span>
                                        <span className="font-mono text-white">{formatCurrency(lia.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-[#29292e]/30 bg-[#202024]/40 p-2 rounded">
                                    <span className="text-white">Total Liabilities</span>
                                    <span className="font-mono text-white">{formatCurrency(data.totalLiabilities)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] border-b border-[#29292e] pb-2 mb-2">Equity</h3>
                                {data.equity?.map((eq: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2">
                                        <span className="text-white">{eq.name}</span>
                                        <span className="font-mono text-white">{formatCurrency(eq.amount)}</span>
                                    </div>
                                ))}
                                {/* Roll current Net Income into Equity equation */}
                                <div className="flex justify-between text-sm py-2 italic text-[#8d8d99]">
                                    <span>Current Period Net Income / Loss</span>
                                    <span className="font-mono">{formatCurrency(data.netIncome)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-[#29292e]/30 bg-[#202024]/40 p-2 rounded">
                                    <span className="text-white">Total Equity</span>
                                    <span className="font-mono text-white">{formatCurrency(data.totalEquity + data.netIncome)}</span>
                                </div>
                            </div>

                            {/* Equation Audit Check */}
                            <div className="flex justify-between items-center p-4 bg-[#202024] border border-[#29292e] rounded">
                                <span className="text-sm font-bold text-white uppercase tracking-wider">Total Liabilities & Equity</span>
                                <span className="text-lg font-bold font-mono text-white">
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