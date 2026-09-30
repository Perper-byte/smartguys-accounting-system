// src/renderer/src/components/JournalManagementView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Search,
  Download,
  Plus,
  FileText,
  X,
  Paperclip,
  Image as ImageIcon,
  File as FileIcon
} from 'lucide-react'
import { JournalEntryForm } from './JournalEntryForm'

const PAGE_SIZE = 50
const LARGE_AMOUNT_NO_CONTACT = 50000 // flag big entries that have no contact

const escapeHtml = (s: any) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<
          string,
          string
        >
      )[c]
  )

// One date format everywhere: MM/DD/YYYY
const formatDate = (d: any) =>
  new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

const isManualRef = (ref: string) => (ref || '').startsWith('JV-') || (ref || '').startsWith('ADJ-')

const money = (amount: number) =>
  Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const statusLabel = (status: string) =>
  status === 'ACTIVE' ? 'Recorded' : (status || '').replace('_', ' ')

export function JournalManagementView({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'ALL' | 'MANUAL' | 'SYSTEM'>('ALL')
  const [statusTab, setStatusTab] = useState<'ACTIVE' | 'DRAFTS' | 'VOIDED'>('ACTIVE')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null)

  // PDF export state
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  )

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const data = await api.getAllJournalEntries()
      setEntries(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch journals:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isCreatingNew) fetchEntries()
  }, [isCreatingNew])

  useEffect(() => {
    setPage(1)
  }, [activeTab, statusTab, searchQuery])

  const entryTotal = (entry: any) =>
    entry.lines?.reduce((sum: number, l: any) => sum + Number(l.debit), 0) || 0

  const renderStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-200">
          Recorded
        </span>
      )
    }
    if (status === 'VOIDED') {
      return (
        <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-red-50 text-red-600 border-red-200">
          Voided
        </span>
      )
    }
    return (
      <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
        {(status || '').replace('_', ' ')}
      </span>
    )
  }

  const renderTypeBadge = (ref: string) =>
    isManualRef(ref) ? (
      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-200">
        Manual
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
        System
      </span>
    )

  // Filter Logic
  const filteredEntries = entries.filter((entry) => {
    const searchStr = searchQuery.toLowerCase()
    const matchesSearch =
      entry.reference_no?.toLowerCase().includes(searchStr) ||
      entry.payee?.name?.toLowerCase().includes(searchStr) ||
      entry.description?.toLowerCase().includes(searchStr)
    if (!matchesSearch) return false

    const isManual = isManualRef(entry.reference_no)
    if (activeTab === 'MANUAL' && !isManual) return false
    if (activeTab === 'SYSTEM' && isManual) return false

    if (statusTab === 'ACTIVE' && entry.status !== 'ACTIVE') return false
    if (statusTab === 'VOIDED' && entry.status !== 'VOIDED') return false
    if (statusTab === 'DRAFTS' && entry.status !== 'DRAFT' && entry.status !== 'PENDING_VOID')
      return false

    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const pagedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ==========================================
  // PDF EXPORT
  // ==========================================
  const runExport = async (html: string, filename: string, landscape: boolean) => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api?.exportHtmlToPDF) {
      setExportMsg({ type: 'error', msg: 'Export is unavailable. Fully restart the app.' })
      return
    }
    setExporting(true)
    setExportMsg(null)
    try {
      const res = await api.exportHtmlToPDF(html, filename, { landscape })
      if (res?.success) {
        setExportMsg({ type: 'success', msg: 'PDF saved.' })
        setTimeout(() => setExportMsg(null), 5000)
      } else if (res?.error && res.error !== 'Export cancelled') {
        setExportMsg({ type: 'error', msg: res.error })
      }
    } catch (error: any) {
      setExportMsg({ type: 'error', msg: error.message || 'Export failed.' })
    } finally {
      setExporting(false)
    }
  }

  const baseCss = `
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; margin: 0; }
      h1 { font-size: 20px; margin: 0 0 2px; }
      .sub { color: #555; margin: 0 0 10px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
      tr { page-break-inside: avoid; }
      th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
      th { background: #e8e8e8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; }
      tfoot td { background: #f0f0f0; font-weight: bold; }
      .r { text-align: right; } .c { text-align: center; }
      .mono { font-family: 'Courier New', monospace; }
    `

  const handleExportList = () => {
    if (filteredEntries.length === 0) {
      setExportMsg({ type: 'error', msg: 'There are no journals to export.' })
      return
    }
    const tabLabel =
      activeTab === 'ALL'
        ? 'All Journals'
        : activeTab === 'MANUAL'
          ? 'Manual Journals'
          : 'System Journals'
    const filterText = [
      `Category: ${tabLabel}`,
      `Status: ${statusTab.charAt(0) + statusTab.slice(1).toLowerCase()}`,
      searchQuery.trim() ? `Search: "${searchQuery.trim()}"` : ''
    ]
      .filter(Boolean)
      .join('  |  ')

    const grand = filteredEntries.reduce((s, e) => s + entryTotal(e), 0)
    const rows = filteredEntries
      .map(
        (e) => `
            <tr>
                <td>${escapeHtml(e.payee?.name || '-')}</td>
                <td class="mono">${escapeHtml(e.reference_no)}</td>
                <td class="c">${escapeHtml(formatDate(e.date))}</td>
                <td class="c">${isManualRef(e.reference_no) ? 'Manual' : 'System'}</td>
                <td class="c">${escapeHtml(statusLabel(e.status))}</td>
                <td>${escapeHtml(e.description || '')}</td>
                <td class="r mono">${money(entryTotal(e))}</td>
            </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Journals</title>
<style>${baseCss}</style></head><body>
  <h1>Journal Entries</h1>
  <p class="sub">SmartGuys Community Healthcare Inc. &bull; Generated ${escapeHtml(new Date().toLocaleString())}<br>
     <strong>Filters:</strong> ${escapeHtml(filterText)} &bull; ${filteredEntries.length} record(s)</p>
  <table>
    <thead><tr>
      <th>Contact</th><th>Reference</th><th class="c">Date</th><th class="c">Type</th>
      <th class="c">Status</th><th>Description</th><th class="r">Amount (PHP)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="6" class="r">TOTAL</td><td class="r mono">${money(grand)}</td></tr></tfoot>
  </table>
</body></html>`
    runExport(html, `Journals_${new Date().toLocaleDateString('en-CA')}.pdf`, true)
  }

  const handleExportSingle = (entry: any) => {
    const totalD = entry.lines?.reduce((s: number, l: any) => s + Number(l.debit), 0) || 0
    const totalC = entry.lines?.reduce((s: number, l: any) => s + Number(l.credit), 0) || 0
    const lineRows = (entry.lines || [])
      .map(
        (l: any) => `
            <tr>
                <td><span class="mono"><strong>${escapeHtml(l.account?.code)}</strong></span> ${escapeHtml(l.account?.name)}</td>
                <td class="r mono">${Number(l.debit) ? money(Number(l.debit)) : ''}</td>
                <td class="r mono">${Number(l.credit) ? money(Number(l.credit)) : ''}</td>
            </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(entry.reference_no)}</title>
<style>${baseCss}
  .meta { display: flex; flex-wrap: wrap; gap: 8px 32px; margin: 10px 0 14px; }
  .meta div { min-width: 140px; }
  .lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; }
  .notes { border: 1px solid #999; padding: 8px; min-height: 50px; margin-top: 12px; }
</style></head><body>
  <h1>Journal: ${escapeHtml(entry.reference_no)}</h1>
  <p class="sub">SmartGuys Community Healthcare Inc. &bull; Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <div class="meta">
    <div><div class="lbl">Type</div>${isManualRef(entry.reference_no) ? 'Manual Journal' : 'System Journal'}</div>
    <div><div class="lbl">Contact</div>${escapeHtml(entry.payee?.name || '-')}</div>
    <div><div class="lbl">Status</div>${escapeHtml(statusLabel(entry.status))}</div>
    <div><div class="lbl">Date</div>${escapeHtml(formatDate(entry.date))}</div>
  </div>
  <table>
    <thead><tr><th>Account</th><th class="r">Debit (PHP)</th><th class="r">Credit (PHP)</th></tr></thead>
    <tbody>${lineRows}</tbody>
    <tfoot><tr><td class="r">JOURNAL AMOUNT</td><td class="r mono">${money(totalD)}</td><td class="r mono">${money(totalC)}</td></tr></tfoot>
  </table>
  <div class="lbl" style="margin-top:12px">Internal Notes</div>
  <div class="notes">${escapeHtml(entry.description || 'No notes provided.')}</div>
</body></html>`
    runExport(html, `Journal_${entry.reference_no}.pdf`, false)
  }

  // ==========================================
  // VIEW 1: CREATION FORM (full width)
  // ==========================================
  if (isCreatingNew) {
    return (
      <div className="w-full min-h-[calc(100vh-64px)] p-6 lg:px-8 bg-[#f9fafb]">
        <div className="w-full mb-4">
          <button
            onClick={() => setIsCreatingNew(false)}
            className="text-gray-500 hover:text-[#1B9387] font-bold text-sm transition flex items-center gap-2"
          >
            ← Back to All Journals
          </button>
        </div>
        <JournalEntryForm userId={userId} />
      </div>
    )
  }

  // ==========================================
  // VIEW 2: LIST & MODAL
  // ==========================================
  const showStatusColumn = statusTab !== 'ACTIVE'

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#f9fafb] p-6 lg:px-8 lg:py-8 font-sans text-gray-800 animate-in fade-in duration-300">
      <div className="w-full">
        {/* PAGE HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">All Journals</h1>
          <div className="flex items-center gap-3">
            {exportMsg && (
              <span
                className={`text-xs font-bold ${exportMsg.type === 'success' ? 'text-[#1B9387]' : 'text-red-600'}`}
              >
                {exportMsg.type === 'success' ? '✅ ' : '⚠️ '}
                {exportMsg.msg}
              </span>
            )}
            <button
              onClick={handleExportList}
              disabled={exporting || loading}
              className="px-4 py-2 border border-gray-200 bg-white rounded-md text-gray-700 hover:bg-gray-50 shadow-sm transition flex items-center gap-2 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export the current filtered list as PDF"
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={() => setIsCreatingNew(true)}
              className="bg-[#1B9387] hover:bg-[#15796f] text-white px-4 py-2 rounded-md font-bold text-sm shadow-sm transition flex items-center gap-2 uppercase tracking-wider"
            >
              <Plus size={16} /> New Journal
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-6 border-b border-gray-200 mb-6">
          {['ALL', 'MANUAL', 'SYSTEM'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 text-sm font-bold tracking-wide transition-colors border-b-2 ${activeTab === tab ? 'border-[#1B9387] text-[#1B9387]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'ALL'
                ? 'All Journals'
                : tab === 'MANUAL'
                  ? 'Manual Journals'
                  : 'System Journals'}
            </button>
          ))}
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center mb-6">
          <Search className="text-gray-400 ml-3 mr-2" size={18} />
          <input
            type="text"
            placeholder="Search reference, contact, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent p-2 text-sm outline-none font-medium"
          />
        </div>

        {/* TABLE */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* STATUS FILTER (pills, so it reads as a filter and not a second tab bar) */}
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500">
            <div className="flex gap-2 uppercase tracking-wider">
              {(['ACTIVE', 'DRAFTS', 'VOIDED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusTab(s)}
                  className={`px-3 py-1 rounded-full transition ${statusTab === s ? 'bg-[#1B9387] text-white shadow-sm' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <span>{filteredEntries.length} record(s)</span>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-430px)] min-h-[280px]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-white text-[10px] uppercase font-extrabold text-gray-400 tracking-wider sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 pl-6">Contact</th>
                  <th className="p-4">Reference</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-center">Type</th>
                  {showStatusColumn && <th className="p-4 text-center">Status</th>}
                  <th className="p-4">Description</th>
                  <th className="p-4 text-right pr-6">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={showStatusColumn ? 7 : 6}
                      className="p-12 text-center text-[#1B9387] font-bold animate-pulse"
                    >
                      Loading journals...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showStatusColumn ? 7 : 6}
                      className="p-12 text-center text-gray-400 font-medium"
                    >
                      No journals found.
                    </td>
                  </tr>
                ) : (
                  pagedEntries.map((entry) => {
                    const total = entryTotal(entry)
                    const flagNoContact = !entry.payee?.name && total >= LARGE_AMOUNT_NO_CONTACT
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className="hover:bg-[#E9FAFA]/50 transition cursor-pointer group"
                      >
                        <td className="p-4 pl-6 font-bold text-gray-800">
                          <div className="flex items-center gap-3">
                            {entry.attachments?.length > 0 && (
                              <Paperclip
                                size={14}
                                className="text-gray-300 group-hover:text-[#1B9387] shrink-0"
                              />
                            )}
                            {entry.payee?.name ? (
                              <span className="truncate">{entry.payee.name}</span>
                            ) : flagNoContact ? (
                              <span
                                className="text-amber-600 text-xs font-bold"
                                title="Large entry with no contact tagged"
                              >
                                ⚠ No contact
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-[#1B9387] text-xs">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-gray-400" />
                            {entry.reference_no}
                          </div>
                        </td>
                        <td className="p-4 text-gray-500 font-medium text-xs">
                          {formatDate(entry.date)}
                        </td>
                        <td className="p-4 text-center">{renderTypeBadge(entry.reference_no)}</td>
                        {showStatusColumn && (
                          <td className="p-4 text-center">{renderStatusBadge(entry.status)}</td>
                        )}
                        <td
                          className="p-4 text-gray-500 text-xs max-w-[420px] truncate"
                          title={entry.description}
                        >
                          {entry.description || '—'}
                        </td>
                        <td className="p-4 text-right pr-6 font-mono font-bold text-gray-800">
                          {money(total)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {filteredEntries.length > PAGE_SIZE && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-100 transition"
                >
                  ← Prev
                </button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-100 transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* JOURNAL DETAIL MODAL WITH ATTACHMENTS       */}
      {/* ========================================== */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#f4f7f6] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh]">
            {/* MODAL HEADER */}
            <div className="bg-white p-5 border-b border-gray-200 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  Journal: {selectedEntry.reference_no}
                </h2>
                <div className="mt-2">{renderStatusBadge(selectedEntry.status)}</div>
              </div>
              <div className="flex items-center gap-2">
                {exportMsg && (
                  <span
                    className={`text-xs font-bold ${exportMsg.type === 'success' ? 'text-[#1B9387]' : 'text-red-600'}`}
                  >
                    {exportMsg.msg}
                  </span>
                )}
                <button
                  onClick={() => handleExportSingle(selectedEntry)}
                  disabled={exporting}
                  className="px-3 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                  title="Export this journal as PDF"
                >
                  <Download size={14} /> {exporting ? 'Exporting...' : 'Export PDF'}
                </button>
                <button
                  onClick={() => {
                    setSelectedEntry(null)
                    setExportMsg(null)
                  }}
                  className="p-2 border border-transparent rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* MODAL BODY (SCROLLABLE) */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* CARD 1: TOP SUMMARY */}
              <div className="flex gap-6">
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-4 gap-4 shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Type
                    </p>
                    <p className="font-bold text-sm text-gray-800">
                      {isManualRef(selectedEntry.reference_no)
                        ? 'Manual Journal'
                        : 'System Journal'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Contact
                    </p>
                    <p className="font-bold text-sm text-[#1B9387]">
                      {selectedEntry.payee?.name || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Status
                    </p>
                    <p className="font-bold text-sm text-gray-800">
                      {statusLabel(selectedEntry.status)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Date
                    </p>
                    <p className="font-bold text-sm text-gray-800">
                      {formatDate(selectedEntry.date)}
                    </p>
                  </div>
                </div>

                <div className="w-64 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center items-end shadow-sm border-l-4 border-l-[#1B9387]">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Total (PHP)
                  </p>
                  <p className="text-3xl font-black font-mono text-gray-900">
                    {money(entryTotal(selectedEntry))}
                  </p>
                </div>
              </div>

              {/* CARD 2: JOURNAL LINES TABLE */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-extrabold text-gray-500 tracking-wider">
                    <tr>
                      <th className="p-4">Account</th>
                      <th className="p-4">Description</th>
                      <th className="p-4 text-right">Debit (PHP)</th>
                      <th className="p-4 text-right">Credit (PHP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedEntry.lines?.map((line: any) => (
                      <tr key={line.id}>
                        <td className="p-4 font-bold text-gray-800">
                          <span className="font-mono text-[#1B9387] mr-2">
                            {line.account?.code}
                          </span>
                          {line.account?.name}
                        </td>
                        <td className="p-4 text-gray-500">-</td>
                        <td className="p-4 text-right font-mono text-gray-800">
                          {money(Number(line.debit))}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-800">
                          {money(Number(line.credit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CARD 3 & 4: NOTES AND TOTALS */}
              <div className="flex gap-6 items-start">
                <div className="flex-1 space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Internal Notes
                    </p>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 min-h-[80px] shadow-sm">
                      {selectedEntry.description || (
                        <span className="text-gray-400 italic">No notes provided.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Paperclip size={12} /> Attachments ({selectedEntry.attachments?.length || 0})
                    </p>
                    <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 shadow-sm min-h-[100px] flex flex-col gap-3">
                      {selectedEntry.attachments && selectedEntry.attachments.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {selectedEntry.attachments.map((att: any) => (
                            <a
                              key={att.id}
                              href={att.fileData}
                              download={att.fileName}
                              className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-[#E9FAFA] hover:border-[#1B9387] transition cursor-pointer group text-center"
                            >
                              {att.fileType.includes('image') ? (
                                <ImageIcon
                                  size={24}
                                  className="text-[#1B9387] mb-2 group-hover:scale-110 transition-transform"
                                />
                              ) : (
                                <FileIcon
                                  size={24}
                                  className="text-[#1B9387] mb-2 group-hover:scale-110 transition-transform"
                                />
                              )}
                              <span
                                className="text-xs font-bold text-gray-700 truncate w-full px-2"
                                title={att.fileName}
                              >
                                {att.fileName}
                              </span>
                              <span className="text-[9px] text-gray-400 font-mono mt-1 uppercase tracking-wider">
                                Click to Download
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 py-4">
                          <span className="text-xs font-medium">No attachments uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* TOTAL SUMMARY */}
                <div className="w-80 bg-gray-200 rounded-xl p-5 shrink-0">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    <span></span>
                    <div className="flex gap-8 text-right">
                      <span className="w-24">Debit (PHP)</span>
                      <span className="w-24">Credit (PHP)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                    <span className="text-sm font-black text-gray-800">Journal Amount</span>
                    <div className="flex gap-8 text-right font-mono font-black text-gray-900 text-base">
                      <span className="w-24">{money(entryTotal(selectedEntry))}</span>
                      <span className="w-24">
                        {money(
                          selectedEntry.lines?.reduce(
                            (s: number, l: any) => s + Number(l.credit),
                            0
                          ) || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
