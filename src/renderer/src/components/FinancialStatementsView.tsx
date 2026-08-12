import * as React from 'react';
import { useState, useEffect } from 'react';

export const FinancialStatementsView: React.FC = () => {
    const [statementType, setStatementType] = useState<'trial' | 'income' | 'balance'>('trial');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Date Filter States
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    const fetchReport = async () => {
        setLoading(true);
        setData(null);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            let result;
            if (statementType === 'trial') result = await api.getTrialBalance(startDate, endDate);
            else if (statementType === 'income') result = await api.getIncomeStatement(startDate, endDate);
            else if (statementType === 'balance') result = await api.getBalanceSheet(startDate, endDate);

            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [statementType]);

    const formatCurrency = (val: number | null | undefined, isAbnormal: boolean = false) => {
        if (val === null || val === undefined || isNaN(val) || val === 0) return '—';
        const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isAbnormal || val < 0 ? `(₱ ${formatted})` : `₱ ${formatted}`;
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="max-w-5xl mx-auto h-full flex flex-col font-sans text-gray-200">
            
            {/* ---> REDESIGNED SPACIOUS HEADER <--- */}
            <div className="flex flex-col mb-6 border-b border-[#29292e] pb-6 space-y-6 print:hidden">
                
                {/* Top Row: Title & Print Button */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-wide">Financial Statements</h2>
                        <p className="text-sm text-gray-400 mt-1">View and export official clinic financial reports.</p>
                    </div>
                    <button 
                        onClick={handlePrint} 
                        disabled={loading || !data} 
                        className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] text-xs font-bold text-white rounded-md tracking-wider uppercase transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer shadow-md"
                    >
                        <span>🖨️</span> <span>Print / Save PDF</span>
                    </button>
                </div>

                {/* Bottom Row: Date Filters & Tabs */}
                <div className="flex justify-between items-center">
                    
                    {/* Date Picker Container */}
                    <div className="flex items-center bg-[#121214] border border-[#29292e] rounded-lg p-1.5 shadow-inner">
                        <div className="flex items-center px-3 space-x-3">
                            <span className="text-xs text-[#8d8d99] uppercase font-bold tracking-wider">From:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="bg-transparent text-sm text-white outline-none cursor-pointer" 
                            />
                        </div>
                        <div className="w-px h-6 bg-[#29292e] mx-1"></div>
                        <div className="flex items-center px-3 space-x-3">
                            <span className="text-xs text-[#8d8d99] uppercase font-bold tracking-wider">To:</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="bg-transparent text-sm text-white outline-none cursor-pointer" 
                            />
                        </div>
                        <button 
                            onClick={fetchReport} 
                            className="ml-2 bg-[#4f46e5] hover:bg-[#5b54f6] text-white px-4 py-1.5 rounded text-xs font-bold transition shadow"
                        >
                            Apply
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex bg-[#121214] p-1.5 rounded-lg border border-[#29292e] shadow-inner">
                        {(['trial', 'income', 'balance'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setStatementType(type)}
                                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${statementType === type
                                    ? 'bg-[#4f46e5] text-white shadow-md'
                                    : 'text-[#8d8d99] hover:text-white hover:bg-[#202024]'
                                    }`}
                            >
                                {type === 'trial' ? 'Trial Balance' : type === 'income' ? 'Income Statement' : 'Balance Sheet'}
                            </button>
                        ))}
                    </div>

                </div>
            </div>
            {/* ---> END OF REDESIGNED HEADER <--- */}

            {/* Official Print Header (Only visible on paper) */}
            <div className="hidden print:block text-center mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">SmartGuys Clinic Inc.</h1>
                <h2 className="text-lg font-bold uppercase mt-1 text-black">
                    {statementType === 'trial' ? 'Trial Balance' : statementType === 'income' ? 'Income Statement' : 'Balance Sheet'}
                </h2>
                <p className="text-sm italic text-gray-600">
                    For the period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                </p>
            </div>

            {loading && <div className="flex justify-center items-center py-20 text-[#4f46e5] print:hidden"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div></div>}

            {!loading && data && (
                <div className="space-y-6 print:text-black">

                    {/* A. TRIAL BALANCE */}
                    {statementType === 'trial' && (
                        <div className="border border-[#29292e] print:border-gray-300 rounded-md overflow-hidden bg-[#121214] print:bg-white shadow-xl print:shadow-none">
                            <table className="w-full">
                                <thead className="bg-[#202024] print:bg-gray-100 border-b border-[#29292e] print:border-gray-300 text-[#8d8d99] print:text-black text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 text-left font-bold">Account Code</th>
                                        <th className="p-4 text-left font-bold">Account Name</th>
                                        <th className="p-4 text-right font-bold">Debit</th>
                                        <th className="p-4 text-right font-bold">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {data.lines?.map((line: any) => (
                                        <tr key={line.accountCode} className="border-b border-[#29292e]/40 print:border-gray-200 hover:bg-[#202024]/30 print:hover:bg-transparent transition">
                                            <td className="p-4 text-[#8d8d99] print:text-black font-mono">{line.accountCode}</td>
                                            <td className="p-4 text-white print:text-black font-medium">{line.accountName}</td>
                                            <td className="p-4 text-right font-mono text-emerald-400 print:text-black">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                                            <td className="p-4 text-right font-mono text-red-400 print:text-black">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-[#202024] print:bg-gray-100 font-bold text-white print:text-black border-t-2 border-[#29292e] print:border-gray-400">
                                        <td colSpan={2} className="p-4 text-left uppercase tracking-wider">Total</td>
                                        <td className="p-4 text-right font-mono">{formatCurrency(data.totalDebits)}</td>
                                        <td className="p-4 text-right font-mono">{formatCurrency(data.totalCredits)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* B. INCOME STATEMENT */}
                    {statementType === 'income' && (
                        <div className="max-w-3xl mx-auto space-y-6 bg-[#121214] print:bg-white p-8 rounded-lg border border-[#29292e] print:border-none print:p-0 shadow-xl print:shadow-none">
                            <div className="border-b border-[#29292e] print:border-gray-300 pb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] print:text-black mb-3">Revenues</h3>
                                {data.revenue?.map((rev: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 pl-4">
                                        <span className="text-gray-300 print:text-black">{rev.name}</span>
                                        <span className="font-mono text-white print:text-black">{formatCurrency(rev.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold pt-3 mt-2 border-t border-[#29292e]/30 print:border-gray-300 pl-4">
                                    <span className="text-white print:text-black">Total Revenue</span>
                                    <span className="font-mono text-emerald-400 print:text-black">{formatCurrency(data.totalRevenue)}</span>
                                </div>
                            </div>

                            <div className="border-b border-[#29292e] print:border-gray-300 pb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] print:text-black mb-3">Operating Expenses</h3>
                                {data.expenses?.map((exp: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 pl-4">
                                        <span className="text-gray-300 print:text-black">{exp.name}</span>
                                        <span className="font-mono text-white print:text-black">{formatCurrency(exp.amount)}</span>
                                    </div>
                                ))}
                                {data.expenses?.length === 0 && <div className="text-gray-500 italic text-sm pl-4">No expenses recorded.</div>}
                                <div className="flex justify-between text-sm font-bold pt-3 mt-2 border-t border-[#29292e]/30 print:border-gray-300 pl-4">
                                    <span className="text-white print:text-black">Total Operating Expenses</span>
                                    <span className="font-mono text-red-400 print:text-black">{formatCurrency(data.totalExpenses)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-5 bg-[#202024] print:bg-gray-100 border border-[#29292e] print:border-gray-400 rounded-lg">
                                <span className="text-base font-bold text-white print:text-black uppercase tracking-wider">Net Income (Loss)</span>
                                <span className={`text-xl font-bold font-mono ${data.netIncome >= 0 ? 'text-emerald-400 print:text-black' : 'text-[#f75a68] print:text-black'}`}>
                                    {formatCurrency(data.netIncome, data.netIncome < 0)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* C. BALANCE SHEET */}
                    {statementType === 'balance' && (
                        <div className="max-w-3xl mx-auto space-y-6 bg-[#121214] print:bg-white p-8 rounded-lg border border-[#29292e] print:border-none print:p-0 shadow-xl print:shadow-none">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] print:text-black border-b border-[#29292e] print:border-gray-300 pb-2 mb-3">Assets</h3>
                                {data.assets?.map((asset: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 pl-4">
                                        <span className="text-gray-300 print:text-black">{asset.name}</span>
                                        <span className={`font-mono ${asset.amount < 0 ? 'text-[#f75a68] print:text-black' : 'text-white print:text-black'}`}>{formatCurrency(asset.amount, asset.amount < 0)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold pt-3 mt-2 border-t border-[#29292e]/30 print:border-gray-300 bg-[#202024]/40 print:bg-transparent p-3 rounded pl-4">
                                    <span className="text-white print:text-black uppercase tracking-wider">Total Assets</span>
                                    <span className="font-mono text-emerald-400 print:text-black border-b-2 border-double border-emerald-400 print:border-black">{formatCurrency(data.totalAssets)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] print:text-black border-b border-[#29292e] print:border-gray-300 pb-2 mb-3">Liabilities</h3>
                                {data.liabilities?.map((lia: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 pl-4">
                                        <span className="text-gray-300 print:text-black">{lia.name}</span>
                                        <span className="font-mono text-white print:text-black">{formatCurrency(lia.amount)}</span>
                                    </div>
                                ))}
                                {data.liabilities?.length === 0 && <div className="text-gray-500 italic text-sm pl-4">No liabilities recorded.</div>}
                                <div className="flex justify-between text-sm font-bold pt-3 mt-2 border-t border-[#29292e]/30 print:border-gray-300 bg-[#202024]/40 print:bg-transparent p-3 rounded pl-4">
                                    <span className="text-white print:text-black">Total Liabilities</span>
                                    <span className="font-mono text-white print:text-black">{formatCurrency(data.totalLiabilities)}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8d8d99] print:text-black border-b border-[#29292e] print:border-gray-300 pb-2 mb-3">Owner's Equity</h3>
                                {data.equity?.map((eq: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 pl-4">
                                        <span className="text-gray-300 print:text-black">{eq.name}</span>
                                        <span className="font-mono text-white print:text-black">{formatCurrency(eq.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm py-2 italic text-[#8d8d99] print:text-gray-600 pl-4">
                                    <span>Current Period Net Income / Loss</span>
                                    <span className="font-mono print:text-black">{formatCurrency(data.netIncome, data.netIncome < 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold pt-3 mt-2 border-t border-[#29292e]/30 print:border-gray-300 bg-[#202024]/40 print:bg-transparent p-3 rounded pl-4">
                                    <span className="text-white print:text-black">Total Equity</span>
                                    <span className="font-mono text-white print:text-black">{formatCurrency(data.totalEquity + data.netIncome)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-5 bg-[#202024] print:bg-gray-100 border border-[#29292e] print:border-gray-400 rounded-lg">
                                <span className="text-sm font-bold text-white print:text-black uppercase tracking-wider">Total Liabilities & Equity</span>
                                <span className="text-xl font-bold font-mono text-emerald-400 print:text-black border-b-4 border-double border-emerald-400 print:border-black pb-1">
                                    {formatCurrency(data.totalLiabilitiesAndEquity)}
                                </span>
                            </div>
                            
                            {!data.isEquationBalanced && (
                                <div className="text-center text-red-500 font-bold text-sm uppercase tracking-widest mt-4 print:hidden">
                                    ⚠️ ERROR: BALANCE SHEET IS OUT OF BALANCE
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};