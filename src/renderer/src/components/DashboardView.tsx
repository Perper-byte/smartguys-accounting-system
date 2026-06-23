// src/renderer/src/components/DashboardView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

export const DashboardView: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const api = (window as any).electronAPI;
                const result = await api.getAnalyticsMetrics();
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
    }, []);

    const formatCurrency = (val: number) => {
        if (!val) return '₱ 0.00';
        return `₱ ${(val / 1000).toFixed(1)}k`; // Format as "₱ 12.4k" for clean dashboard look
    };

    if (loading || !data) {
        return (
            <div className="flex justify-center items-center h-full text-[#4f46e5]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            </div>
        );
    }

    // --- ECHARTS CONFIGURATIONS ---

    // 1. Revenue vs Expenses Bar Chart
    const barChartOption = {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'system-ui, sans-serif' },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: ['Revenue', 'Expenses'], textStyle: { color: '#8d8d99' }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: data.trendData.labels,
            axisLabel: { color: '#8d8d99' },
            axisLine: { lineStyle: { color: '#29292e' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#8d8d99' },
            splitLine: { lineStyle: { color: '#29292e', type: 'dashed' } }
        },
        series: [
            {
                name: 'Revenue',
                type: 'bar',
                data: data.trendData.revenue,
                itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } // Emerald
            },
            {
                name: 'Expenses',
                type: 'bar',
                data: data.trendData.expenses,
                itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] } // Rose
            }
        ]
    };

    // 2. Expense Breakdown Donut Chart
    const donutChartOption = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: ₱{c} ({d}%)' },
        legend: { bottom: '0%', textStyle: { color: '#8d8d99', fontSize: 10 } },
        series: [
            {
                name: 'Expenses',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 5,
                    borderColor: '#202024',
                    borderWidth: 2
                },
                label: { show: false },
                data: data.expenseBreakdown.length > 0 ? data.expenseBreakdown : [{ name: 'No Data', value: 0 }]
            }
        ]
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* 1. TOP KPI CARDS */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#202024] border border-[#29292e] rounded-lg p-5 shadow-md">
                    <h3 className="text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Revenue</h3>
                    <p className="text-2xl font-bold font-mono text-emerald-400">{formatCurrency(data.kpi.revenue)}</p>
                </div>

                <div className="bg-[#202024] border border-[#29292e] rounded-lg p-5 shadow-md">
                    <h3 className="text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Expenses</h3>
                    <p className="text-2xl font-bold font-mono text-[#f75a68]">{formatCurrency(data.kpi.expenses)}</p>
                </div>

                <div className="bg-[#202024] border border-[#29292e] rounded-lg p-5 shadow-md">
                    <h3 className="text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Net Cash</h3>
                    <p className={`text-2xl font-bold font-mono ${data.kpi.netCash < 0 ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                        {formatCurrency(data.kpi.netCash)}
                    </p>
                </div>

                <div className="bg-[#202024] border border-[#29292e] rounded-lg p-5 shadow-md">
                    <h3 className="text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Operating Margin</h3>
                    <p className={`text-2xl font-bold font-mono ${data.kpi.margin < 0 ? 'text-[#f75a68]' : 'text-[#4f46e5]'}`}>
                        {data.kpi.margin}%
                    </p>
                </div>
            </div>

            {/* 2. CHARTS SECTION */}
            <div className="grid grid-cols-3 gap-6">

                {/* BAR CHART */}
                <div className="col-span-2 bg-[#202024] border border-[#29292e] rounded-lg p-6 shadow-md">
                    <h3 className="text-sm font-bold text-white mb-4">Revenue vs Expenses (6 months)</h3>
                    <div className="h-64 w-full">
                        <ReactECharts option={barChartOption} style={{ height: '100%', width: '100%' }} />
                    </div>
                </div>

                {/* DONUT CHART */}
                <div className="col-span-1 bg-[#202024] border border-[#29292e] rounded-lg p-6 shadow-md">
                    <h3 className="text-sm font-bold text-white mb-4">Expense Breakdown</h3>
                    <div className="h-64 w-full">
                        <ReactECharts option={donutChartOption} style={{ height: '100%', width: '100%' }} />
                    </div>
                </div>

            </div>
        </div>
    );
};