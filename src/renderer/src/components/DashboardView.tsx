// src/renderer/src/components/DashboardView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const DashboardView: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Timeframe>('monthly'); // Added State!

    useEffect(() => {
        const fetchMetrics = async () => {
            setLoading(true); // Show loader when switching timeframe
            try {
                const api = (window as any).electronAPI;
                const result = await api.getAnalyticsMetrics(timeframe); // Passed timeframe!
                if (!result.error) {
                    setData(result);
                }
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [timeframe]); // Refetch automatically when timeframe changes!

    const formatCurrency = (val: number) => {
        if (!val) return '₱ 0.00';
        if (Math.abs(val) >= 1000) return `₱ ${(val / 1000).toFixed(1)}k`;
        return `₱ ${val.toFixed(2)}`;
    };

    if (loading || !data) {
        return (
            <div className="flex justify-center items-center h-full text-[#1B9387]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            </div>
        );
    }

    // --- ECHARTS CONFIGURATIONS FOR LIGHT THEME ---
    const barChartOption = {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'system-ui, sans-serif' },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: ['Revenue', 'Expenses'], textStyle: { color: '#4b5563', fontWeight: 'bold' }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: data.trendData.labels,
            axisLabel: { color: '#6b7280', fontWeight: '500' },
            axisLine: { lineStyle: { color: '#d1d5db' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#6b7280', fontWeight: '500' },
            splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } }
        },
        series: [
            {
                name: 'Revenue',
                type: 'bar',
                data: data.trendData.revenue,
                itemStyle: { color: '#1B9387', borderRadius: [4, 4, 0, 0] }
            },
            {
                name: 'Expenses',
                type: 'bar',
                data: data.trendData.expenses,
                itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] }
            }
        ]
    };

    const donutChartOption = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: ₱{c} ({d}%)' },
        legend: {
            type: 'scroll', // Allows scrolling if there are many expenses
            bottom: '0%',
            textStyle: { color: '#4b5563', fontSize: 11, fontWeight: '500' }
        },
        series: [
            {
                name: 'Expenses',
                type: 'pie',
                radius: ['40%', '65%'], // FIXED: Reduced radius to prevent overlap
                center: ['50%', '42%'], // FIXED: Shifted pie chart upwards
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 6,
                    borderColor: '#ffffff',
                    borderWidth: 3
                },
                label: { show: false },
                data: data.expenseBreakdown.length > 0 ? data.expenseBreakdown : [{ name: 'No Data', value: 0 }]
            }
        ]
    };

    if (!data) return null; // Prevent crash during very fast toggle


    return (
        <div className="space-y-6 relative">

            {/* 💡 STICKY AI INSIGHT BANNER (At the top, centered, doesn't move) */}
            <div className="sticky bg-[#E9FAFA]/95 backdrop-blur-md border border-[#B0DCDA] rounded-xl p-5 shadow-md flex flex-col items-center justify-center text-center transition-all">
                <h3 className="text-sm font-extrabold text-[#1B9387] uppercase tracking-wider mb-2 flex items-center justify-center">
                    <span className="mr-2 text-xl">💡</span> AI Insight
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed font-medium max-w-4xl mx-auto">
                    {data.narrative || "No data available to generate insights for this period."}
                </p>
            </div>

            {/* 1. TOP KPI CARDS */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm hover:shadow-md transition">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Revenue</h3>
                    <p className="text-2xl font-bold font-mono text-[#1B9387]">{formatCurrency(data.kpi.revenue)}</p>
                </div>

                <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm hover:shadow-md transition">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expenses</h3>
                    <p className="text-2xl font-bold font-mono text-red-500">{formatCurrency(data.kpi.expenses)}</p>
                </div>

                <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm hover:shadow-md transition">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Net Cash</h3>
                    <p className={`text-2xl font-bold font-mono ${data.kpi.netCash < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                        {formatCurrency(data.kpi.netCash)}
                    </p>
                </div>

                <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm hover:shadow-md transition">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Operating Margin</h3>
                    <p className={`text-2xl font-bold font-mono ${data.kpi.margin < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>
                        {data.kpi.margin}%
                    </p>
                </div>
            </div>

            {/* 2. CHARTS SECTION */}
            <div className="grid grid-cols-3 gap-6">
                {/* BAR CHART */}
                <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-extrabold text-gray-800 tracking-wide">
                            Revenue vs Expenses ({timeframe})
                        </h3>

                        {/* TIMEFRAME TOGGLE BUTTONS */}
                        <div className="flex bg-[#FBF8F8] p-1 rounded-md border border-[#B0DCDA]">
                            {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-3 py-1.5 text-[10px] font-extrabold rounded transition uppercase tracking-wider ${timeframe === tf
                                            ? 'bg-[#1B9387] text-white shadow-sm'
                                            : 'text-gray-500 hover:text-[#1B9387]'
                                        }`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[250px] relative">
                        {loading ? (
                            <div className="absolute inset-0 flex justify-center items-center bg-white/50 z-10">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B9387]"></div>
                            </div>
                        ) : null}
                        <ReactECharts option={barChartOption} style={{ height: '100%', width: '100%' }} />
                    </div>
                </div>

                {/* DONUT CHART */}
                <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-extrabold text-gray-800 mb-4 tracking-wide">Expense Breakdown</h3>
                    <div className="h-64 w-full">
                        <ReactECharts option={donutChartOption} style={{ height: '100%', width: '100%' }} />
                    </div>
                </div>
            </div>

            {/* 3. RECENT TRANSACTIONS TABLE (Now Full Width) */}
            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#B0DCDA] bg-gray-50 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-gray-800 tracking-wide">Recent Transactions</h3>
                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-white border border-[#B0DCDA] px-2 py-1 rounded">Live Sync</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 uppercase tracking-wider bg-white border-b border-[#B0DCDA]">
                            <tr>
                                <th className="px-6 py-3 text-left font-bold">Date</th>
                                <th className="px-6 py-3 text-left font-bold">Category</th>
                                <th className="px-6 py-3 text-left font-bold">Payee / Source</th>
                                <th className="px-6 py-3 text-right font-bold">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.recentTransactions?.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No recent transactions found.</td>
                                </tr>
                            ) : (
                                data.recentTransactions?.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                                            {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-800">{tx.category}</td>
                                        <td className="px-6 py-3 text-gray-600">{tx.payee}</td>
                                        <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">
                                            ₱ {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};
