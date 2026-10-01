// src/renderer/src/components/JournalManagementView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Search,
  Download,
  Plus,
  FileText,
  Paperclip
} from 'lucide-react'
import { JournalEntryForm } from './JournalEntryForm'
import { JournalEntryModal } from './JournalEntryModal'
import { cleanDescription } from '../utils/formatters'

export function JournalManagementView({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Top Tabs (All, Manual, System)
  const [activeTab, setActiveTab] = useState<'ALL' | 'MANUAL' | 'SYSTEM'>('ALL')

  // 🔥 NEW: Sub-Tabs for Status (Active, Drafts, Voided)
  const [statusTab, setStatusTab] = useState<'ACTIVE' | 'DRAFTS' | 'VOIDED'>('ACTIVE')

  const [searchQuery, setSearchQuery] = useState('')

  // View States
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null)

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
    if (!isCreatingNew) {
      fetchEntries()
    }
  }, [isCreatingNew])

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Helper to render the correct badge colors based on status
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
    // Covers DRAFT or PENDING_VOID
    return (
      <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
        {status.replace('_', ' ')}
      </span>
    )
  }

  // Filter Logic
  const filteredEntries = entries.filter((entry) => {
    // 1. Search
    const searchStr = searchQuery.toLowerCase()
    const matchesSearch =
      entry.reference_no?.toLowerCase().includes(searchStr) ||
      entry.payee?.name?.toLowerCase().includes(searchStr) ||
      entry.description?.toLowerCase().includes(searchStr)

    if (!matchesSearch) return false

    // 2. Top Tabs (Manual vs System)
    const isManual = entry.reference_no.startsWith('JV-') || entry.reference_no.startsWith('ADJ-')
    if (activeTab === 'MANUAL' && !isManual) return false
    if (activeTab === 'SYSTEM' && isManual) return false

    // 3. 🔥 NEW: Status Sub-Tabs
    if (statusTab === 'ACTIVE' && entry.status !== 'ACTIVE') return false
    if (statusTab === 'VOIDED' && entry.status !== 'VOIDED') return false
    if (statusTab === 'DRAFTS' && entry.status !== 'DRAFT' && entry.status !== 'PENDING_VOID')
      return false

    return true
  })

  // ==========================================
  // VIEW 1: CREATION FORM
  // ==========================================
  if (isCreatingNew) {
    return (
      <div className="w-full min-h-[calc(100vh-64px)] p-6 bg-[#f9fafb]">
        <div className="max-w-4xl mx-auto mb-4">
          <button
            onClick={() => setIsCreatingNew(false)}
            className="text-gray-500 hover:text-[#1B9387] font-bold text-sm transition flex items-center gap-2"
          >
            ← Back to All Journals
          </button>
        </div>
        <JournalEntryForm userId={userId} isAdjusting={false} />
      </div>
    )
  }

  // ==========================================
  // VIEW 2: LIST & MODAL
  // ==========================================
  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#f9fafb] p-6 lg:p-10 font-sans text-gray-800 animate-in fade-in duration-300">
      <div className="max-w-[1600px] mx-auto">
        {/* PAGE HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">All Journals</h1>
          <div className="flex items-center gap-3">
            <button className="p-2 border border-gray-200 bg-white rounded-md text-gray-500 hover:bg-gray-50 shadow-sm transition">
              <Download size={18} />
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
          {/* 🔥 UPDATED: SUB-TABS (ACTIVE, DRAFTS, VOIDED) */}
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500">
            <div className="flex gap-4 uppercase tracking-wider">
              <button
                onClick={() => setStatusTab('ACTIVE')}
                className={`transition pb-1 ${statusTab === 'ACTIVE' ? 'text-gray-800 border-b-2 border-gray-400' : 'hover:text-gray-800'}`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusTab('DRAFTS')}
                className={`transition pb-1 ${statusTab === 'DRAFTS' ? 'text-gray-800 border-b-2 border-gray-400' : 'hover:text-gray-800'}`}
              >
                Drafts
              </button>
              <button
                onClick={() => setStatusTab('VOIDED')}
                className={`transition pb-1 ${statusTab === 'VOIDED' ? 'text-gray-800 border-b-2 border-gray-400' : 'hover:text-gray-800'}`}
              >
                Voided
              </button>
            </div>
            <span className="capitalize">
              {statusTab.toLowerCase()}: {filteredEntries.length} record(s)
            </span>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-white text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">
              <tr>
                <th className="p-4 pl-6">Contact</th>
                <th className="p-4">Reference</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Debit</th>
                <th className="p-4 text-right pr-6">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-12 text-center text-[#1B9387] font-bold animate-pulse"
                  >
                    Loading journals...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 font-medium">
                    No journals found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  // Calculate Total Debit for display
                  const totalDebit =
                    entry.lines?.reduce((sum: number, l: any) => sum + Number(l.debit), 0) || 0

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
                          <span className="truncate">{entry.payee?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-[#1B9387] text-xs">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-gray-400" />
                          {entry.reference_no}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 font-medium text-xs">
                        {new Date(entry.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-4 text-center">
                        {/* 🔥 UPDATED: Uses dynamic badge logic */}
                        {renderStatusBadge(entry.status)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-gray-800">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="p-4 text-right pr-6 font-mono font-bold text-gray-800">
                        {formatCurrency(totalDebit)}{' '}
                        <span className="text-[9px] text-gray-400 font-sans ml-1">PHP</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEntry && (
        <JournalEntryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onVoidSuccess={fetchEntries}
        />
      )}
    </div>
  )
}
