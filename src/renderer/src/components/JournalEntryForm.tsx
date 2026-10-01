// src/renderer/src/components/JournalEntryForm.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom' // 👈 Added for floating toast
import { NewContactModal } from './NewContactModal'
import {
  UploadCloud,
  File as FileIcon,
  X,
  Image as ImageIcon,
  RefreshCw,
  AlertTriangle, // 👈 Added icons for toast
  CheckCircle2,
  Info
} from 'lucide-react'

const getLocalDateString = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Amounts are kept as strings while typing so "1." and "0." survive.
type JLine = { accountId: string; debit: string; credit: string }
const blank = (): JLine => ({ accountId: '', debit: '', credit: '' })
const toCents = (s: string) => Math.round((parseFloat(s) || 0) * 100)

export const JournalEntryForm: React.FC<{ userId: string; isAdjusting?: boolean }> = ({
  userId
}) => {
  const [accounts, setAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])

  const [date, setDate] = useState(getLocalDateString())
  const [refPrefix, setRefPrefix] = useState('JV-')
  const [refSequence, setRefSequence] = useState('')
  const [description, setDescription] = useState('')

  const [vatType, setVatType] = useState('VATABLE')
  const [payeeId, setPayeeId] = useState('')

  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false)

  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('')
  const [activeAccountRow, setActiveAccountRow] = useState<number | null>(null)
  const [accountSearchQuery, setAccountSearchQuery] = useState('')

  const [payeeBalance, setPayeeBalance] = useState<{ receivable: number; payable: number } | null>(
    null
  )
  const [lines, setLines] = useState<JLine[]>([blank(), blank()])

  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const [loading, setLoading] = useState(false)

  // 👈 Upgraded TOAST STATE
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const api = (window as any).electronAPI || (window as any).api
    if (api) {
      if (api.getAccounts)
        api
          .getAccounts()
          .then((res: any) => setAccounts(Array.isArray(res) ? res : []))
          .catch(() => setAccounts([]))
      if (api.getPayees)
        api
          .getPayees()
          .then((res: any) => setPayees(Array.isArray(res) ? res : []))
          .catch(() => setPayees([]))
    }
  }, [])

  const fetchNextSequence = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      const nextSeq = await api.getNextSequence(refPrefix)
      setRefSequence(String(nextSeq))
    } catch (error) {
      console.error('Failed to fetch next sequence', error)
    }
  }

  useEffect(() => {
    fetchNextSequence()
  }, [refPrefix])

  useEffect(() => {
    if (!payeeId) {
      setPayeeBalance(null)
      return
    }
    const fetchBalance = async () => {
      const api = (window as any).electronAPI || (window as any).api
      if (api && api.getPayeeBalance) {
        const bal = await api.getPayeeBalance(payeeId)
        setPayeeBalance(bal)
      }
    }
    fetchBalance()
  }, [payeeId])

  // newId / newName may be undefined if the modal could not find the new record
  const handleContactSaved = async (newId?: string, newName?: string) => {
    const api = (window as any).electronAPI || (window as any).api
    if (api?.getPayees) {
      const updatedPayees = await api.getPayees()
      setPayees(Array.isArray(updatedPayees) ? updatedPayees : [])
    }
    if (newId) setPayeeId(newId)
    setIsNewContactModalOpen(false)
    showToast(newName ? `${newName} was added and selected.` : 'Contact added.', 'success')
  }

  /* ------------------------------ line actions ------------------------------ */

  const addLine = () => setLines((p) => [...p, blank()])

  const setAccount = (i: number, accountId: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, accountId } : l)))

  const setAmount = (i: number, field: 'debit' | 'credit', raw: string) => {
    // digits with an optional decimal point and at most 2 decimals
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return
    const other = field === 'debit' ? 'credit' : 'debit'
    setLines((p) =>
      p.map((l, idx) =>
        idx === i ? { ...l, [field]: raw, ...(toCents(raw) > 0 ? { [other]: '' } : {}) } : l
      )
    )
  }

  // Tidy the number (e.g. "5" -> "5.00") when the field loses focus
  const formatAmount = (i: number, field: 'debit' | 'credit') =>
    setLines((p) =>
      p.map((l, idx) => {
        if (idx !== i || l[field] === '') return l
        const n = parseFloat(l[field])
        return { ...l, [field]: n > 0 ? n.toFixed(2) : '' }
      })
    )

  const removeLine = (index: number) => {
    if (lines.length <= 2) return
    setLines((p) => p.filter((_, i) => i !== index))
  }

  /* ------------------------------ attachments ------------------------------ */

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFilesAdded(Array.from(e.target.files))
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFilesAdded(Array.from(e.dataTransfer.files))
  }

  const handleFilesAdded = (files: File[]) => {
    const validFiles: File[] = []
    let typeError = false
    let sizeError = false

    files.forEach((file) => {
      const isValidType = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ].includes(file.type)
      const isValidSize = file.size <= 10 * 1024 * 1024

      if (!isValidType) typeError = true
      if (!isValidSize) sizeError = true
      if (isValidType && isValidSize) validFiles.push(file)
    })

    if (typeError)
      showToast('Some files are not supported (JPG, PNG, PDF, ZIP, XLSX only).', 'error')
    if (sizeError) showToast('Some files exceed the 10MB limit.', 'error')

    if (attachments.length + validFiles.length > 10) {
      showToast('You can only upload a maximum of 10 attachments per entry.', 'error')
      return
    }

    setAttachments((prev) => [...prev, ...validFiles])
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const processAttachments = async () => {
    return Promise.all(
      attachments.map(async (file) => {
        return new Promise<{
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
      })
    )
  }

  /* -------------------------------- totals -------------------------------- */

  // Work in whole cents so floating-point error can never unbalance an entry
  const debitCents = lines.reduce((s, l) => s + toCents(l.debit), 0)
  const creditCents = lines.reduce((s, l) => s + toCents(l.credit), 0)
  const totalDebit = debitCents / 100
  const totalCredit = creditCents / 100
  const isBalanced = debitCents > 0 && debitCents === creditCents
  const difference = Math.abs(debitCents - creditCents) / 100

  // AR (1200) / AP (2010) lines normally need a contact so the subsidiary balance is right
  const usesArAp = lines.some((l) => l.accountId === '1200' || l.accountId === '2010')

  const canPost = isBalanced && !!refSequence && !loading

  /* -------------------------------- submit -------------------------------- */

  const handleSubmit = async () => {
    setToast(null)
    setLoading(true)

    try {
      if (!refSequence.trim()) throw new Error('Please enter a Sequence Number for the Reference.')

      const validLines = lines
        .filter((l) => l.accountId && (toCents(l.debit) > 0 || toCents(l.credit) > 0))
        .map((l) => ({
          accountId: l.accountId,
          debit: toCents(l.debit) / 100,
          credit: toCents(l.credit) / 100
        }))

      const api = (window as any).electronAPI || (window as any).api

      const paddedSequence = refSequence.padStart(3, '0')
      const fullReferenceNo = `${refPrefix}${paddedSequence}`

      const processedAttachments = await processAttachments()

      const result = await api.submitJournalEntry({
        date: new Date(date),
        referenceNo: fullReferenceNo,
        description,
        vatType,
        payeeId: payeeId === '' ? undefined : payeeId,
        userId,
        lines: validLines,
        attachments: processedAttachments
      })

      if (result.success) {
        showToast(`Entry ${result.referenceNo} posted successfully!`, 'success')
        setDescription('')
        setVatType('VATABLE')
        setPayeeId('')
        setPayeeSearchQuery('')
        setLines([blank(), blank()])
        setAttachments([])
        fetchNextSequence() // Fetch the next available sequence automatically
      } else {
        showToast(result.error, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to submit to database.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredPayees = payees.filter((p) => {
    if (!p || !p.name) return false
    return String(p.name)
      .toLowerCase()
      .includes(String(payeeSearchQuery || '').toLowerCase())
  })

  const selectedPayeeName =
    payees.find((p) => p.id === payeeId)?.name || '-- No Sub-Account Tagged --'

  // Post button text explains WHY it's disabled
  const postLabel = () => {
    if (loading) return 'Processing...'
    if (debitCents === 0 && creditCents === 0) return 'Enter debit and credit amounts'
    if (!isBalanced) return `Out of balance by ₱ ${fmt(difference)}`
    if (!refSequence) return 'Enter a reference number'
    return 'Post Journal Entry'
  }

  return (
    <div className="w-full animate-in fade-in duration-300 relative">
      {/* 👈 FLOATING TOAST PROVIDER (Escapes CSS boundaries) */}
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

      {/* FULL WIDTH: removed max-w-4xl + centering */}
      <div className="w-full bg-white border border-[#B0DCDA] rounded-xl px-6 lg:px-8 pt-6 lg:pt-8 shadow-sm">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 border-b border-[#B0DCDA] pb-4">
          <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">New Journal Entry</h2>
          <span className="bg-[#E9FAFA] text-[#1B9387] text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-widest border border-[#B0DCDA]">
            General Journal
          </span>
        </div>

        {/* ROW 1: DATE / REFERENCE / VAT */}
        <div className="grid gap-6 mb-6 grid-cols-1 md:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition cursor-pointer"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Reference No.
            </label>
            <div className="flex bg-[#FBF8F8] border border-[#B0DCDA] rounded-md focus-within:border-[#1B9387] focus-within:ring-2 focus-within:ring-[#E9FAFA] transition">
              <select
                value={refPrefix}
                onChange={(e) => setRefPrefix(e.target.value)}
                className="bg-gray-50 border-r border-[#B0DCDA] rounded-l-md px-2 py-3 text-xs font-bold text-gray-600 outline-none cursor-pointer"
              >
                <option value="JV-">JV-</option>
                <option value="PJ-">PJ-</option>
              </select>
              <input
                type="text"
                value={refSequence}
                onChange={(e) => setRefSequence(e.target.value)}
                placeholder="001"
                className="w-full bg-transparent p-3 text-sm font-mono text-gray-800 font-bold outline-none"
              />
              <button
                type="button"
                onClick={fetchNextSequence}
                className="px-3 text-gray-400 hover:text-[#1B9387] bg-white border-l border-[#B0DCDA] rounded-r-md transition cursor-pointer"
                title="Auto-Generate Next Sequence"
                aria-label="Auto-generate next sequence"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              VAT Type
            </label>
            <div className="relative">
              <select
                value={vatType}
                onChange={(e) => setVatType(e.target.value)}
                className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 pr-10 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition appearance-none cursor-pointer"
              >
                <option value="VATABLE">Vatable (12%)</option>
                <option value="EXEMPT">VAT-Exempt</option>
                <option value="ZERO_RATED">Zero-Rated (0%)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg
                  className="w-4 h-4 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: CONTACT + DESCRIPTION SIDE BY SIDE */}
        <div className="grid gap-6 mb-6 pb-6 border-b border-[#B0DCDA] grid-cols-1 lg:grid-cols-2">
          <div className="relative">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Contact / Subsidiary (For AR/AP)
              </label>
              <button
                type="button"
                onClick={() => setIsNewContactModalOpen(true)}
                className="bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold px-4 py-2 rounded-md transition shadow-sm cursor-pointer"
              >
                + New Contact
              </button>
            </div>

            <div className="relative">
              <div
                onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                className={`w-full bg-[#FBF8F8] border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-[#B0DCDA]'} rounded-md p-3 text-sm text-gray-800 transition cursor-pointer flex justify-between items-center`}
              >
                <span className={payeeId ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                  {selectedPayeeName}
                </span>
                <svg
                  className="w-4 h-4 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              {isPayeeDropdownOpen && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-[#B0DCDA] bg-gray-50">
                    <input
                      type="text"
                      autoFocus
                      placeholder="🔍 Search contact name..."
                      value={payeeSearchQuery}
                      onChange={(e) => setPayeeSearchQuery(e.target.value)}
                      className="w-full bg-transparent p-2 text-sm text-gray-800 outline-none placeholder-gray-400"
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto">
                    <li
                      onClick={() => {
                        setPayeeId('')
                        setIsPayeeDropdownOpen(false)
                        setPayeeSearchQuery('')
                      }}
                      className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium"
                    >
                      -- No Sub-Account Tagged --
                    </li>
                    {filteredPayees.map((p: any) => (
                      <li
                        key={p.id}
                        onClick={() => {
                          setPayeeId(p.id)
                          setIsPayeeDropdownOpen(false)
                          setPayeeSearchQuery('')
                        }}
                        className="p-3 text-sm text-gray-800 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-50"
                      >
                        {p.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {usesArAp && !payeeId && (
              <p className="mt-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                ⚠️ This entry uses Accounts Receivable / Payable. Tag a contact so their balance
                stays accurate.
              </p>
            )}

            {payeeBalance && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {payeeBalance.receivable > 0 && (
                  <span className="text-red-700 font-bold bg-red-50 px-3 py-1.5 rounded border border-red-200">
                    ⚠️ They owe clinic: ₱
                    {payeeBalance.receivable.toLocaleString(undefined, {
                      minimumFractionDigits: 2
                    })}
                  </span>
                )}
                {payeeBalance.payable > 0 && (
                  <span className="text-amber-800 font-bold bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                    ⚠️ Clinic owes them: ₱
                    {payeeBalance.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Description / Memo
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Type transaction details here..."
              className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 h-[84px] resize-none font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition"
            />
          </div>
        </div>

        {/* LINES TABLE */}
        <div className="border border-[#B0DCDA] rounded-md bg-white overflow-visible mb-4 shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[#B0DCDA]">
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-3.5 pl-5 font-extrabold border-r border-[#B0DCDA]">Account</th>
                <th className="p-3.5 w-[220px] xl:w-[260px] text-right font-extrabold border-r border-[#B0DCDA]">
                  Debit
                </th>
                <th className="p-3.5 w-[220px] xl:w-[260px] text-right font-extrabold border-r border-[#B0DCDA]">
                  Credit
                </th>
                <th className="p-3.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <tr
                  key={idx}
                  className="even:bg-gray-50 odd:bg-white hover:bg-[#E9FAFA]/50 transition"
                >
                  {/* ACCOUNT CELL */}
                  <td className="p-0 border-r border-[#B0DCDA] relative align-top">
                    {activeAccountRow === idx ? (
                      <div className="absolute z-50 left-0 top-0 w-full min-w-[350px] bg-white border border-[#1B9387] shadow-xl rounded-md overflow-hidden">
                        <div className="p-2 bg-[#FBF8F8] border-b border-[#B0DCDA]">
                          <input
                            type="text"
                            autoFocus
                            placeholder="🔍 Type account code or name..."
                            value={accountSearchQuery}
                            onChange={(e) => setAccountSearchQuery(e.target.value)}
                            onBlur={() => setTimeout(() => setActiveAccountRow(null), 200)}
                            className="w-full bg-transparent p-1.5 text-sm text-gray-800 outline-none font-medium"
                          />
                        </div>
                        <ul className="max-h-48 overflow-y-auto bg-white custom-scrollbar">
                          {accounts
                            .filter(
                              (a) =>
                                a &&
                                a.name &&
                                `${a.code} ${a.name}`
                                  .toLowerCase()
                                  .includes(String(accountSearchQuery || '').toLowerCase())
                            )
                            .map((acc) => (
                              <li
                                key={acc.code}
                                onMouseDown={() => {
                                  setAccount(idx, acc.code)
                                  setActiveAccountRow(null)
                                }}
                                className="p-3 text-sm text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0 flex items-center"
                              >
                                <span className="font-mono font-bold text-[#1B9387] w-14 inline-block">
                                  {acc.code}
                                </span>
                                <span className="font-medium">{acc.name}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setActiveAccountRow(idx)
                          setAccountSearchQuery('')
                        }}
                        className="w-full h-full min-h-[44px] p-3.5 pl-5 text-sm text-gray-800 cursor-text flex justify-between items-center group"
                      >
                        {line.accountId ? (
                          <span>
                            <span className="font-mono font-extrabold text-[#1B9387] mr-3">
                              {line.accountId}
                            </span>
                            <span className="font-medium text-gray-800">
                              {accounts.find((a) => a.code === line.accountId)?.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400 italic font-medium">
                            Type to search account...
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* DEBIT CELL */}
                  <td className="p-0 border-r border-[#B0DCDA] align-top">
                    <div className="relative flex items-center h-full">
                      <span className="absolute left-3 text-gray-400 font-mono text-xs">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Debit amount, line ${idx + 1}`}
                        value={line.debit}
                        placeholder="0.00"
                        onChange={(e) => setAmount(idx, 'debit', e.target.value)}
                        onBlur={() => formatAmount(idx, 'debit')}
                        className="w-full h-full min-h-[44px] bg-transparent pl-8 pr-3 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder-gray-300 focus:bg-[#E9FAFA] transition"
                      />
                    </div>
                  </td>

                  {/* CREDIT CELL */}
                  <td className="p-0 border-r border-[#B0DCDA] align-top">
                    <div className="relative flex items-center h-full">
                      <span className="absolute left-3 text-gray-400 font-mono text-xs">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Credit amount, line ${idx + 1}`}
                        value={line.credit}
                        placeholder="0.00"
                        onChange={(e) => setAmount(idx, 'credit', e.target.value)}
                        onBlur={() => formatAmount(idx, 'credit')}
                        className="w-full h-full min-h-[44px] bg-transparent pl-8 pr-3 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder-gray-300 focus:bg-[#E9FAFA] transition"
                      />
                    </div>
                  </td>

                  {/* REMOVE */}
                  <td className="p-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 2}
                      aria-label={`Remove line ${idx + 1}`}
                      className="text-red-400 hover:text-red-700 disabled:opacity-20 transition cursor-pointer disabled:cursor-not-allowed font-bold"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mb-6 text-[#1B9387] text-sm font-bold hover:bg-[#E9FAFA] px-5 py-2.5 rounded-md transition border border-transparent hover:border-[#B0DCDA] shadow-sm cursor-pointer"
        >
          + Add Line
        </button>

        {/* ATTACHMENTS */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Attachments
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={handleDrop}
            className={`mt-2 border-2 border-dashed rounded-xl p-5 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all ${isDragging ? 'bg-[#E9FAFA] border-[#1B9387]' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
          >
            <UploadCloud
              className={`${isDragging ? 'text-[#1B9387]' : 'text-gray-400'}`}
              size={30}
            />
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-gray-600">
                Drag and drop or upload attachments here
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                JPG, PNG, PDF, XLSX, ZIP. Max 10mb each.
              </p>
            </div>
            <input
              type="file"
              multiple
              id="file-upload"
              className="hidden"
              onChange={handleFileSelect}
              accept=".jpg,.jpeg,.png,.pdf,.zip,.xlsx"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-xs font-bold hover:bg-gray-50 transition shadow-sm"
            >
              Browse Files
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-white border border-[#B0DCDA] rounded-lg shadow-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {file.type.includes('image') ? (
                      <ImageIcon size={18} className="text-[#1B9387] shrink-0" />
                    ) : (
                      <FileIcon size={18} className="text-[#1B9387] shrink-0" />
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold text-gray-700 truncate">{file.name}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Remove ${file.name}`}
                    className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-md transition cursor-pointer shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STICKY FOOTER: totals + post button always visible */}
        <div className="sticky bottom-0 z-40 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 bg-white/95 backdrop-blur border-t-2 border-[#B0DCDA] rounded-b-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">
                Total Debits
              </span>
              <span className="text-gray-800 font-mono font-bold">₱ {fmt(totalDebit)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">
                Total Credits
              </span>
              <span className="text-gray-800 font-mono font-bold">₱ {fmt(totalCredit)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">
                Difference
              </span>
              <span
                className={`font-mono font-bold ${isBalanced ? 'text-[#1B9387]' : 'text-red-700'}`}
              >
                ₱ {fmt(difference)}
              </span>
            </div>
            <div>
              {isBalanced ? (
                <span className="text-[#1B9387] text-xs font-extrabold uppercase tracking-widest">
                  ✓ Balanced
                </span>
              ) : (
                <span className="text-red-700 text-xs font-extrabold uppercase tracking-widest">
                  ⚠️ Out of Balance
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!canPost}
            onClick={handleSubmit}
            className={`lg:min-w-[320px] py-3.5 px-8 rounded-md font-bold text-sm uppercase tracking-widest transition flex justify-center items-center ${
              canPost
                ? 'bg-[#1B9387] hover:bg-[#28958B] text-white shadow-md cursor-pointer'
                : 'bg-gray-200 text-gray-700 border border-gray-300 cursor-not-allowed'
            }`}
          >
            {postLabel()}
          </button>
        </div>
      </div>

      <NewContactModal
        isOpen={isNewContactModalOpen}
        onClose={() => setIsNewContactModalOpen(false)}
        onSaveSuccess={handleContactSaved}
        defaultType="PATIENT"
      />
    </div>
  )
}
