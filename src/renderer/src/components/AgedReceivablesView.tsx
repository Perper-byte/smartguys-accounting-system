import * as React from 'react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom' // 👈 Added for floating toast
import * as XLSX from 'xlsx' // 👈 Added for frontend Excel generation

// 👈 Added AlertTriangle, CheckCircle2, Info for the toast
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  ChevronRight,
  X,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react'

interface AgedReceivablesProps {
  onNavigate?: (viewName: string, data?: any) => void
}

export function AgedReceivablesView({ onNavigate }: AgedReceivablesProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null)

  // 👈 Upgraded TOAST STATE
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI

      // Fetch data from backend
      const result = api && api.getAgedReceivables ? await api.getAgedReceivables() : []

      setData(result || [])
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch aged receivables', error)
      showToast('Failed to fetch aged receivables.', 'error')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (val: number, showSymbol = false) => {
    if (!val || val === 0) return '-'
    const formattedStr = val.toLocaleString('en-US', { minimumFractionDigits: 2 })
    return showSymbol ? `₱ ${formattedStr}` : formattedStr
  }

  const filteredData = data.filter((row) =>
    (row.payeeName || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCurrent = filteredData.reduce((sum, row) => sum + (row.current || 0), 0)
  const total30 = filteredData.reduce((sum, row) => sum + (row.days30 || 0), 0)
  const total60 = filteredData.reduce((sum, row) => sum + (row.days60 || 0), 0)
  const total90 = filteredData.reduce((sum, row) => sum + (row.days90 || 0), 0)
  const grandTotal = filteredData.reduce((sum, row) => sum + (row.total || 0), 0)

  // 🌟 NEW: Frontend Excel Export with showSaveFilePicker
  const handleExportExcel = () => {
    if (filteredData.length === 0) return showToast('No data to export.', 'error')

    showToast('Preparing Excel file...', 'info')

    setTimeout(async () => {
      try {
        const exportData = filteredData.map((row) => ({
          'Patient / HMO / Entity': row.payeeName || 'Unknown',
          'Current (0-30)': row.current || 0,
          '31-60 Days': row.days30 || 0,
          '61-90 Days': row.days60 || 0,
          '90+ Days (Critical)': row.days90 || 0,
          'Total Balance': row.total || 0
        }))

        // Add Grand Totals row at the bottom
        exportData.push({
          'Patient / HMO / Entity': 'GRAND TOTALS',
          'Current (0-30)': totalCurrent,
          '31-60 Days': total30,
          '61-90 Days': total60,
          '90+ Days (Critical)': total90,
          'Total Balance': grandTotal
        })

        const worksheet = XLSX.utils.json_to_sheet(exportData)

        // Set optimal column widths
        worksheet['!cols'] = [
          { wch: 40 }, // Entity Name
          { wch: 18 }, // Current
          { wch: 18 }, // 31-60
          { wch: 18 }, // 61-90
          { wch: 20 }, // 90+
          { wch: 20 } // Total Balance
        ]

        // Format currency columns
        for (let row = 2; row <= exportData.length + 1; row++) {
          ;['B', 'C', 'D', 'E', 'F'].forEach((col) => {
            const cell = worksheet[`${col}${row}`]
            if (cell) {
              cell.t = 'n'
              cell.z = '"₱"#,##0.00'
            }
          })
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Aged Receivables')
        const filename = `Aged_Receivables_${new Date().toISOString().slice(0, 10)}.xlsx`

        // Use Modern File System Access API
        if ('showSaveFilePicker' in window) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: 'Excel Workbook',
                  accept: {
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                  }
                }
              ]
            })
            const writable = await handle.createWritable()
            const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
            await writable.write(buffer)
            await writable.close()

            showToast(`Exported successfully!\nSaved to: ${handle.name}`, 'success')
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              console.error('File Save Error:', err)
              showToast('Failed to save the Excel file.', 'error')
            } else {
              setToast(null) // Cancelled
            }
          }
        } else {
          // Fallback
          XLSX.writeFile(workbook, filename)
          setTimeout(() => {
            showToast(
              `Export initiated.\nSaved as: ${filename}\n(Check Downloads folder)`,
              'success'
            )
          }, 500)
        }
      } catch (error) {
        console.error('Error exporting to Excel:', error)
        showToast('System error while exporting to Excel.', 'error')
      }
    }, 150)
  }

  const getStatusStyle = (status: string) => {
    const s = (status || '').toUpperCase()
    if (s === 'PAID' || s === 'CLEARED') return 'bg-emerald-100 text-emerald-700'
    if (s === 'PARTIAL' || s === 'PARTIALLY PAID') return 'bg-amber-100 text-amber-700'
    return 'bg-orange-100 text-orange-700'
  }

  return (
    <div className="w-full h-full px-8 py-6 flex flex-col relative font-sans text-gray-800 animate-in fade-in duration-300">
      {/* 👈 FLOATING TOAST PROVIDER */}
      {toast &&
        createPortal(
          <div
            className={`fixed bottom-8 right-8 px-5 py-4 rounded-xl shadow-2xl text-white z-[999999] flex items-start space-x-3 transition-all duration-300 animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-[#1B9387]' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}
            style={{ maxWidth: '420px' }}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'error' && <AlertTriangle size={20} />}
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            <span className="whitespace-pre-line text-sm font-semibold leading-relaxed">
              {toast.message}
            </span>
          </div>,
          document.body
        )}

      <div className="w-full h-full flex-1 flex flex-col min-h-0">
        {/* HEADER */}
        <div className="flex justify-between items-end mb-6 pb-4 print:hidden">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">
              Aged Receivables (HMO Tracker)
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium flex items-center space-x-2">
              <span>
                As of{' '}
                {new Date().toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              {lastUpdated && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-[#1B9387]">
                    Last updated:{' '}
                    {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={fetchData}
              className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-md transition flex items-center justify-center cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || filteredData.length === 0}
              className="px-4 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-extrabold rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={16} />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-4 gap-4 mb-6 print:hidden">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-gray-300 flex flex-col justify-center">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              Total Outstanding
            </span>
            <span className="text-2xl font-black text-gray-800">
              {formatCurrency(grandTotal, true)}
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-[#1B9387] flex flex-col justify-center">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              Current (0-30 Days)
            </span>
            <span className="text-2xl font-black text-[#1B9387]">
              {formatCurrency(totalCurrent, true)}
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-amber-500 flex flex-col justify-center">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              31-60 Days
            </span>
            <span className="text-2xl font-black text-amber-500">
              {formatCurrency(total30, true)}
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-red-500 flex flex-col justify-center">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              90+ Days (Critical)
            </span>
            <span className="text-2xl font-black text-red-500">
              {formatCurrency(total90, true)}
            </span>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm print:hidden">
          <div className="relative w-1/3">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search HMO / Patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1B9387] focus:border-transparent"
            />
          </div>
          <div className="text-sm font-medium text-gray-500">
            Showing {filteredData.length} record{filteredData.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* TABLE WRAPPER CONTAINER */}
        <div className="bg-white border border-[#B0DCDA] rounded-xl flex flex-col shadow-sm overflow-hidden flex-1 min-h-0">
          {/* Scrollable Data Area */}
          <div className="overflow-auto relative flex-1 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center py-20 text-[#1B9387]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
              </div>
            ) : (
              <table className="w-full h-full table-fixed text-left text-sm whitespace-nowrap bg-white">
                <thead className="bg-gray-50 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-[#B0DCDA]">
                  <tr className="text-gray-500 uppercase tracking-wider text-xs font-extrabold h-[1px]">
                    <th className="p-4 pl-6 border-r border-gray-200 w-[28%]">
                      Patient / HMO / Entity
                    </th>
                    <th className="p-4 text-right border-r border-gray-200 text-[#1B9387] w-[12%]">
                      Current
                    </th>
                    <th className="p-4 text-right border-r border-gray-200 text-amber-500 w-[12%]">
                      31-60
                    </th>
                    <th className="p-4 text-right border-r border-gray-200 text-orange-500 w-[12%]">
                      61-90
                    </th>
                    <th className="p-4 text-right border-r border-[#B0DCDA] text-red-500 w-[12%]">
                      90+
                    </th>
                    <th className="p-4 text-right text-gray-600 border-r border-gray-200 w-[14%]">
                      Total
                    </th>
                    <th className="p-4 text-center text-gray-400 w-[10%] print:hidden">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-500 italic font-medium">
                        No outstanding receivables found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* Actual Data Rows */}
                      {filteredData.map((row: any, i: number) => (
                        <tr
                          key={i}
                          className="hover:bg-[#E9FAFA]/50 transition-colors bg-white group h-[1px]"
                        >
                          <td className="p-4 pl-6 font-extrabold text-gray-800 border-r border-gray-100 truncate">
                            {row.payeeName}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100 truncate">
                            {formatCurrency(row.current)}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100 truncate">
                            {formatCurrency(row.days30)}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-gray-100 truncate">
                            {formatCurrency(row.days60)}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-800 border-r border-[#B0DCDA] truncate">
                            {row.days90 > 0 ? (
                              <span className="text-red-600 flex justify-end items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                                {formatCurrency(row.days90)}
                              </span>
                            ) : (
                              formatCurrency(row.days90)
                            )}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-gray-800 bg-[#FBF8F8]/50 border-r border-gray-100 truncate">
                            {formatCurrency(row.total)}
                          </td>

                          <td className="p-2 text-center print:hidden">
                            <button
                              onClick={() => setSelectedEntity(row)}
                              className="text-[11px] font-bold text-[#1B9387] hover:text-[#126b62] bg-[#E9FAFA] hover:bg-[#B0DCDA]/40 px-3 py-1.5 rounded-md transition flex items-center justify-center w-full gap-1 tracking-wide uppercase cursor-pointer"
                            >
                              View <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* 1. Padding Rows filled with dashes (-) */}
                      {Array.from({ length: Math.max(0, 12 - filteredData.length) }).map((_, i) => (
                        <tr key={`empty-${i}`} className="bg-white group h-[1px]">
                          <td className="p-4 text-center text-gray-300 font-medium border-r border-gray-100">
                            -
                          </td>
                          <td className="p-4 text-center text-gray-300 font-medium border-r border-gray-100">
                            -
                          </td>
                          <td className="p-4 text-center text-gray-300 font-medium border-r border-gray-100">
                            -
                          </td>
                          <td className="p-4 text-center text-gray-300 font-medium border-r border-gray-100">
                            -
                          </td>
                          <td className="p-4 text-center text-gray-300 font-medium border-r border-[#B0DCDA]">
                            -
                          </td>
                          <td className="p-4 text-center text-gray-300 font-medium border-r border-gray-100 bg-[#FBF8F8]/50">
                            -
                          </td>
                          <td></td>
                        </tr>
                      ))}

                      {/* 2. Stretch Row to fill any extra screen space on large monitors */}
                      <tr className="h-auto">
                        <td className="border-r border-gray-100"></td>
                        <td className="border-r border-gray-100"></td>
                        <td className="border-r border-gray-100"></td>
                        <td className="border-r border-gray-100"></td>
                        <td className="border-r border-[#B0DCDA]"></td>
                        <td className="border-r border-gray-100 bg-[#FBF8F8]/50"></td>
                        <td></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* FIXED BOTTOM FOOTER - Pinned to the bottom of the card */}
          {!loading && filteredData.length > 0 && (
            <div className="bg-gray-50 shadow-[0_-1px_2px_rgba(0,0,0,0.05)] border-t border-[#B0DCDA] shrink-0 z-30">
              <table className="w-full table-fixed text-left text-sm whitespace-nowrap">
                <tbody>
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-800 text-right border-r border-gray-200 uppercase tracking-wider w-[28%] truncate">
                      Grand Totals
                    </td>
                    <td className="p-4 text-right font-mono font-black text-[#1B9387] border-r border-gray-200 w-[12%] truncate">
                      {formatCurrency(totalCurrent, true)}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-amber-500 border-r border-gray-200 w-[12%] truncate">
                      {formatCurrency(total30, true)}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-orange-500 border-r border-gray-200 w-[12%] truncate">
                      {formatCurrency(total60, true)}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-red-500 border-r border-[#B0DCDA] w-[12%] truncate">
                      {formatCurrency(total90, true)}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-gray-800 text-lg border-r border-gray-200 w-[14%] truncate">
                      {formatCurrency(grandTotal, true)}
                    </td>
                    <td className="print:hidden w-[10%]"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* DRILL-DOWN MODAL */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setSelectedEntity(null)}></div>

          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-xl font-extrabold text-gray-800 tracking-wide">
                  {selectedEntity.payeeName}
                </h3>
                <p className="text-xs font-bold text-gray-500 uppercase mt-1 tracking-wider">
                  Account Details & Aging
                </p>
              </div>
              <button
                onClick={() => setSelectedEntity(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="flex items-center justify-between bg-[#E9FAFA] border border-[#B0DCDA] p-4 rounded-lg mb-6">
                <span className="font-bold text-[#1B9387] uppercase tracking-wider text-sm">
                  Total Outstanding Balance
                </span>
                <span className="text-3xl font-black text-[#1B9387]">
                  {formatCurrency(selectedEntity.total, true)}
                </span>
              </div>

              <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">
                Aging Breakdown
              </h4>
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="border border-gray-200 rounded-md p-3 text-center">
                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Current</div>
                  <div className="font-mono font-bold text-gray-800">
                    {formatCurrency(selectedEntity.current)}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-md p-3 text-center">
                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                    31-60 Days
                  </div>
                  <div className="font-mono font-bold text-gray-800">
                    {formatCurrency(selectedEntity.days30)}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-md p-3 text-center">
                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                    61-90 Days
                  </div>
                  <div className="font-mono font-bold text-gray-800">
                    {formatCurrency(selectedEntity.days60)}
                  </div>
                </div>
                <div
                  className={`border rounded-md p-3 text-center ${selectedEntity.days90 > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase mb-1 ${selectedEntity.days90 > 0 ? 'text-red-600' : 'text-gray-500'}`}
                  >
                    90+ Days
                  </div>
                  <div
                    className={`font-mono font-bold ${selectedEntity.days90 > 0 ? 'text-red-600' : 'text-gray-800'}`}
                  >
                    {formatCurrency(selectedEntity.days90)}
                  </div>
                </div>
              </div>

              <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3 mt-6">
                Related Invoices
              </h4>
              {selectedEntity.invoices && selectedEntity.invoices.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-extrabold">
                      <tr>
                        <th className="p-3 border-r border-gray-100 pl-4">Invoice No.</th>
                        <th className="p-3 border-r border-gray-100">Date Issued</th>
                        <th className="p-3 border-r border-gray-100">Due Date</th>
                        <th className="p-3 border-r border-gray-100">Status</th>
                        <th className="p-3 text-right pr-4">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedEntity.invoices.map((inv: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50 bg-white">
                          <td className="p-3 pl-4 font-bold text-[#1B9387] border-r border-gray-100">
                            {inv.invoiceNo}
                          </td>
                          <td className="p-3 text-gray-600 border-r border-gray-100">
                            {new Date(inv.date).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-gray-600 border-r border-gray-100">
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </td>
                          <td className="p-3 border-r border-gray-100">
                            <span
                              className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(inv.status)}`}
                            >
                              {inv.status || 'UNPAID'}
                            </span>
                          </td>
                          <td className="p-3 pr-4 text-right font-mono font-bold text-gray-800">
                            {formatCurrency(inv.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg bg-gray-50 p-8 flex flex-col items-center justify-center text-center border-dashed">
                  <Receipt className="text-gray-300 mb-2" size={32} />
                  <p className="text-sm font-bold text-gray-600">No invoices found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    There are no individual invoices recorded for this balance.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
              <button
                onClick={() => setSelectedEntity(null)}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition cursor-pointer"
              >
                Close
              </button>
              <button
                className="px-5 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-extrabold rounded-md tracking-wider uppercase transition shadow-sm cursor-pointer"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('collections', {
                      prefillEntity: selectedEntity.payeeName,
                      prefillAmount: selectedEntity.total
                    })
                  }
                  setSelectedEntity(null)
                }}
              >
                Record Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
