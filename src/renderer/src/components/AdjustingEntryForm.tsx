// src/renderer/src/components/AdjustingEntryForm.tsx
import * as React from 'react'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { NewContactModal } from './NewContactModal'
import {
  UploadCloud,
  File as FileIcon,
  X,
  Image as ImageIcon,
  Lock,
  RefreshCw,
  Search,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Undo2,
  Copy,
  Scale
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const ADJ_PREFIX = 'ADJ-'
const ADJ_TYPES = ['Correction', 'Accrual', 'Deferral', 'Depreciation', 'Reclassification', 'Other']
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'zip', 'xlsx']
const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024
const MIN_REASON_LENGTH = 10

// NOTE: this file deliberately avoids `text-white` on anything except the
// bg-[#1B9387] buttons, and avoids `text-red-600`, because main.css has
// #app-main overrides that recolor both.

const getApi = () => (window as any).api || (window as any).electronAPI

const getLocalDateString = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const toCents = (s: string) => Math.round((parseFloat(s) || 0) * 100)

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`

type Line = { key: string; accountId: string; debit: string; credit: string }
let lineSeq = 0
const newLine = (): Line => ({ key: `line-${++lineSeq}`, accountId: '', debit: '', credit: '' })
const emptyLines = (): Line[] => [newLine(), newLine()]

const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2'
const fieldCls =
  'w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition placeholder:text-gray-500'

/* ------------------------------------------------------------------ */
/* Account combobox (keyboard accessible)                              */
/* ------------------------------------------------------------------ */

const AccountCombobox: React.FC<{
  id: string
  value: string
  accounts: any[]
  invalid?: boolean
  onSelect: (code: string) => void
}> = ({ id, value, accounts, invalid, onSelect }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = accounts.find((a) => a.code === value)
  const display = value ? `${value}  ${selected?.name ?? ''}` : ''

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts
      .filter((a) => a && a.name && (!q || `${a.code} ${a.name}`.toLowerCase().includes(q)))
      .slice(0, 50)
  }, [accounts, query])

  useEffect(() => setHi(0), [query])
  useEffect(() => {
    if (open)
      (listRef.current?.children[hi] as HTMLElement | undefined)?.scrollIntoView({
        block: 'nearest'
      })
  }, [hi, open])

  const pick = (a: any) => {
    onSelect(a.code)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHi((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && open && matches[hi]) {
      e.preventDefault()
      pick(matches[hi])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && matches[hi] ? `${id}-opt-${matches[hi].code}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        value={open ? query : display}
        placeholder="Search account code or name"
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={`w-full min-h-[44px] bg-transparent px-5 text-sm font-medium text-gray-800 outline-none placeholder:text-gray-500 focus:bg-[#E9FAFA] transition ${invalid ? 'bg-amber-50' : ''}`}
      />
      {open && (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 top-full min-w-[380px] w-full max-h-56 overflow-y-auto bg-white border border-[#1B9387] rounded-md shadow-xl"
        >
          {matches.length === 0 && (
            <li className="p-3 text-sm text-gray-500">No account matches “{query}”.</li>
          )}
          {matches.map((a, i) => (
            <li
              key={a.code}
              id={`${id}-opt-${a.code}`}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(a)
              }}
              onMouseEnter={() => setHi(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer flex items-center border-b border-gray-50 last:border-0 ${i === hi ? 'bg-[#E9FAFA] text-[#1B9387]' : 'text-gray-700'}`}
            >
              <span className="font-mono font-bold text-[#1B9387] w-14 shrink-0">{a.code}</span>
              <span className="font-medium">{a.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main form                                                           */
/* ------------------------------------------------------------------ */

export const AdjustingEntryForm: React.FC<{
  userId: string
  onNavigate?: (tabId: string) => void
}> = ({ userId, onNavigate }) => {
  // Reference data
  const [accounts, setAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])
  const [lockDate, setLockDate] = useState<string | null>(null)

  // Entry header
  const [date, setDate] = useState(getLocalDateString())
  const [refSequence, setRefSequence] = useState('')
  const [vatType, setVatType] = useState('EXEMPT')
  const [adjType, setAdjType] = useState('Correction')
  const [description, setDescription] = useState('')
  const [payeeId, setPayeeId] = useState('')
  const [overridePin, setOverridePin] = useState('')

  // "Entry being corrected" picker
  const [correctsEntry, setCorrectsEntry] = useState<any | null>(null)
  const [isRefOpen, setIsRefOpen] = useState(false)
  const [refQuery, setRefQuery] = useState('')
  const [refResults, setRefResults] = useState<any[]>([])
  const [refLoading, setRefLoading] = useState(false)
  const fallbackCache = useRef<any[] | null>(null)

  // Contact picker
  const [isPayeeOpen, setIsPayeeOpen] = useState(false)
  const [payeeQuery, setPayeeQuery] = useState('')
  const [payeeBalance, setPayeeBalance] = useState<{ receivable: number; payable: number } | null>(
    null
  )
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const payeeBoxRef = useRef<HTMLDivElement>(null)

  // Lines & attachments
  const [lines, setLines] = useState<Line[]>(emptyLines())
  const [attachments, setAttachments] = useState<File[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    msg: string
    ref?: string
  } | null>(null)

  /* ---------------------------- data loading ---------------------------- */

  const fetchNextSequence = useCallback(async () => {
    try {
      const next = await getApi().getNextSequence(ADJ_PREFIX)
      setRefSequence(String(next))
    } catch (err) {
      console.error('Failed to fetch next sequence', err)
    }
  }, [])

  useEffect(() => {
    const api = getApi()
    if (!api) return
    api
      .getAccounts?.()
      .then((r: any) => setAccounts(Array.isArray(r) ? r : []))
      .catch(() => setAccounts([]))
    api
      .getPayees?.()
      .then((r: any) => setPayees(Array.isArray(r) ? r : []))
      .catch(() => setPayees([]))
    api
      .getLockDate?.()
      .then((r: any) => r?.lockDate && setLockDate(String(r.lockDate).split('T')[0]))
      .catch(console.error)
    fetchNextSequence()
  }, [fetchNextSequence])

  // Debounced search for the entry being corrected.
  // Uses api.searchJournalEntries when wired; otherwise falls back to the
  // old getAllJournalEntries (loaded once, filtered client-side).
  useEffect(() => {
    if (!isRefOpen) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setRefLoading(true)
      try {
        const api = getApi()
        const q = refQuery.trim().toLowerCase()
        let rows: any[] = []
        if (api?.searchJournalEntries) {
          rows = await api.searchJournalEntries(refQuery.trim(), 15)
        } else if (api?.getAllJournalEntries) {
          if (!fallbackCache.current) fallbackCache.current = await api.getAllJournalEntries()
          rows = (fallbackCache.current || [])
            .filter(
              (e: any) =>
                e &&
                e.status === 'ACTIVE' &&
                !String(e.reference_no).startsWith('RVS-') &&
                (!q ||
                  String(e.reference_no).toLowerCase().includes(q) ||
                  String(e.description || '')
                    .toLowerCase()
                    .includes(q))
            )
            .slice(0, 15)
        }
        if (!cancelled) setRefResults(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setRefResults([])
      } finally {
        if (!cancelled) setRefLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [refQuery, isRefOpen])

  useEffect(() => {
    if (!payeeId) return setPayeeBalance(null)
    getApi()
      ?.getPayeeBalance?.(payeeId)
      .then(setPayeeBalance)
      .catch(() => setPayeeBalance(null))
  }, [payeeId])

  // Close contact dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (payeeBoxRef.current && !payeeBoxRef.current.contains(e.target as Node))
        setIsPayeeOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirmOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  /* ------------------------------ derived ------------------------------- */

  const hasAmount = (l: Line) => toCents(l.debit) > 0 || toCents(l.credit) > 0
  const postable = lines.filter((l) => l.accountId && hasAmount(l))
  const orphanCount = lines.filter((l) => !l.accountId && hasAmount(l)).length
  const debitCents = postable.reduce((s, l) => s + toCents(l.debit), 0)
  const creditCents = postable.reduce((s, l) => s + toCents(l.credit), 0)
  const diffCents = Math.abs(debitCents - creditCents)
  const isBalanced = postable.length >= 2 && debitCents > 0 && debitCents === creditCents

  const isLocked = !!lockDate && !!date && date <= lockDate
  const usesArAp = postable.some((l) => l.accountId === '1200' || l.accountId === '2010')
  const reason = description.trim()

  const blocker: string | null = !refSequence
    ? 'Enter an adjusting entry number'
    : !date
      ? 'Choose a date'
      : orphanCount > 0
        ? `${orphanCount} line${orphanCount > 1 ? 's have' : ' has'} an amount but no account`
        : postable.length < 2
          ? 'Add at least two lines with accounts'
          : !isBalanced
            ? `Out of balance by ₱ ${fmt(diffCents / 100)}`
            : reason.length < MIN_REASON_LENGTH
              ? 'Add a reason for the adjustment'
              : isLocked && !overridePin.trim()
                ? 'Enter the override PIN'
                : null

  const selectedPayee = payees.find((p) => p.id === payeeId)
  const filteredPayees = payees.filter(
    (p) => p && p.name && String(p.name).toLowerCase().includes(payeeQuery.toLowerCase())
  )
  const accountName = (code: string) => accounts.find((a) => a.code === code)?.name ?? ''

  const isDirty =
    !!reason ||
    !!correctsEntry ||
    !!payeeId ||
    attachments.length > 0 ||
    lines.some((l) => l.accountId || hasAmount(l))

  /* ------------------------------ line actions -------------------------- */

  const setAccount = (key: string, accountId: string) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, accountId } : l)))

  const setAmount = (key: string, field: 'debit' | 'credit', raw: string) => {
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return
    const other = field === 'debit' ? 'credit' : 'debit'
    setLines((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, [field]: raw, ...(toCents(raw) > 0 ? { [other]: '' } : {}) } : l
      )
    )
  }

  const formatAmount = (key: string, field: 'debit' | 'credit') =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key || l[field] === '') return l
        const n = parseFloat(l[field])
        return { ...l, [field]: n > 0 ? n.toFixed(2) : '' }
      })
    )

  const addLine = () => setLines((prev) => [...prev, newLine()])
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)))

  const balanceWithDifference = () => {
    if (diffCents === 0 || postable.length === 0) return
    const field: 'debit' | 'credit' = debitCents > creditCents ? 'credit' : 'debit'
    const amount = (diffCents / 100).toFixed(2)
    setLines((prev) => {
      const idx = prev.findIndex((l) => !hasAmount(l))
      if (idx === -1) return [...prev, { ...newLine(), [field]: amount } as Line]
      return prev.map((l, i) => (i === idx ? ({ ...l, [field]: amount } as Line) : l))
    })
  }

  /* --------------------------- original entry --------------------------- */

  const selectOriginal = (entry: any) => {
    setCorrectsEntry(entry)
    setIsRefOpen(false)
    setRefQuery('')
    if (entry.vat_type) setVatType(entry.vat_type)
    const pid = entry.payee_id ?? entry.payeeId ?? entry.payee?.id
    if (pid) setPayeeId(pid)
  }

  const applyOriginalLines = (mode: 'reverse' | 'copy') => {
    const src: any[] = correctsEntry?.lines ?? []
    const next: Line[] = src
      .map((l) => {
        const d = Number(l.debit) || 0
        const c = Number(l.credit) || 0
        const [nd, nc] = mode === 'reverse' ? [c, d] : [d, c]
        return {
          key: newLine().key,
          accountId: l.account_id ?? l.accountId ?? l.account?.code ?? '',
          debit: nd > 0 ? nd.toFixed(2) : '',
          credit: nc > 0 ? nc.toFixed(2) : ''
        }
      })
      .filter((l) => l.accountId || l.debit || l.credit)
    while (next.length < 2) next.push(newLine())
    setLines(next)
  }

  /* ------------------------------ attachments --------------------------- */

  const handleFilesAdded = (files: File[]) => {
    const problems: string[] = []
    const valid = files.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.includes(ext)) {
        problems.push(`${f.name}: unsupported type`)
        return false
      }
      if (f.size > MAX_BYTES) {
        problems.push(`${f.name}: larger than 10 MB`)
        return false
      }
      return true
    })
    const room = MAX_FILES - attachments.length
    if (valid.length > room) {
      problems.push(`Only ${MAX_FILES} attachments per entry. ${valid.length - room} not added.`)
    }
    setAttachments((prev) => [...prev, ...valid.slice(0, Math.max(room, 0))])
    setAttachError(problems.length ? problems.join(' · ') : null)
  }

  const processAttachments = () =>
    Promise.all(
      attachments.map(
        (file) =>
          new Promise<{
            name: string
            type: string
            size: number
            data: string | ArrayBuffer | null
          }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () =>
              resolve({ name: file.name, type: file.type, size: file.size, data: reader.result })
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    )

  /* ------------------------------ submit / reset ------------------------ */

  const resetForm = () => {
    setDescription('')
    setAdjType('Correction')
    setVatType('EXEMPT')
    setPayeeId('')
    setPayeeQuery('')
    setCorrectsEntry(null)
    setRefQuery('')
    setLines(emptyLines())
    setAttachments([])
    setAttachError(null)
    setOverridePin('')
    setConfirmClear(false)
    fetchNextSequence()
  }

  const handleClear = () => {
    if (!isDirty) return resetForm()
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 4000)
      return
    }
    resetForm()
  }

  const handleSubmit = async () => {
    setConfirmOpen(false)
    setLoading(true)
    setToast(null)
    try {
      const api = getApi()
      const fullReferenceNo = `${ADJ_PREFIX}${refSequence.padStart(3, '0')}`
      const fullDescription = `${adjType}${correctsEntry ? ` of ${correctsEntry.reference_no}` : ''}: ${reason}`
      const processedAttachments = await processAttachments()

      const result = await api.submitJournalEntry({
        date: new Date(date),
        referenceNo: fullReferenceNo,
        description: fullDescription,
        vatType,
        payeeId: payeeId || undefined,
        userId,
        lines: postable.map((l) => ({
          accountId: l.accountId,
          debit: toCents(l.debit) / 100,
          credit: toCents(l.credit) / 100
        })),
        attachments: processedAttachments,
        overridePin: isLocked ? overridePin : undefined
      })

      if (result?.success) {
        setToast({ type: 'success', msg: `Posted ${result.referenceNo}.`, ref: result.referenceNo })
        resetForm()
        setTimeout(() => setToast((t) => (t?.type === 'success' ? null : t)), 10000)
      } else {
        setToast({ type: 'error', msg: result?.error || 'The entry could not be posted.' })
      }
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message || 'Failed to submit to the database.' })
    } finally {
      setLoading(false)
    }
  }

  /* -------------------------------- render ------------------------------ */

  const postBtnCls = blocker
    ? 'bg-gray-200 text-gray-700 border border-gray-300 cursor-not-allowed'
    : 'bg-[#1B9387] hover:bg-[#28958B] text-white shadow-md cursor-pointer'

  return (
    <div className="w-full min-h-[calc(100vh-64px)] p-6 lg:p-8 bg-[#f9fafb] animate-in fade-in duration-300">
      <div className="max-w-[1400px] mx-auto flex flex-col xl:flex-row items-start gap-6">
        {/* ============================ LEFT: FORM ============================ */}
        <div className="flex-1 min-w-0 w-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm">
          <div className="flex justify-between items-center px-6 lg:px-8 py-5 border-b border-[#B0DCDA]">
            <div>
              <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">
                Record adjusting entry
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Correct, accrue, defer or reclassify. Choose the entry you are correcting to see it
                beside your lines.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className={`text-xs font-bold px-4 py-2 rounded-md border transition cursor-pointer ${confirmClear ? 'border-red-300 bg-red-50 text-red-700' : 'border-[#B0DCDA] text-gray-600 hover:bg-[#E9FAFA]'}`}
            >
              {confirmClear ? 'Click again to discard' : 'Clear form'}
            </button>
          </div>

          <div className="p-6 lg:p-8 space-y-6">
            {/* Row 1: date / entry no / vat */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
              <div>
                <label htmlFor="adj-date" className={labelCls}>
                  Date
                </label>
                <input
                  id="adj-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${fieldCls} cursor-pointer ${isLocked ? 'border-red-300' : ''}`}
                />
                {lockDate && (
                  <p
                    className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${isLocked ? 'text-red-700' : 'text-gray-500'}`}
                  >
                    <Lock size={12} />
                    {isLocked
                      ? `Books are locked through ${fmtDate(lockDate + 'T00:00:00')}`
                      : `Open period · locked through ${fmtDate(lockDate + 'T00:00:00')}`}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="adj-seq" className={labelCls}>
                  Adjusting entry no.
                </label>
                <div className="flex bg-[#FBF8F8] border border-[#B0DCDA] rounded-md focus-within:border-[#1B9387] focus-within:ring-2 focus-within:ring-[#E9FAFA] transition">
                  <span className="bg-gray-50 border-r border-[#B0DCDA] rounded-l-md px-4 flex items-center text-xs font-bold text-gray-600">
                    {ADJ_PREFIX}
                  </span>
                  <input
                    id="adj-seq"
                    type="text"
                    inputMode="numeric"
                    value={refSequence}
                    onChange={(e) => setRefSequence(e.target.value.replace(/\D/g, ''))}
                    placeholder="001"
                    className="w-full bg-transparent p-3 text-sm font-mono font-bold text-gray-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={fetchNextSequence}
                    title="Use the next available number"
                    aria-label="Use the next available number"
                    className="px-3 text-gray-500 hover:text-[#1B9387] bg-white border-l border-[#B0DCDA] rounded-r-md transition cursor-pointer"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="adj-vat" className={labelCls}>
                  VAT treatment
                </label>
                <div className="relative">
                  <select
                    id="adj-vat"
                    value={vatType}
                    onChange={(e) => setVatType(e.target.value)}
                    className={`${fieldCls} pr-10 appearance-none cursor-pointer`}
                  >
                    <option value="VATABLE">Vatable (12%)</option>
                    <option value="EXEMPT">VAT-exempt</option>
                    <option value="ZERO_RATED">Zero-rated (0%)</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Locked period PIN */}
            {isLocked && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-red-700 font-bold text-sm flex items-center gap-2">
                    <Lock size={16} /> This period is locked
                  </h4>
                  <p className="text-xs text-red-700 mt-1">
                    You are posting into a closed accounting period. A manager override PIN is
                    required.
                  </p>
                </div>
                <input
                  type="password"
                  aria-label="Manager override PIN"
                  placeholder="Enter PIN"
                  value={overridePin}
                  onChange={(e) => setOverridePin(e.target.value)}
                  className="w-40 bg-white border border-red-300 rounded p-2.5 text-sm font-mono font-bold text-center text-gray-800 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            )}

            {/* Row 2: type / entry being corrected */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              <div>
                <label htmlFor="adj-type" className={labelCls}>
                  Adjustment type
                </label>
                <div className="relative">
                  <select
                    id="adj-type"
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value)}
                    className={`${fieldCls} pr-10 appearance-none cursor-pointer`}
                  >
                    {ADJ_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>

              <div className="relative">
                <label htmlFor="adj-corrects" className={labelCls}>
                  Entry being corrected (optional)
                </label>
                {correctsEntry ? (
                  <div className="flex items-center justify-between gap-3 bg-[#E9FAFA] border border-[#B0DCDA] rounded-md px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-[#1B9387] text-sm">
                        {correctsEntry.reference_no}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {fmtDate(correctsEntry.date)}
                      </span>
                      <p className="text-xs text-gray-600 truncate">{correctsEntry.description}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Stop correcting this entry"
                      onClick={() => setCorrectsEntry(null)}
                      className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                      />
                      <input
                        id="adj-corrects"
                        type="text"
                        autoComplete="off"
                        value={refQuery}
                        placeholder="Search by reference or memo, e.g. OR-1001"
                        onChange={(e) => setRefQuery(e.target.value)}
                        onFocus={() => setIsRefOpen(true)}
                        onBlur={() => setIsRefOpen(false)}
                        onKeyDown={(e) => e.key === 'Escape' && setIsRefOpen(false)}
                        className={`${fieldCls} pl-9`}
                      />
                    </div>
                    {isRefOpen && (
                      <ul className="absolute z-40 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl max-h-64 overflow-y-auto">
                        <li className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                          {refLoading ? 'Searching…' : 'Recent posted entries'}
                        </li>
                        {!refLoading && refResults.length === 0 && (
                          <li className="p-3 text-sm text-gray-500">No matching entries.</li>
                        )}
                        {refResults.map((entry) => (
                          <li
                            key={entry.id}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              selectOriginal(entry)
                            }}
                            className="p-3 text-sm hover:bg-[#E9FAFA] cursor-pointer border-b border-gray-50 last:border-0"
                          >
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-mono font-bold text-[#1B9387]">
                                {entry.reference_no}
                              </span>
                              <span className="text-xs text-gray-500">{fmtDate(entry.date)}</span>
                            </div>
                            <span className="text-gray-600 truncate block">
                              {entry.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contact */}
            <div ref={payeeBoxRef} className="relative">
              <div className="flex justify-between items-end mb-2">
                <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Contact / subsidiary (for AR/AP)
                </span>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold px-4 py-2 rounded-md transition shadow-sm cursor-pointer"
                >
                  + New contact
                </button>
              </div>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isPayeeOpen}
                onClick={() => setIsPayeeOpen((o) => !o)}
                className={`w-full text-left bg-[#FBF8F8] border rounded-md p-3 text-sm transition cursor-pointer flex justify-between items-center ${isPayeeOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-[#B0DCDA]'}`}
              >
                <span className={payeeId ? 'text-gray-800 font-medium' : 'text-gray-500'}>
                  {selectedPayee?.name || 'No contact tagged'}
                </span>
                <ChevronDown size={16} className="text-gray-500" />
              </button>
              {isPayeeOpen && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-[#B0DCDA] bg-gray-50 flex items-center gap-2">
                    <Search size={14} className="text-gray-500 ml-1" />
                    <input
                      type="text"
                      autoFocus
                      aria-label="Search contacts"
                      placeholder="Search contact name"
                      value={payeeQuery}
                      onChange={(e) => setPayeeQuery(e.target.value)}
                      className="w-full bg-transparent p-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-500"
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto">
                    <li
                      onClick={() => {
                        setPayeeId('')
                        setIsPayeeOpen(false)
                        setPayeeQuery('')
                      }}
                      className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer font-medium"
                    >
                      No contact tagged
                    </li>
                    {filteredPayees.map((p) => (
                      <li
                        key={p.id}
                        onClick={() => {
                          setPayeeId(p.id)
                          setIsPayeeOpen(false)
                          setPayeeQuery('')
                        }}
                        className="p-3 text-sm text-gray-800 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer border-t border-gray-50"
                      >
                        {p.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {usesArAp && !payeeId && (
                <p className="mt-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 flex items-center gap-2">
                  <AlertTriangle size={14} /> This entry uses Accounts Receivable or Payable. Tag a
                  contact so their balance stays accurate.
                </p>
              )}
              {payeeBalance && (payeeBalance.receivable > 0 || payeeBalance.payable > 0) && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
                  {payeeBalance.receivable > 0 && (
                    <span className="text-red-700 bg-red-50 px-3 py-1.5 rounded border border-red-200">
                      They owe the clinic ₱ {fmt(payeeBalance.receivable)}
                    </span>
                  )}
                  {payeeBalance.payable > 0 && (
                    <span className="text-amber-800 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                      The clinic owes them ₱ {fmt(payeeBalance.payable)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Memo */}
            <div>
              <label htmlFor="adj-memo" className={labelCls}>
                Reason for adjustment
              </label>
              <textarea
                id="adj-memo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what is being adjusted and why. Auditors will read this."
                className={`${fieldCls} h-20 resize-none`}
              />
              <p
                className={`mt-1 text-xs ${reason.length > 0 && reason.length < MIN_REASON_LENGTH ? 'text-amber-800 font-bold' : 'text-gray-500'}`}
              >
                {reason.length > 0 && reason.length < MIN_REASON_LENGTH
                  ? `${MIN_REASON_LENGTH - reason.length} more characters needed`
                  : `Posted as “${adjType}${correctsEntry ? ` of ${correctsEntry.reference_no}` : ''}: your reason”`}
              </p>
            </div>

            {/* Lines */}
            <div>
              <span className={labelCls}>Journal lines</span>
              <div className="border border-[#B0DCDA] rounded-md bg-white shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-[#B0DCDA]">
                    <tr className="text-left text-gray-600 text-xs uppercase tracking-wider">
                      <th className="p-3.5 pl-5 font-extrabold border-r border-[#B0DCDA]">
                        Account
                      </th>
                      <th className="p-3.5 w-44 text-right font-extrabold border-r border-[#B0DCDA]">
                        Debit
                      </th>
                      <th className="p-3.5 w-44 text-right font-extrabold border-r border-[#B0DCDA]">
                        Credit
                      </th>
                      <th className="p-3.5 w-12">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, idx) => {
                      const orphan = !line.accountId && hasAmount(line)
                      return (
                        <tr
                          key={line.key}
                          className={orphan ? 'bg-amber-50' : 'even:bg-gray-50 odd:bg-white'}
                        >
                          <td className="p-0 border-r border-[#B0DCDA] align-top">
                            <AccountCombobox
                              id={`adj-acct-${line.key}`}
                              value={line.accountId}
                              accounts={accounts}
                              invalid={orphan}
                              onSelect={(code) => setAccount(line.key, code)}
                            />
                            {orphan && (
                              <p className="px-5 pb-2 text-xs font-bold text-amber-800">
                                Choose an account for this amount
                              </p>
                            )}
                          </td>
                          {(['debit', 'credit'] as const).map((field) => (
                            <td key={field} className="p-0 border-r border-[#B0DCDA] align-top">
                              <div className="relative flex items-center">
                                <span
                                  className="absolute left-3 text-gray-500 font-mono text-xs"
                                  aria-hidden
                                >
                                  ₱
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  aria-label={`${field === 'debit' ? 'Debit' : 'Credit'} amount, line ${idx + 1}`}
                                  value={line[field]}
                                  placeholder="0.00"
                                  onChange={(e) => setAmount(line.key, field, e.target.value)}
                                  onBlur={() => formatAmount(line.key, field)}
                                  className="w-full min-h-[44px] bg-transparent pl-8 pr-3 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder:text-gray-400 focus:bg-[#E9FAFA] transition"
                                />
                              </div>
                            </td>
                          ))}
                          <td className="p-2 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => removeLine(line.key)}
                              disabled={lines.length <= 2}
                              aria-label={`Remove line ${idx + 1}`}
                              title={
                                lines.length <= 2
                                  ? 'An entry needs at least 2 lines'
                                  : 'Remove line'
                              }
                              className="p-1.5 rounded text-gray-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition cursor-pointer disabled:cursor-not-allowed"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="mt-3 text-[#1B9387] text-sm font-bold hover:bg-[#E9FAFA] px-4 py-2 rounded-md transition border border-[#B0DCDA] cursor-pointer"
              >
                + Add line
              </button>
            </div>

            {/* Attachments */}
            <div>
              <span className={labelCls}>Attachments</span>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  handleFilesAdded(Array.from(e.dataTransfer.files))
                }}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all ${isDragging ? 'bg-[#E9FAFA] border-[#1B9387]' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
              >
                <UploadCloud
                  className={isDragging ? 'text-[#1B9387]' : 'text-gray-500'}
                  size={30}
                />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-bold text-gray-700">
                    Drag and drop supporting documents here
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    JPG, PNG, PDF, XLSX or ZIP · 10 MB each · up to {MAX_FILES} files
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  id="adj-file-upload"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.pdf,.zip,.xlsx"
                  onChange={(e) => {
                    if (e.target.files) handleFilesAdded(Array.from(e.target.files))
                    e.target.value = ''
                  }}
                />
                <label
                  htmlFor="adj-file-upload"
                  className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-xs font-bold hover:bg-gray-50 transition shadow-sm"
                >
                  Browse files
                </label>
              </div>
              {attachError && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
                >
                  {attachError}
                </p>
              )}
              {attachments.length > 0 && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {attachments.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex justify-between items-center p-3 bg-white border border-[#B0DCDA] rounded-lg shadow-sm"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {file.type.includes('image') ? (
                          <ImageIcon size={18} className="text-[#1B9387] shrink-0" />
                        ) : (
                          <FileIcon size={18} className="text-[#1B9387] shrink-0" />
                        )}
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-bold text-gray-700 truncate">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500">{fmtSize(file.size)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-md transition cursor-pointer shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================= RIGHT: STICKY PANEL ======================== */}
        <aside className="w-full xl:w-96 xl:sticky xl:top-6 flex flex-col gap-4">
          {correctsEntry && (
            <section className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="text-sm font-extrabold text-gray-700">Original entry</h3>
                <span className="text-xs text-gray-500">{fmtDate(correctsEntry.date)}</span>
              </div>
              <p className="font-mono font-bold text-[#1B9387] text-sm">
                {correctsEntry.reference_no}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 mb-3">{correctsEntry.description}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-100">
                    <th className="py-1.5 font-bold">Account</th>
                    <th className="py-1.5 text-right font-bold">Debit</th>
                    <th className="py-1.5 text-right font-bold">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(correctsEntry.lines ?? []).map((l: any, i: number) => {
                    const code = l.account_id ?? l.accountId ?? l.account?.code ?? ''
                    return (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-2">
                          <span className="font-mono font-bold text-[#1B9387] mr-1.5">{code}</span>
                          <span className="text-gray-700">
                            {l.account?.name ?? accountName(code)}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono text-gray-800">
                          {Number(l.debit) > 0 ? fmt(Number(l.debit)) : ''}
                        </td>
                        <td className="py-1.5 text-right font-mono text-gray-800">
                          {Number(l.credit) > 0 ? fmt(Number(l.credit)) : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => applyOriginalLines('reverse')}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#1B9387] border border-[#B0DCDA] hover:bg-[#E9FAFA] rounded-md py-2 cursor-pointer"
                >
                  <Undo2 size={14} /> Reverse lines
                </button>
                <button
                  type="button"
                  onClick={() => applyOriginalLines('copy')}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#1B9387] border border-[#B0DCDA] hover:bg-[#E9FAFA] rounded-md py-2 cursor-pointer"
                >
                  <Copy size={14} /> Copy to edit
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Reverse swaps debits and credits. Either option replaces the lines on the left.
              </p>
            </section>
          )}

          <section className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-extrabold text-gray-700 mb-3">Entry totals</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 font-bold">Debits</dt>
                <dd className="font-mono font-bold text-gray-800">₱ {fmt(debitCents / 100)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 font-bold">Credits</dt>
                <dd className="font-mono font-bold text-gray-800">₱ {fmt(creditCents / 100)}</dd>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#B0DCDA]">
                <dt className="text-gray-600 font-bold">Difference</dt>
                <dd className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold ${isBalanced ? 'text-[#1B9387]' : 'text-red-700'}`}
                  >
                    ₱ {fmt(diffCents / 100)}
                  </span>
                  {diffCents > 0 && postable.length > 0 && (
                    <button
                      type="button"
                      onClick={balanceWithDifference}
                      title="Put the difference on the next empty line"
                      className="flex items-center gap-1 text-xs font-bold text-[#1B9387] border border-[#B0DCDA] hover:bg-[#E9FAFA] rounded px-2 py-1 cursor-pointer"
                    >
                      <Scale size={12} /> Balance
                    </button>
                  )}
                </dd>
              </div>
            </dl>

            <div
              className={`mt-3 flex items-center gap-2 text-xs font-bold rounded px-3 py-2 ${isBalanced ? 'bg-[#E9FAFA] text-[#157A6F]' : 'bg-red-50 text-red-700'}`}
              role="status"
            >
              {isBalanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {isBalanced ? 'Debits equal credits' : 'Debits and credits do not match yet'}
            </div>

            <button
              type="button"
              disabled={!!blocker || loading}
              onClick={() => setConfirmOpen(true)}
              className={`w-full mt-4 py-3.5 rounded-md font-bold text-sm uppercase tracking-wider transition flex justify-center items-center ${loading ? 'bg-gray-200 text-gray-700 border border-gray-300 cursor-wait' : postBtnCls}`}
            >
              {loading ? 'Posting…' : (blocker ?? 'Review and post')}
            </button>
            <p className="text-xs text-gray-500 mt-3">
              A posted entry can only be undone through a manager-approved void.
            </p>
          </section>
        </aside>
      </div>

      {/* ============================ CONFIRM MODAL ============================ */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adj-confirm-title"
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmOpen(false)}
        >
          <div className="bg-white border border-[#B0DCDA] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-[#B0DCDA]">
              <h3 id="adj-confirm-title" className="text-lg font-extrabold text-gray-800">
                Post {ADJ_PREFIX}
                {refSequence.padStart(3, '0')}?
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {adjType}
                {correctsEntry ? ` of ${correctsEntry.reference_no}` : ''} ·{' '}
                {fmtDate(date + 'T00:00:00')}
                {selectedPayee ? ` · ${selectedPayee.name}` : ''}
              </p>
            </div>
            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-gray-700 mb-3">{reason}</p>
              <table className="w-full text-sm">
                <tbody>
                  {postable.map((l) => (
                    <tr key={l.key} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="font-mono font-bold text-[#1B9387] mr-2">
                          {l.accountId}
                        </span>
                        {accountName(l.accountId)}
                      </td>
                      <td className="py-1.5 text-right font-mono w-28">
                        {toCents(l.debit) > 0 ? fmt(toCents(l.debit) / 100) : ''}
                      </td>
                      <td className="py-1.5 text-right font-mono w-28">
                        {toCents(l.credit) > 0 ? fmt(toCents(l.credit) / 100) : ''}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2 border-[#B0DCDA]">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right font-mono">{fmt(debitCents / 100)}</td>
                    <td className="py-2 text-right font-mono">{fmt(creditCents / 100)}</td>
                  </tr>
                </tbody>
              </table>
              {isLocked && (
                <p className="mt-3 text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <Lock size={12} /> Posting into a locked period with a manager override.
                </p>
              )}
              {attachments.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  {attachments.length} attachment{attachments.length > 1 ? 's' : ''} will be saved
                  with this entry.
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-5 py-2.5 rounded-md font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
              >
                Go back
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleSubmit}
                className="px-5 py-2.5 rounded-md font-bold text-white bg-[#1B9387] hover:bg-[#28958B] shadow-md transition cursor-pointer"
              >
                Post entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================ TOAST ================================ */}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`fixed bottom-6 right-6 z-[90] max-w-sm rounded-lg shadow-xl border p-4 flex items-start gap-3 bg-white ${toast.type === 'success' ? 'border-[#B0DCDA]' : 'border-red-300'}`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={20} className="text-[#1B9387] shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={20} className="text-red-700 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p
              className={`font-bold ${toast.type === 'success' ? 'text-gray-800' : 'text-red-700'}`}
            >
              {toast.msg}
            </p>
            {toast.type === 'success' && onNavigate && (
              <button
                type="button"
                onClick={() => {
                  setToast(null)
                  onNavigate('ledger')
                }}
                className="mt-1 text-xs font-bold text-[#1B9387] hover:underline cursor-pointer"
              >
                View in general ledger
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <NewContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSaveSuccess={async (newId?: string, newName?: string) => {
          const updated = await getApi()?.getPayees?.()
          if (Array.isArray(updated)) setPayees(updated)
          if (newId) setPayeeId(newId)
          setIsContactModalOpen(false)
          setToast({
            type: 'success',
            msg: newName ? `${newName} was added and selected.` : 'Contact added.'
          })
          setTimeout(() => setToast((t) => (t?.type === 'success' ? null : t)), 4000)
        }}
        defaultType="PATIENT"
      />
    </div>
  )
}
