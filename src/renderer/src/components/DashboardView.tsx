// src/renderer/src/components/DashboardView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export const DashboardView: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly')

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true)
      try {
        const api = (window as any).electronAPI
        const result = await api.getAnalyticsMetrics(timeframe)
        if (!result.error) {
          setData(result)
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [timeframe])

  const formatCurrency = (val: number) => {
    if (!val) return '₱ 0.00'
    const isNeg = val < 0
    const absVal = Math.abs(val)
    if (absVal >= 1000) return `${isNeg ? '-' : ''}₱ ${(absVal / 1000).toFixed(1)}k`
    return `${isNeg ? '-' : ''}₱ ${absVal.toFixed(2)}`
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center h-full text-[#1B9387]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
      </div>
    )
  }

  // --- ECHARTS CONFIGURATIONS ---
  const barChartOption = {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'system-ui, sans-serif' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: number) =>
        '₱ ' +
        value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    legend: {
      data: ['Revenue', 'Expenses'],
      textStyle: { color: '#4b5563', fontWeight: 'bold' },
      top: 0
    },
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
  }

  const donutChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      valueFormatter: (value: number) =>
        '₱ ' +
        value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal', // Switched to horizontal
      bottom: '0%', // Anchored to the bottom
      left: 'center', // Centered evenly
      textStyle: { color: '#4b5563', fontSize: 11, fontWeight: '600' }
    },
    series: [
      {
        name: 'Expenses',
        type: 'pie',
        radius: ['40%', '70%'], // Slightly shrunk to ensure space for the bottom legend
        center: ['50%', '45%'], // Perfectly centered the pie vertically and horizontally
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: { show: false },
        data:
          data.expenseBreakdown.length > 0 ? data.expenseBreakdown : [{ name: 'No Data', value: 0 }]
      }
    ]
  }

  if (!data) return null

  return (
    <div className="space-y-6 relative pb-6">
      {/* 💡 STICKY AI INSIGHT BANNER */}
      <div className="bg-gradient-to-r from-[#E9FAFA] to-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm flex flex-col items-center justify-center text-center transition-all relative overflow-hidden">
        <div className="absolute -left-6 -top-6 w-24 h-24 bg-[#1B9387]/10 rounded-full blur-2xl"></div>
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
        <h3 className="text-[11px] font-black text-[#1B9387] uppercase tracking-widest mb-2 flex items-center justify-center relative z-10">
          <span className="mr-2 text-base">✨</span> AI Financial Insight
        </h3>
        <p className="text-gray-700 text-sm leading-relaxed font-bold max-w-4xl mx-auto relative z-10">
          {data.narrative || 'No data available to generate insights for this period.'}
        </p>
      </div>

      {/* 1. TOP KPI CARDS */}
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold mb-2">
            Revenue
          </p>
          <p className="text-3xl font-black font-mono text-gray-800 tabular-nums leading-none">
            {formatCurrency(data.kpi.revenue)}
          </p>
        </div>

        <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold mb-2">
            Expenses
          </p>
          <p className="text-3xl font-black font-mono text-gray-800 tabular-nums leading-none">
            {formatCurrency(data.kpi.expenses)}
          </p>
        </div>

        <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold mb-2">
            Net Cash (Bank/Till)
          </p>
          <p
            className={`text-3xl font-black font-mono tabular-nums leading-none ${data.kpi.netCash < 0 ? 'text-rose-500' : 'text-emerald-600'}`}
          >
            {formatCurrency(data.kpi.netCash)}
          </p>
        </div>

        <div className="bg-white border-2 border-[#1B9387]/30 rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div
            className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 ${data.kpi.netProfit < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
          ></div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold mb-2">
            Net Profit / Loss
          </p>
          <p
            className={`text-3xl font-black font-mono tabular-nums leading-none ${data.kpi.netProfit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
          >
            {formatCurrency(data.kpi.netProfit)}
          </p>
        </div>
      </div>

      {/* 2. CHARTS SECTION */}
      <div className="grid grid-cols-3 gap-6">
        {/* BAR CHART */}
        <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-extrabold text-gray-800 tracking-wide">
              Revenue vs Expenses ({timeframe})
            </h3>

            {/* TIMEFRAME TOGGLE BUTTONS */}
            <div className="flex bg-[#FBF8F8] p-1 rounded-md border border-[#B0DCDA]">
              {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 text-[10px] font-extrabold rounded transition uppercase tracking-wider ${
                    timeframe === tf
                      ? 'bg-[#1B9387] text-white shadow-sm'
                      : 'text-gray-500 hover:text-[#1B9387]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 w-full min-h-[260px] relative">
            {loading ? (
              <div className="absolute inset-0 flex justify-center items-center bg-white/50 z-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B9387]"></div>
              </div>
            ) : null}
            <ReactECharts option={barChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* DONUT CHART */}
        <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-extrabold text-gray-800 mb-2 tracking-wide shrink-0">
            Expense Breakdown
          </h3>
          <div className="flex-1 w-full relative min-h-[260px]">
            <ReactECharts option={donutChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* 3. RECENT TRANSACTIONS TABLE */}
      <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide">
            Recent Transactions
          </h3>
          <span className="text-[9px] uppercase font-black text-[#1B9387] bg-white border border-[#B0DCDA] px-2 py-1 rounded shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Sync
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider bg-white border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Payee / Source</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentTransactions?.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-gray-500 text-xs font-medium italic"
                  >
                    No recent transactions found.
                  </td>
                </tr>
              ) : (
                data.recentTransactions?.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-3 text-sm font-bold text-gray-800">{tx.category}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 font-medium">{tx.payee}</td>
                    <td
                      className={`px-6 py-3 text-right font-mono font-black tabular-nums whitespace-nowrap flex items-center justify-end gap-2 ${tx.isOutflow ? 'text-rose-600' : 'text-emerald-600'}`}
                    >
                      {tx.isOutflow ? (
                        <svg
                          className="w-3.5 h-3.5 opacity-50"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5 opacity-50"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 10l7-7m0 0l7 7m-7-7v18"
                          />
                        </svg>
                      )}
                      {tx.isOutflow ? '-' : '+'} ₱{' '}
                      {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
