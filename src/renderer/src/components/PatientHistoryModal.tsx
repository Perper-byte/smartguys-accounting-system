import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Calendar,
  FileText,
  Receipt,
  Building2,
  User,
  ChevronRight,
  Printer,
  CheckSquare,
  Square,
  Search
} from 'lucide-react'
import { PatientInvoiceModal } from './PatientInvoiceModal'
import { cleanDescription } from '../utils/formatters'

export function PatientHistoryModal({
  patientId,
  patientName,
  isOpen,
  onClose
}: {
  patientId: string
  patientName: string
  isOpen: boolean
  onClose: () => void
}) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
  const [bulkInvoicesToPrint, setBulkInvoicesToPrint] = useState<any[] | null>(null)

  // Filters: Search & Date/Calendar
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // Selection mode for bulk printing
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set())

  const fetchHistory = async () => {
    const idToUse = (patientId || '').trim()
    const nameToUse = (patientName || '').trim()

    if (!idToUse && !nameToUse) {
      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api?.getPatientTransactions) {
        const data = await api.getPatientTransactions({
          patientId: idToUse,
          patientName: nameToUse
        })
        setTransactions(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch patient transactions', err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setSelectedInvoice(null)
      setBulkInvoicesToPrint(null)
      setIsSelectionMode(false)
      setSelectedTxIds(new Set())
      setSearchQuery('')
      setDateFilter('')
      return
    }

    fetchHistory()
  }, [isOpen, patientId, patientName])

  // Filtered transactions based on search query and date picker
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return transactions.filter((tx) => {
      const ref = String(tx.reference_no || tx.referenceNo || '').toLowerCase()
      const desc = String(tx.rawDescription || tx.description || '').toLowerCase()
      const payee = String(tx.payeeName || '').toLowerCase()
      const pName = String(patientName || '').toLowerCase()

      const matchesSearch =
        !query ||
        ref.includes(query) ||
        desc.includes(query) ||
        payee.includes(query) ||
        pName.includes(query)

      let matchesDate = true
      if (dateFilter) {
        const d = new Date(tx.date || tx.created_at)
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        matchesDate = localDateStr === dateFilter
      }

      return matchesSearch && matchesDate
    })
  }, [transactions, searchQuery, dateFilter, patientName])

  const toggleSelectTx = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const newSet = new Set(selectedTxIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedTxIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set())
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)))
    }
  }

  const handleBulkPrint = () => {
    const toPrint = filteredTransactions.filter((t) => selectedTxIds.has(t.id))
    if (toPrint.length === 0) return
    setBulkInvoicesToPrint(toPrint)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
        <div className="bg-white border border-[#B0DCDA] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 bg-[#FBF8F8]">
            <div>
              <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-[#1B9387]" />
                Transaction History
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Patient: <strong className="text-gray-800">{patientName || 'Walk-in / Unspecified'}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchHistory}
                disabled={loading}
                title="Refresh patient transactions"
                className="px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#B0DCDA] bg-white text-gray-700 hover:text-[#1B9387] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                <span>Refresh</span>
              </button>
              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode)
                    if (!isSelectionMode) {
                      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)))
                    } else {
                      setSelectedTxIds(new Set())
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    isSelectionMode
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white text-gray-700 hover:text-[#1B9387] border-gray-200 hover:border-[#B0DCDA]'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>{isSelectionMode ? 'Cancel Print' : 'Bulk Print'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-2 rounded-full transition border border-gray-200 shadow-2xs cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Date/Calendar Filter Toolbar */}
          <div className="px-8 py-3 bg-[#FBF8F8] border-b border-gray-200/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Search Input */}
            <div className="flex-1 min-w-[220px] max-w-sm relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search invoices (e.g. INV-006, HMO, notes)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#B0DCDA] rounded-xl pl-9 pr-8 py-1.5 text-xs font-semibold text-gray-800 placeholder-gray-400 outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387]/30 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date / Calendar Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-[#B0DCDA] rounded-xl px-3 py-1.5 shadow-2xs focus-within:border-[#1B9387]">
                <Calendar className="w-3.5 h-3.5 text-[#1B9387]" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer"
                  title="Filter by Date"
                />
              </div>

              {(dateFilter || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('')
                    setSearchQuery('')
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:text-red-600 bg-white border border-gray-200 hover:border-red-300 rounded-xl transition cursor-pointer shadow-2xs"
                  title="Clear all filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          {isSelectionMode && filteredTransactions.length > 0 && (
            <div className="px-8 py-2.5 bg-[#E9FAFA] border-b border-[#B0DCDA] flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#1B9387] hover:underline cursor-pointer"
                >
                  {selectedTxIds.size === filteredTransactions.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedTxIds.size === filteredTransactions.length ? 'Deselect All' : 'Select All'}
                  </span>
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  • <strong>{selectedTxIds.size}</strong> of {filteredTransactions.length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={handleBulkPrint}
                disabled={selectedTxIds.size === 0}
                className="px-4 py-1.5 bg-[#1B9387] hover:bg-[#15796f] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Selected ({selectedTxIds.size} Pages PDF)</span>
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-20 text-gray-400 gap-3">
                <div className="w-8 h-8 border-3 border-[#1B9387] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold">Loading history for {patientName}...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-medium">
                No past transactions found for <strong className="text-gray-600">{patientName}</strong>.
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-16 text-gray-500 font-medium space-y-3">
                <p>No transactions found matching your search or date filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setDateFilter('')
                  }}
                  className="px-4 py-1.5 bg-white border border-[#B0DCDA] text-[#1B9387] text-xs font-bold rounded-xl hover:bg-teal-50 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((tx: any) => {
                  const totalAmount =
                    tx.lines
                      ?.filter((l: any) => Number(l.credit) > 0)
                      .reduce((sum: number, l: any) => sum + Number(l.credit), 0) || 0

                  // Clean description: strip [META:...] and [ITEMS:...]
                  const clean = cleanDescription(tx.rawDescription || tx.description || '')

                  // Extract strictly the single clean summary line (e.g. "Patient: Juan | A/R: Maxicare Healthcare (LOA: 123)")
                  let summaryLine = ''
                  const firstLineMatch = clean.match(/^([^\n]+)/)
                  if (firstLineMatch) {
                    summaryLine = firstLineMatch[1].trim()
                  }
                  if (!summaryLine || summaryLine.startsWith('Remarks:')) {
                    summaryLine = `Patient: ${patientName || tx.patientName || 'Walk-in'}`
                  }

                  const isChecked = selectedTxIds.has(tx.id)

                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleSelectTx(tx.id)
                        } else {
                          setSelectedInvoice(tx)
                        }
                      }}
                      className={`bg-white p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer group shadow-2xs ${
                        isChecked
                          ? 'border-[#1B9387] ring-1 ring-[#1B9387] bg-teal-50/20'
                          : 'border-gray-200 hover:border-[#1B9387] hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Checkbox in selection mode */}
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleSelectTx(tx.id, e as any)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 mt-1 text-[#1B9387] border-gray-300 rounded focus:ring-[#1B9387] cursor-pointer"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Top Badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedInvoice(tx)
                              }}
                              className="bg-[#E9FAFA] group-hover:bg-[#1B9387] text-[#1B9387] group-hover:text-white px-2 py-0.5 rounded-md text-xs font-black tracking-wider uppercase font-mono transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Click to view detailed invoice"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              {tx.reference_no || tx.referenceNo}
                            </span>
                            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(tx.date || tx.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            {tx.payeeName && tx.payeeName !== patientName && (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-indigo-500" />
                                {tx.payeeName}
                              </span>
                            )}
                          </div>

                          {/* Concise Single-Line Preview */}
                          <p className="text-sm text-gray-700 flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="truncate font-medium">{summaryLine}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0 border-gray-100 flex flex-row md:flex-col justify-between items-end gap-1">
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Total Amount
                          </div>
                          <div className="text-lg font-black font-mono text-[#1B9387]">
                            ₱ {Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#1B9387] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          View Invoice <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pop-out Single Invoice Detail Modal */}
      <PatientInvoiceModal
        isOpen={selectedInvoice !== null}
        onClose={() => setSelectedInvoice(null)}
        transaction={selectedInvoice}
        patientName={patientName}
      />

      {/* Pop-out Bulk Invoice Print Modal */}
      <PatientInvoiceModal
        isOpen={bulkInvoicesToPrint !== null}
        onClose={() => setBulkInvoicesToPrint(null)}
        transactions={bulkInvoicesToPrint || []}
        patientName={patientName}
        autoPrint={true}
      />
    </>
  )
}

