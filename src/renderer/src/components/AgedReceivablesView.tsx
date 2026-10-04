// src/renderer/src/components/AgedReceivablesView.tsx
import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  Building2,
  User
} from 'lucide-react'

// Self-contained formatter (no external import required)
const cleanDescription = (desc?: string): string => {
  if (!desc) return ''
  return desc.replace(/\[.*?\]/g, '').trim()
}

interface Invoice {
  id?: string
  invoiceNo?: string
  referenceNo?: string
  date?: string
  dateIssued?: string
  dueDate?: string
  status: string
  amount?: number
  total?: number
  balance?: number
  paid?: number
  patientName?: string
  patient?: any
  description?: string
  payeeName?: string
  payeeId?: string
}

interface AgingEntity {
  id: string
  name: string
  type: string
  current: number
  days31_60: number
  days61_90: number
  days90Plus: number
  total: number
  invoices: Invoice[]
}

interface AgedReceivablesViewProps {
  userId?: string
  onNavigate?: (tabId: string, data?: any) => void
  onNavigateToReceivePayment?: (prefillData: {
    prefillEntity: string
    prefillAmount: number
    referenceNo: string
    payeeId?: string
  }) => void
}

// Helper to resolve patient name from invoice
const getPatientName = (inv: Invoice, fallbackPayeeName?: string): string => {
  if (inv.patientName) return inv.patientName
  if ((inv as any).patient_name) return (inv as any).patient_name
  if (inv.patient?.name) return inv.patient.name
  if (typeof inv.patient === 'string' && inv.patient.trim()) return inv.patient

  const desc = inv.description || ''
  const ptMatch = desc.match(/(?:Patient|Pt\.?|Patient\s*Name):\s*([^|\n,]+)/i)
  if (ptMatch) return ptMatch[1].trim()

  if (desc.includes('|')) {
    const firstPart = cleanDescription(desc).split('|')[0].trim()
    if (
      firstPart &&
      !firstPart.toLowerCase().includes('billing') &&
      !firstPart.toLowerCase().includes('invoice') &&
      !firstPart.toLowerCase().includes('hmo')
    ) {
      return firstPart
    }
  }

  return fallbackPayeeName || '—'
}

// Calculate days elapsed from invoice date
const getInvoiceAgeInDays = (dateStr?: string): number => {
  if (!dateStr) return 0
  const invDate = new Date(dateStr).getTime()
  const today = new Date().getTime()
  return Math.max(0, Math.floor((today - invDate) / (1000 * 60 * 60 * 24)))
}

export function AgedReceivablesView({
  onNavigate,
  onNavigateToReceivePayment
}: AgedReceivablesViewProps) {
  const [loading, setLoading] = useState(false)
  const [entities, setEntities] = useState<AgingEntity[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // Modal State
  const [selectedEntity, setSelectedEntity] = useState<AgingEntity | null>(null)
  const [modalSearchQuery, setModalSearchQuery] = useState('')
  const [modalSortOrder, setModalSortOrder] = useState<'desc' | 'asc' | 'none'>('desc')

  // Load Data
  const loadData = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api) return

      let invoices: Invoice[] = []
      let payees: any[] = []

      if (api.getPayees) {
        payees = (await api.getPayees()) || []
      }

      if (api.getInvoiceTracker) {
        invoices = (await api.getInvoiceTracker()) || []
      }

      // Group invoices by Payee/Entity & calculate aging
      const entityMap: Record<string, AgingEntity> = {}

      for (const p of payees) {
        entityMap[p.name] = {
          id: p.id,
          name: p.name,
          type: p.type || 'HMO',
          current: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          total: 0,
          invoices: []
        }
      }

      invoices.forEach((inv) => {
        const entityName = inv.payeeName || 'Direct Patient'
        const due =
          inv.balance !== undefined
            ? inv.balance
            : inv.status?.toUpperCase() === 'PAID'
              ? 0
              : (inv.amount || inv.total || 0)

        if (!entityMap[entityName]) {
          entityMap[entityName] = {
            id: inv.payeeId || entityName,
            name: entityName,
            type: 'HMO',
            current: 0,
            days31_60: 0,
            days61_90: 0,
            days90Plus: 0,
            total: 0,
            invoices: []
          }
        }

        entityMap[entityName].invoices.push(inv)

        if (due > 0) {
          const ageDays = getInvoiceAgeInDays(inv.dateIssued || inv.date)
          entityMap[entityName].total += due

          if (ageDays <= 30) {
            entityMap[entityName].current += due
          } else if (ageDays <= 60) {
            entityMap[entityName].days31_60 += due
          } else if (ageDays <= 90) {
            entityMap[entityName].days61_90 += due
          } else {
            entityMap[entityName].days90Plus += due
          }
        }
      })

      const result = Object.values(entityMap).filter(
        (e) => e.total > 0 || e.invoices.length > 0
      )

      setEntities(result)
      setLastUpdated(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      )
    } catch (err) {
      console.error('Failed to load aged receivables:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // KPI Computations
  const summary = useMemo(() => {
    return entities.reduce(
      (acc, e) => {
        acc.total += e.total
        acc.current += e.current
        acc.days31_60 += e.days31_60
        acc.days61_90 += e.days61_90
        acc.days90Plus += e.days90Plus
        return acc
      },
      { total: 0, current: 0, days31_60: 0, days61_90: 0, days90Plus: 0 }
    )
  }, [entities])

  // Filtered Entities for main table
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return entities
    const q = searchQuery.toLowerCase()
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.invoices.some(
          (inv) =>
            (inv.referenceNo || '').toLowerCase().includes(q) ||
            getPatientName(inv).toLowerCase().includes(q)
        )
    )
  }, [entities, searchQuery])

  // Processed Invoices for Modal
  const modalInvoices = useMemo(() => {
    if (!selectedEntity) return []
    let list = [...selectedEntity.invoices]

    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase()
      list = list.filter((inv) => {
        const ref = (inv.referenceNo || inv.invoiceNo || '').toLowerCase()
        const pt = getPatientName(inv).toLowerCase()
        const desc = (inv.description || '').toLowerCase()
        const status = (inv.status || '').toLowerCase()
        return ref.includes(q) || pt.includes(q) || desc.includes(q) || status.includes(q)
      })
    }

    if (modalSortOrder !== 'none') {
      list.sort((a, b) => {
        const dateA = new Date(a.dateIssued || a.date || '').getTime() || 0
        const dateB = new Date(b.dateIssued || b.date || '').getTime() || 0
        return modalSortOrder === 'desc' ? dateA - dateB : dateB - dateA
      })
    }

    return list
  }, [selectedEntity, modalSearchQuery, modalSortOrder])

  // Route to ReceivePayment (tab: 'collections') with pre-checked invoice
  const handleCollectInvoice = (entity: AgingEntity, inv: Invoice) => {
    const refNo = inv.referenceNo || inv.invoiceNo || ''
    const due = inv.balance !== undefined ? inv.balance : (inv.amount || inv.total || 0)

    const payload = {
      prefillEntity: entity.name,
      prefillAmount: due,
      referenceNo: refNo,
      payeeId: entity.id
    }

    setSelectedEntity(null)

    if (onNavigate) {
      onNavigate('collections', payload)
    } else if (onNavigateToReceivePayment) {
      onNavigateToReceivePayment(payload)
    }
  }

  // Route to ReceivePayment for entire account
  const handleCollectAccount = (entity: AgingEntity) => {
    const payload = {
      prefillEntity: entity.name,
      prefillAmount: entity.total,
      referenceNo: '',
      payeeId: entity.id
    }

    setSelectedEntity(null)

    if (onNavigate) {
      onNavigate('collections', payload)
    } else if (onNavigateToReceivePayment) {
      onNavigateToReceivePayment(payload)
    }
  }

  // Export to Excel / CSV
  const handleExportCSV = () => {
    const headers = [
      'Patient / HMO / Entity',
      'Current (0-30)',
      '31-60 Days',
      '61-90 Days',
      '90+ Days',
      'Total Outstanding'
    ]
    const rows = filteredEntities.map((e) => [
      `"${e.name}"`,
      e.current.toFixed(2),
      e.days31_60.toFixed(2),
      e.days61_90.toFixed(2),
      e.days90Plus.toFixed(2),
      e.total.toFixed(2)
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Aged_Receivables_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto p-6 md:p-8 font-sans text-slate-800">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Aged Receivables (HMO Tracker)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {lastUpdated && ` • Last updated: ${lastUpdated}`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh Data"
            className="p-2.5 bg-white border border-slate-200 hover:border-[#1B9387] rounded-xl text-slate-600 hover:text-[#1B9387] shadow-2xs transition cursor-pointer"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white border border-[#B0DCDA] hover:bg-teal-50/50 text-[#1B9387] text-xs font-black uppercase tracking-wider rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-[#1B9387] hover:bg-[#167d73] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Printer size={16} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Total Outstanding
          </span>
          <span className="text-2xl font-black font-mono text-slate-900">
            ₱ {summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white border-t-4 border-t-[#1B9387] border-slate-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-[10px] font-bold text-[#1B9387] uppercase tracking-wider block mb-1">
            Current (0-30 Days)
          </span>
          <span className="text-2xl font-black font-mono text-[#1B9387]">
            {summary.current > 0
              ? `₱ ${summary.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : '—'}
          </span>
        </div>

        <div className="bg-white border-t-4 border-t-amber-500 border-slate-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">
            31-60 Days
          </span>
          <span className="text-2xl font-black font-mono text-amber-600">
            {summary.days31_60 > 0
              ? `₱ ${summary.days31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : '—'}
          </span>
        </div>

        <div className="bg-white border-t-4 border-t-rose-500 border-slate-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
            90+ Days (Critical)
          </span>
          <span className="text-2xl font-black font-mono text-rose-600">
            {summary.days90Plus > 0
              ? `₱ ${summary.days90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : '—'}
          </span>
        </div>
      </div>

      {/* SEARCH AND RECORD COUNT */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search HMO / Patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] transition shadow-2xs"
          />
        </div>
        <span className="text-xs font-bold text-slate-400">
          Showing {filteredEntities.length} record{filteredEntities.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* MAIN AGING TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFBFB] border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-4 px-6">Patient / HMO / Entity</th>
                <th className="py-4 px-4 text-right text-[#1B9387]">Current</th>
                <th className="py-4 px-4 text-right text-amber-500">31-60</th>
                <th className="py-4 px-4 text-right text-orange-500">61-90</th>
                <th className="py-4 px-4 text-right text-rose-500">90+</th>
                <th className="py-4 px-6 text-right text-slate-800">Total</th>
                <th className="py-4 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic text-xs">
                    {searchQuery ? `No records matching "${searchQuery}"` : 'No aged receivables found.'}
                  </td>
                </tr>
              ) : (
                filteredEntities.map((e) => (
                  <tr key={e.name} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                          {e.type === 'PATIENT' ? <User size={14} /> : <Building2 size={14} />}
                        </div>
                        <span className="font-extrabold text-slate-900 text-sm">{e.name}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-700">
                      {e.current > 0
                        ? Number(e.current).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-700">
                      {e.days31_60 > 0
                        ? Number(e.days31_60).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-700">
                      {e.days61_90 > 0
                        ? Number(e.days61_90).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-700">
                      {e.days90Plus > 0
                        ? Number(e.days90Plus).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>

                    <td className="py-4 px-6 text-right font-mono font-black text-slate-900">
                      {e.total > 0
                        ? Number(e.total).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntity(e)
                          setModalSearchQuery('')
                          setModalSortOrder('desc')
                        }}
                        className="px-3 py-1.5 bg-[#E9FAFA] hover:bg-[#d8f5f3] text-[#1B9387] border border-[#B0DCDA] rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 mx-auto transition cursor-pointer shadow-2xs"
                      >
                        <span>View</span>
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* GRAND TOTALS FOOTER */}
            {filteredEntities.length > 0 && (
              <tfoot className="bg-[#FAFBFB] border-t-2 border-slate-200 text-xs">
                <tr>
                  <td className="py-4 px-6 font-black uppercase tracking-wider text-slate-900">
                    Grand Totals
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-black text-[#1B9387]">
                    ₱ {summary.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-black text-amber-600">
                    {summary.days31_60 > 0
                      ? `₱ ${summary.days31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-black text-orange-600">
                    {summary.days61_90 > 0
                      ? `₱ ${summary.days61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-black text-rose-600">
                    {summary.days90Plus > 0
                      ? `₱ ${summary.days90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-black text-slate-900 text-base">
                    ₱ {summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ACCOUNT DETAILS & AGING MODAL                            */}
      {/* ======================================================== */}
      {selectedEntity && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#B0DCDA] rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            {/* MODAL HEADER */}
            <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {selectedEntity.name}
                </h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Account Details & Aging
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* TOTAL OUTSTANDING CARD */}
              <div className="bg-[#E9FAFA] border border-[#B0DCDA] rounded-xl px-6 py-4 flex items-center justify-between">
                <span className="text-xs font-black text-[#1B9387] uppercase tracking-wider">
                  Total Outstanding Balance
                </span>
                <span className="text-2xl font-mono font-black text-[#1B9387]">
                  ₱ {Number(selectedEntity.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* AGING BREAKDOWN 4-COLUMNS */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Aging Breakdown
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="border border-slate-200 rounded-xl p-3 bg-white text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Current
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-800">
                      {selectedEntity.current
                        ? Number(selectedEntity.current).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-white text-center">
                    <span className="text-[10px] font-bold text-amber-500 uppercase block mb-1">
                      31-60 Days
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-800">
                      {selectedEntity.days31_60
                        ? Number(selectedEntity.days31_60).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-white text-center">
                    <span className="text-[10px] font-bold text-orange-500 uppercase block mb-1">
                      61-90 Days
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-800">
                      {selectedEntity.days61_90
                        ? Number(selectedEntity.days61_90).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-white text-center">
                    <span className="text-[10px] font-bold text-rose-500 uppercase block mb-1">
                      90+ Days
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-800">
                      {selectedEntity.days90Plus
                        ? Number(selectedEntity.days90Plus).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* RELATED INVOICES */}
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Related Invoices ({modalInvoices.length})
                  </h4>

                  {/* SEARCH & SORT CONTROLS */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:w-60">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search Inv, Patient..."
                        value={modalSearchQuery}
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#1B9387] transition"
                      />
                      {modalSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModalSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Sort by Days Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setModalSortOrder((prev) =>
                          prev === 'desc' ? 'asc' : prev === 'asc' ? 'none' : 'desc'
                        )
                      }
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-[#1B9387] rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition shrink-0"
                      title="Sort by Age / Overdue Days"
                    >
                      <ArrowUpDown size={13} className="text-slate-400" />
                      <span>
                        Days:{' '}
                        {modalSortOrder === 'desc'
                          ? 'Oldest'
                          : modalSortOrder === 'asc'
                            ? 'Newest'
                            : 'Default'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* INVOICES TABLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAFBFB] border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Invoice No.</th>
                        <th className="p-3">Patient Name</th>
                        <th className="p-3">Date Issued</th>
                        <th
                          className="p-3 cursor-pointer hover:bg-slate-100 transition"
                          onClick={() =>
                            setModalSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                          }
                          title="Click to sort by Age"
                        >
                          <div className="flex items-center gap-1">
                            <span>Age (Days)</span>
                            {modalSortOrder === 'desc' && (
                              <ArrowDown size={11} className="text-[#1B9387]" />
                            )}
                            {modalSortOrder === 'asc' && (
                              <ArrowUp size={11} className="text-[#1B9387]" />
                            )}
                          </div>
                        </th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                            {modalSearchQuery
                              ? `No invoices match "${modalSearchQuery}"`
                              : 'No invoices recorded.'}
                          </td>
                        </tr>
                      ) : (
                        modalInvoices.map((inv) => {
                          const refNo = inv.referenceNo || inv.invoiceNo || 'INV'
                          const patient = getPatientName(inv, selectedEntity.name)
                          const isPaid = inv.status?.toUpperCase() === 'PAID'
                          const isPartial = inv.status?.toUpperCase() === 'PARTIALLY PAID'
                          const invDate = inv.dateIssued || inv.date
                          const ageDays = getInvoiceAgeInDays(invDate)
                          const displayAmount =
                            inv.balance !== undefined
                              ? inv.balance
                              : isPaid
                                ? 0
                                : (inv.amount || inv.total || 0)

                          return (
                            <tr key={refNo} className="hover:bg-slate-50/80 transition">
                              {/* INVOICE NO */}
                              <td className="p-3 font-mono font-black text-[#1B9387]">
                                {refNo}
                              </td>

                              {/* PATIENT NAME (BESIDE INV NO) */}
                              <td className="p-3">
                                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                                  {patient}
                                </span>
                              </td>

                              {/* DATE ISSUED */}
                              <td className="p-3 text-slate-500 font-medium">
                                {invDate ? new Date(invDate).toLocaleDateString() : '—'}
                              </td>

                              {/* AGE (DAYS) */}
                              <td className="p-3 font-mono font-bold">
                                <span
                                  className={`${
                                    ageDays > 90
                                      ? 'text-rose-600'
                                      : ageDays > 60
                                        ? 'text-orange-500'
                                        : ageDays > 30
                                          ? 'text-amber-500'
                                          : 'text-slate-500'
                                  }`}
                                >
                                  {ageDays} d
                                </span>
                              </td>

                              {/* STATUS */}
                              <td className="p-3 text-center">
                                {isPaid ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Paid
                                  </span>
                                ) : isPartial ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                    Partial
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-200">
                                    Unpaid
                                  </span>
                                )}
                              </td>

                              {/* AMOUNT */}
                              <td className="p-3 text-right font-mono font-bold text-slate-800">
                                {isPaid ? (
                                  <span className="text-slate-300">—</span>
                                ) : (
                                  `₱ ${Number(displayAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                )}
                              </td>

                              {/* ACTION BUTTON */}
                              <td className="p-3 text-center">
                                {isPaid ? (
                                  <span className="text-slate-300 text-[10px] italic">Cleared</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleCollectInvoice(selectedEntity, inv)}
                                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                                    title={`Collect ${refNo}`}
                                  >
                                    <span>Collect</span>
                                    <ChevronRight size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedEntity(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleCollectAccount(selectedEntity)}
                className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#167d73] text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md shadow-[#1B9387]/20 flex items-center gap-2 cursor-pointer"
              >
                <Receipt size={15} />
                <span>Record Collection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}