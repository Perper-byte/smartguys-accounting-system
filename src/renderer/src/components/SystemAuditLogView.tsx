// src/renderer/src/components/SystemAuditLogView.tsx
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import {
  History,
  Download,
  Search,
  Filter,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react'

const getLocalDateString = (date: Date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

const ACTION_CATEGORIES = [
  { id: 'ALL', label: 'All Actions' },
  { id: 'TRANSACTION', label: 'Financial & Transactions', match: ['TRANSACTION', 'VOI'] },
  { id: 'HR', label: 'HR & Payroll', match: ['HR', 'PAYROLL'] },
  { id: 'INVENTORY', label: 'Inventory & Stock', match: ['INVENTORY'] },
  { id: 'SECURITY', label: 'Security & Auth', match: ['SECURITY', 'USER', 'LOGIN', 'PERMISSION'] },
  { id: 'SYSTEM CONFIG', label: 'System & Configuration', match: ['SYSTEM CONFIG', 'BACKUP', 'RESTORE'] },
  { id: 'TAX', label: 'Tax & Compliance', match: ['TAX', 'BIR'] },
  { id: 'EXPORT', label: 'Data Exports', match: ['EXPORT', 'REPORT'] }
]

export function SystemAuditLogView() {
  const today = new Date()
  const [startDate, setStartDate] = useState(getLocalDateString(today))
  const [endDate, setEndDate] = useState(getLocalDateString(today))

  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const data = await api.getAuditLogs(startDate, endDate)
      setLogs(data || [])
      setCurrentPage(1)
    } catch (error) {
      console.error('Failed to fetch audit logs', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [startDate, endDate])

  // Quick Preset Handlers
  const handlePreset = (type: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_30_days') => {
    const now = new Date()
    let start = new Date()
    let end = new Date()

    if (type === 'today') {
      start = now
      end = now
    } else if (type === 'yesterday') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      end = start
    } else if (type === 'this_week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      start = new Date(now.setDate(diff))
      end = new Date()
    } else if (type === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    } else if (type === 'last_30_days') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
      end = new Date()
    }

    setStartDate(getLocalDateString(start))
    setEndDate(getLocalDateString(end))
  }

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const cat = ACTION_CATEGORIES.find((c) => c.id === selectedCategory)
        if (cat?.match) {
          const actionUpper = (log.action || '').toUpperCase()
          const matched = cat.match.some((m) => actionUpper.includes(m))
          if (!matched) return false
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const user = (log.user?.username || 'SYSTEM').toLowerCase()
        const action = (log.action || '').toLowerCase()
        const details = (log.details || '').toLowerCase()
        if (!user.includes(q) && !action.includes(q) && !details.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [logs, selectedCategory, searchQuery])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage, pageSize])

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return alert('No data to export.')

    const headers = ['Timestamp', 'User', 'Action', 'Details']
    const rows = filteredLogs.map((log) =>
      [
        new Date(log.timestamp).toLocaleString(),
        `"${log.user?.username || 'SYSTEM'}"`,
        `"${log.action}"`,
        `"${log.details.replace(/"/g, '""')}"`
      ].join(',')
    )

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `System_Audit_Log_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toUpperCase()
    if (act.includes('DELETE') || act.includes('VOID') || act.includes('SECURITY')) {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }
    if (act.includes('HR') || act.includes('PAYROLL')) {
      return 'bg-purple-50 text-purple-700 border-purple-200'
    }
    if (act.includes('INVENTORY')) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    if (act.includes('CONFIG') || act.includes('BACKUP')) {
      return 'bg-blue-50 text-blue-700 border-blue-200'
    }
    if (act.includes('TAX')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
    return 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]'
  }

  return (
    <div className="w-full h-full flex flex-col p-6 font-sans bg-gray-50/30">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl shadow-xs p-6">
        {/* HEADER & ACTIONS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-5 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#E9FAFA] rounded-lg text-[#1B9387]">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 tracking-tight">
                  System Audit Trail
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  Immutable security audit logging required for BIR CAS accreditation and clinic compliance.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Presets */}
            <div className="flex items-center bg-[#FBF8F8] border border-gray-200 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => handlePreset('today')}
                className="px-2.5 py-1 text-gray-600 hover:text-gray-900 rounded font-bold hover:bg-white transition cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePreset('yesterday')}
                className="px-2.5 py-1 text-gray-600 hover:text-gray-900 rounded font-bold hover:bg-white transition cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePreset('this_month')}
                className="px-2.5 py-1 text-gray-600 hover:text-gray-900 rounded font-bold hover:bg-white transition cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePreset('last_30_days')}
                className="px-2.5 py-1 text-gray-600 hover:text-gray-900 rounded font-bold hover:bg-white transition cursor-pointer"
              >
                30 Days
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-bold text-gray-700 outline-none cursor-pointer"
              />
              <span className="text-xs text-gray-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-bold text-gray-700 outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              title="Refresh logs"
              className="p-2 text-gray-600 hover:text-[#1B9387] bg-white border border-gray-300 hover:border-[#1B9387] rounded-lg transition cursor-pointer shadow-2xs"
            >
              <RotateCcw size={15} />
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* FILTERS & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-center gap-3 py-3 border-b border-gray-100 shrink-0">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username, action keyword, or specific details..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-[#FBF8F8] border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1B9387] focus:bg-white transition"
            />
          </div>

          {/* Action Category Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={14} className="text-gray-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setCurrentPage(1)
              }}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#1B9387] cursor-pointer shadow-2xs w-full sm:w-56"
            >
              {ACTION_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#1B9387] cursor-pointer shadow-2xs"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
            </select>
          </div>
        </div>

        {/* LOGS TABLE */}
        <div className="flex-1 overflow-auto border border-gray-200 rounded-lg mt-3 relative">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-full py-16">
              <div className="w-8 h-8 rounded-full border-3 border-[#E9FAFA] border-t-[#1B9387] animate-spin" />
              <p className="mt-3 text-xs font-bold text-gray-500">Loading audit records...</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FBF8F8] sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-black">
                  <th className="py-2.5 px-4 w-44">Timestamp</th>
                  <th className="py-2.5 px-4 w-36">User</th>
                  <th className="py-2.5 px-4 w-48">Action</th>
                  <th className="py-2.5 px-4">Event Details & Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-gray-400 italic">
                      <History size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                      No audit events recorded for the selected period and filters.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log: any, i: number) => (
                    <tr key={i} className="hover:bg-[#FBF8F8] transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-gray-800">
                          {log.user?.username || 'SYSTEM'}
                        </span>
                        {log.user?.role && (
                          <span className="ml-1.5 text-[9px] text-gray-400 font-bold uppercase">
                            ({log.user.role})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-700 break-words leading-relaxed">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-2 border-t border-gray-100 text-xs text-gray-500 shrink-0">
          <div>
            Showing <strong className="font-bold text-gray-800">{filteredLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
            <strong className="font-bold text-gray-800">{Math.min(currentPage * pageSize, filteredLogs.length)}</strong> of{' '}
            <strong className="font-bold text-gray-800">{filteredLogs.length}</strong> total events
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-100 transition cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-bold text-gray-700 text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-100 transition cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

