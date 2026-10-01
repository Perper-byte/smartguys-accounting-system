// src/renderer/src/components/JournalEntryModal.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Download,
  X,
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
  AlertTriangle,
  RefreshCw,
  Printer
} from 'lucide-react'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'
import { cleanDescription } from '../utils/formatters'

interface JournalEntryModalProps {
  entry?: any | null
  entryId?: string | null
  referenceNo?: string | null
  onClose: () => void
  onVoidSuccess?: () => void
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({
  entry: initialEntry,
  entryId,
  referenceNo,
  onClose,
  onVoidSuccess
}) => {
  const [entry, setEntry] = useState<any | null>(initialEntry || null)
  const [loading, setLoading] = useState<boolean>(!initialEntry && !!(entryId || referenceNo))
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null)

  // Void request state
  const [showVoidInput, setShowVoidInput] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (initialEntry) {
      setEntry(initialEntry)
      setLoading(false)
      return
    }

    const targetKey = entryId || referenceNo
    if (!targetKey) return

    let isMounted = true
    setLoading(true)

    const fetchEntry = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        if (api?.getJournalEntryById) {
          const res = await api.getJournalEntryById(targetKey)
          if (isMounted) {
            setEntry(res)
          }
        }
      } catch (err) {
        console.error('Failed to load journal entry:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchEntry()

    return () => {
      isMounted = false
    }
  }, [initialEntry, entryId, referenceNo])

  const formatCurrency = (amount: number) => {
    return Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const renderStatusBadge = (statusStr: string) => {
    if (statusStr === 'ACTIVE') {
      return (
        <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-200">
          Recorded
        </span>
      )
    }
    if (statusStr === 'VOIDED') {
      return (
        <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-red-50 text-red-600 border-red-200">
          Voided
        </span>
      )
    }
    return (
      <span className="px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
        {(statusStr || 'RECORDED').replace('_', ' ')}
      </span>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const submitVoidRequest = async () => {
    if (!voidReason.trim() || !entry?.id) {
      setStatusMsg({ type: 'error', text: 'Reason required for void request.' })
      return
    }

    setVoiding(true)
    setStatusMsg(null)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const res = await api.requestVoid(entry.id, voidReason)
      if (res?.success || !res?.error) {
        setStatusMsg({
          type: 'success',
          text: `Void request submitted for ${entry.reference_no}! Manager approval needed.`
        })
        setEntry((prev: any) => (prev ? { ...prev, status: 'PENDING_VOID' } : prev))
        setShowVoidInput(false)
        setVoidReason('')
        if (onVoidSuccess) onVoidSuccess()
      } else {
        setStatusMsg({ type: 'error', text: res?.error || 'Failed to submit void request.' })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'System error submitting void request.' })
    } finally {
      setVoiding(false)
    }
  }

  const totalDebit =
    entry?.lines?.reduce((sum: number, l: any) => sum + Number(l.debit || 0), 0) || 0
  const totalCredit =
    entry?.lines?.reduce((sum: number, l: any) => sum + Number(l.credit || 0), 0) || 0

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#f4f7f6] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh]">
          {/* MODAL HEADER */}
          <div className="bg-white p-5 border-b border-gray-200 flex justify-between items-start shrink-0">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                Journal: {entry?.reference_no || referenceNo || 'Loading...'}
              </h2>
              <div className="mt-2">
                {entry ? renderStatusBadge(entry.status) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="p-2 border border-gray-200 rounded text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                title="Print Journal Voucher"
              >
                <Printer size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 border border-transparent rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* STATUS NOTIFICATION */}
          {statusMsg && (
            <div
              className={`px-6 py-2.5 text-xs font-bold border-b ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {statusMsg.type === 'success' ? '✓ ' : '⚠️ '}
              {statusMsg.text}
            </div>
          )}

          {/* MODAL BODY (SCROLLABLE) */}
          <div className="p-6 overflow-y-auto space-y-6">
            {loading ? (
              <div className="py-20 text-center text-sm font-bold text-gray-500 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={28} className="animate-spin text-[#1B9387]" />
                <span>Loading Journal Details...</span>
              </div>
            ) : !entry ? (
              <div className="py-20 text-center text-sm font-bold text-gray-400">
                Journal entry details could not be found.
              </div>
            ) : (
              <>
                {/* CARD 1: TOP SUMMARY */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Type
                      </p>
                      <p className="font-bold text-sm text-gray-800">
                        {entry.reference_no?.startsWith('JV') || entry.reference_no?.startsWith('ADJ')
                          ? 'Manual Journal'
                          : 'System Journal'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Contact
                      </p>
                      <p className="font-bold text-sm text-[#1B9387] underline decoration-[#1B9387]/30 underline-offset-4 truncate">
                        {entry.payee?.name || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Status
                      </p>
                      <p className="font-bold text-sm text-gray-800">
                        {entry.status === 'ACTIVE'
                          ? 'Recorded'
                          : (entry.status || 'RECORDED').replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Date
                      </p>
                      <p className="font-bold text-sm text-gray-800">
                        {entry.date
                          ? new Date(entry.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="sm:w-64 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center items-end shadow-sm border-l-4 border-l-[#1B9387]">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Total (PHP)
                    </p>
                    <p className="text-3xl font-black font-mono text-gray-900">
                      {formatCurrency(totalDebit)}
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
                      {entry.lines?.map((line: any) => (
                        <tr key={line.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 font-bold text-gray-800">
                            <span className="font-mono text-[#1B9387] mr-2">
                              {line.account?.code}
                            </span>
                            {line.account?.name}
                          </td>
                          <td className="p-4 text-gray-500">
                            {line.description ? cleanDescription(line.description) : '-'}
                          </td>
                          <td className="p-4 text-right font-mono text-gray-800">
                            {formatCurrency(Number(line.debit))}
                          </td>
                          <td className="p-4 text-right font-mono text-gray-800">
                            {formatCurrency(Number(line.credit))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CARD 3 & 4: NOTES, ATTACHMENTS AND TOTALS */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="flex-1 w-full space-y-6">
                    {/* INTERNAL NOTES */}
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Internal Notes
                      </p>
                      <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 min-h-[80px] shadow-sm">
                        {cleanDescription(entry.description) || (
                          <span className="text-gray-400 italic">No notes provided.</span>
                        )}
                      </div>
                    </div>

                    {/* ATTACHMENTS VIEW ZONE */}
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Paperclip size={12} /> Attachments ({entry.attachments?.length || 0})
                      </p>

                      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 shadow-sm min-h-[100px] flex flex-col gap-3">
                        {entry.attachments && entry.attachments.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {entry.attachments.map((att: any) => (
                              <div
                                key={att.id}
                                onClick={() => {
                                  setPreviewAttachment({
                                    id: att.id,
                                    entryId: entry.id,
                                    name: att.fileName,
                                    data: att.fileData,
                                    type: att.fileType
                                  })
                                }}
                                className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-[#E9FAFA] hover:border-[#1B9387] transition cursor-pointer group text-center"
                              >
                                {att.fileType?.includes('image') ? (
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
                                <span className="text-[9px] text-[#1B9387] font-extrabold mt-1 uppercase tracking-wider">
                                  Click to Preview
                                </span>
                              </div>
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
                  <div className="w-full lg:w-80 bg-gray-200 rounded-xl p-5 shrink-0">
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
                        <span className="w-24">{formatCurrency(totalDebit)}</span>
                        <span className="w-24">{formatCurrency(totalCredit)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VOID REQUEST ACTION (Preserved from General Ledger) */}
                {(!entry.status || entry.status === 'ACTIVE') && (
                  <div className="pt-4 border-t border-gray-200">
                    {!showVoidInput ? (
                      <button
                        type="button"
                        onClick={() => setShowVoidInput(true)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md text-xs font-bold transition-colors cursor-pointer uppercase tracking-wider shadow-xs flex items-center gap-1.5"
                      >
                        <AlertTriangle size={14} />
                        Request Void
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Reason for requesting void..."
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          className="flex-1 bg-white border border-red-300 rounded px-3 py-1.5 text-xs text-gray-800 font-medium outline-none focus:border-red-500"
                        />
                        <button
                          type="button"
                          onClick={submitVoidRequest}
                          disabled={voiding}
                          className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer shadow-xs whitespace-nowrap"
                        >
                          {voiding ? 'Submitting...' : 'Submit Request'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowVoidInput(false)}
                          className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-xs font-bold cursor-pointer shadow-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </>
  )
}
