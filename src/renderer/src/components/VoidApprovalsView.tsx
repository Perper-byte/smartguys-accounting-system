import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  RefreshCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  XCircle,
  Search,
  Clock3,
  FileSignature,
  Inbox
} from 'lucide-react'

type ViewMode = 'PENDING' | 'HISTORY'

export function VoidApprovalsView({ userId }: { userId: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>('PENDING')
  const [voids, setVoids] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Copy-to-clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Toast and Custom Modal States
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: 'APPROVE' | 'REJECT' | null
    id: string | null
  }>({
    isOpen: false,
    action: null,
    id: null
  })

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchVoids = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const data = await api.getPendingVoids()
      setVoids(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      // Expects an IPC handler returning voids with status APPROVED/REJECTED,
      // including `status`, `approver` (or `approved_by`), and `decided_at`.
      const data = api.getVoidHistory ? await api.getVoidHistory() : []
      setHistory(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const refresh = () => (viewMode === 'PENDING' ? fetchVoids() : fetchHistory())

  // Initial Fetch + refetch on tab switch
  useEffect(() => {
    refresh()
  }, [viewMode])

  // Opens the custom modal
  const initiateAction = (id: string, action: 'APPROVE' | 'REJECT') => {
    setConfirmDialog({ isOpen: true, action, id })
    setToast(null) // Clear previous alerts
  }

  // Executes the action
  const executeAction = async () => {
    if (!confirmDialog.id || !confirmDialog.action) return

    try {
      const api = (window as any).api || (window as any).electronAPI
      if (confirmDialog.action === 'APPROVE') {
        await api.approveVoid(confirmDialog.id, userId)
      } else {
        await api.rejectVoid(confirmDialog.id)
      }

      fetchVoids() // Refresh pending list automatically
      showToast(`Void request ${confirmDialog.action.toLowerCase()}d successfully.`, 'success')
    } catch (error) {
      console.error(error)
      showToast('Action failed. See console for details.', 'error')
    } finally {
      setConfirmDialog({ isOpen: false, action: null, id: null })
    }
  }

  // Helper to copy reference numbers
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000) // Reset icon after 2s
  }

  const activeRows = viewMode === 'PENDING' ? voids : history

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return activeRows
    return activeRows.filter((v) => {
      const requester = v.user?.username || ''
      const decider = v.approver?.username || v.approved_by || ''
      return (
        (v.reference_no || '').toLowerCase().includes(q) ||
        requester.toLowerCase().includes(q) ||
        decider.toLowerCase().includes(q) ||
        (v.void_reason || '').toLowerCase().includes(q)
      )
    })
  }, [activeRows, searchQuery])

  return (
    <div className="w-full h-full flex flex-col p-4 lg:p-6 bg-gray-50/50 min-h-0 relative">
      {/* TOAST ALERTS */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 p-4 rounded-md shadow-lg text-white z-50 flex items-center space-x-3 animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-[#1B9387]' : 'bg-red-700'}`}
        >
          {toast.type === 'error' && <AlertTriangle size={20} />}
          {toast.type === 'success' && <CheckCircle2 size={20} />}
          <span className="whitespace-pre-line text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="w-full h-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex flex-col overflow-hidden min-h-0">
        {/* HEADER & CONTROLS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-5 p-6 border-b border-[#B0DCDA] shrink-0 bg-white z-10">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide flex items-center gap-2">
                <FileSignature size={24} className="text-[#1B9387]" /> Void Approvals
              </h2>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                Review and approve transaction cancellations requested by staff.
              </p>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner w-fit">
              <button
                onClick={() => {
                  setViewMode('PENDING')
                  setSearchQuery('')
                }}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${
                  viewMode === 'PENDING'
                    ? 'bg-[#1B9387] text-white shadow-md'
                    : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
                }`}
              >
                Pending ({voids.length})
              </button>
              <button
                onClick={() => {
                  setViewMode('HISTORY')
                  setSearchQuery('')
                }}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${
                  viewMode === 'HISTORY'
                    ? 'bg-[#1B9387] text-white shadow-md'
                    : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
                }`}
              >
                History ({history.length})
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end w-full xl:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference, staff, or reason..."
                className="w-full pl-9 pr-3 py-2 h-10 text-sm bg-[#FBF8F8] border border-[#B0DCDA] rounded-md focus:outline-none focus:border-[#1B9387] font-medium transition-colors placeholder:text-gray-400 shadow-sm"
              />
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-5 py-2 h-10 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              <span>Refresh List</span>
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="flex-1 overflow-y-auto bg-white">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr>
                <th className="p-4 pl-6 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  Date & Time
                </th>
                <th className="p-4 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  Reference
                </th>
                <th className="p-4 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  Requested By
                </th>
                <th className="p-4 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  Reason for Void
                </th>
                {viewMode === 'PENDING' ? (
                  <>
                    <th className="p-4 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 text-center">
                      Status
                    </th>
                    <th className="p-4 pr-6 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 text-right">
                      Action
                    </th>
                  </>
                ) : (
                  <>
                    <th className="p-4 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                      Decided By
                    </th>
                    <th className="p-4 pr-6 text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 text-center">
                      Status
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-gray-400 bg-gray-50/30">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="h-10 w-10 rounded-full border-4 border-[#E9FAFA] border-t-[#1B9387] animate-spin" />
                      <span className="font-bold text-gray-800">Loading void requests...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center bg-gray-50/30">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      {searchQuery ? (
                        <Search size={48} className="mb-4 opacity-30 text-[#1B9387]" />
                      ) : viewMode === 'PENDING' ? (
                        <CheckCircle2 size={48} className="mb-4 opacity-40 text-[#1B9387]" />
                      ) : (
                        <Inbox size={48} className="mb-4 opacity-30 text-[#1B9387]" />
                      )}
                      <span className="font-extrabold text-gray-700 text-lg">
                        {searchQuery
                          ? 'No matches found'
                          : viewMode === 'PENDING'
                            ? 'All caught up!'
                            : 'No history yet'}
                      </span>
                      <span className="text-sm text-gray-500 mt-2 max-w-sm font-medium">
                        {searchQuery
                          ? `Nothing matches "${searchQuery}". Try a different reference, staff name, or reason.`
                          : viewMode === 'PENDING'
                            ? 'No pending void requests at the moment. Staff can request voids from any transaction screen.'
                            : 'Approved and rejected void requests will appear here once a decision is made.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : viewMode === 'PENDING' ? (
                filteredRows.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors even:bg-gray-50/30">
                    <td className="p-4 pl-6 text-gray-500 font-medium tabular-nums">
                      {new Date(v.date).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleCopy(v.reference_no, v.id)}
                        className="flex items-center space-x-2 font-mono text-gray-800 font-bold hover:text-[#1B9387] transition-colors group"
                        title="Click to copy"
                      >
                        <span>{v.reference_no}</span>
                        {copiedId === v.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>
                    <td className="p-4 text-gray-800 font-bold">
                      {v.user?.username || 'Unknown User'}
                    </td>
                    <td className="p-4 text-red-600 font-medium italic">"{v.void_reason}"</td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
                        <Clock3 className="w-3 h-3" /> Awaiting Approval
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => initiateAction(v.id, 'APPROVE')}
                        className="bg-[#1B9387] hover:bg-[#157A70] text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors shadow-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => initiateAction(v.id, 'REJECT')}
                        className="bg-white hover:bg-red-50 border border-gray-300 hover:border-red-200 text-gray-700 hover:text-red-700 px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors shadow-sm"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                filteredRows.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors even:bg-gray-50/30">
                    <td className="p-4 pl-6 text-gray-500 font-medium tabular-nums">
                      {new Date(v.date).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleCopy(v.reference_no, v.id)}
                        className="flex items-center space-x-2 font-mono text-gray-800 font-bold hover:text-[#1B9387] transition-colors group"
                        title="Click to copy"
                      >
                        <span>{v.reference_no}</span>
                        {copiedId === v.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>
                    <td className="p-4 text-gray-800 font-bold">
                      {v.user?.username || 'Unknown User'}
                    </td>
                    <td className="p-4 text-red-600 font-medium italic">"{v.void_reason}"</td>
                    <td className="p-4 text-gray-800 font-bold">
                      {v.approver?.username || v.approved_by || '—'}
                      {v.decided_at && (
                        <span className="block text-[10px] text-gray-500 font-medium tracking-wider mt-0.5 tabular-nums uppercase">
                          {new Date(v.decided_at).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-center">
                      {v.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase bg-rose-50 text-rose-700 border-rose-200">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-6 w-[420px] animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div
                className={`p-2 rounded-full ${confirmDialog.action === 'APPROVE' ? 'bg-[#E9FAFA]' : 'bg-red-100'}`}
              >
                <AlertTriangle
                  className={`w-6 h-6 ${confirmDialog.action === 'APPROVE' ? 'text-[#1B9387]' : 'text-red-600'}`}
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                Confirm Action
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed font-medium">
              Are you sure you want to{' '}
              <strong
                className={confirmDialog.action === 'APPROVE' ? 'text-[#1B9387]' : 'text-red-600'}
              >
                {confirmDialog.action?.toLowerCase()}
              </strong>{' '}
              this void request?
              {confirmDialog.action === 'APPROVE' &&
                ' This will permanently generate a reversing entry in the ledger.'}
            </p>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
                className="px-5 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs tracking-wider uppercase font-bold transition-colors cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className={`px-5 py-2.5 text-white rounded-md text-xs tracking-wider uppercase font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-2 ${
                  confirmDialog.action === 'APPROVE'
                    ? 'bg-[#1B9387] hover:bg-[#157A70]'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmDialog.action === 'APPROVE' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                <span>Yes, {confirmDialog.action === 'APPROVE' ? 'Approve' : 'Reject'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
