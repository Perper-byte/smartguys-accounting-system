// src/renderer/src/components/CashierDisbursementView.tsx
import * as React from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Wallet,
  Receipt,
  UploadCloud,
  CheckCircle,
  X,
  Eye,
  Download,
  Printer,
  Calendar,
  Search,
  Plus,
  FileText,
  AlertCircle,
  Tag,
  ArrowRight,
  RefreshCw,
  Coins
} from 'lucide-react'

const getLocalDateString = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]

// Standard quick-select categories for Cashier Petty Cash
const QUICK_CATEGORIES = [
  { code: '5010', name: 'Clinic / Med Supplies', icon: '🩹', desc: 'Cotton, alcohol, gauze, gloves, syringes' },
  { code: '5020', name: 'Utilities & Water', icon: '💡', desc: 'Drinking water refilling, power, internet load' },
  { code: '5060', name: 'Office Supplies', icon: '📎', desc: 'Paper, ink, folders, ballpens, receipts' },
  { code: '5070', name: 'Staff Meals & Snacks', icon: '🍱', desc: 'Duty snacks, emergency food, water' },
  { code: '5080', name: 'Fare & Courier', icon: '🛵', desc: 'Grab Express, delivery, tricycle, transport fare' },
  { code: '5090', name: 'Miscellaneous Expense', icon: '📦', desc: 'Minor hardware, small fixes, general clinic items' }
]

export function CashierDisbursementView({
  userId,
  onClose
}: {
  userId: string
  onClose?: () => void
}) {
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])
  const [recentVouchers, setRecentVouchers] = useState<any[]>([])

  // Form Fields
  const [date, setDate] = useState(getLocalDateString())
  const [selectedCategoryCode, setSelectedCategoryCode] = useState('5010')
  const [amount, setAmount] = useState<number | ''>('')
  const [payeeNameInput, setPayeeNameInput] = useState('')
  const [selectedPayeeId, setSelectedPayeeId] = useState<string | null>(null)
  const [particulars, setParticulars] = useState('')
  const [sourceAccount, setSourceAccount] = useState('1010') // Default to 1010 Cash in Hand
  const [refSequence, setRefSequence] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; type: string; data: string; size?: number } | null>(null)

  // UI States
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null)
  const [voucherToPrint, setVoucherToPrint] = useState<any | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load Initial Data
  const loadData = async () => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api) return

    try {
      setLoading(true)
      // 1. Accounts
      if (api.getAccounts) {
        const accs = await api.getAccounts()
        const expenses = accs.filter(
          (a: any) => a.account_type?.name === 'Expense' || a.code.startsWith('5') || a.code.startsWith('6')
        )
        
        // Only allow Petty Cash Fund and Cash in Hand / Cash on Hand
        const allowedCashierCodes = ['1010', '1020', '1030']
        const assets = accs.filter((a: any) => {
          const name = (a.name || '').toLowerCase()
          return (
            allowedCashierCodes.includes(a.code) ||
            name.includes('petty cash') ||
            name.includes('cash in hand') ||
            name.includes('cash on hand')
          )
        })

        setExpenseAccounts(expenses)
        setCashAccounts(assets)

        // Set Cash in Hand / Cash on Hand by default
        const cashInHand = assets.find((a: any) =>
          a.code === '1010' ||
          (a.name && (a.name.toLowerCase().includes('cash in hand') || a.name.toLowerCase().includes('cash on hand')))
        )
        const pettyCash = assets.find((a: any) =>
          a.code === '1020' ||
          (a.name && a.name.toLowerCase().includes('petty cash'))
        )

        if (cashInHand) {
          setSourceAccount(cashInHand.code)
        } else if (pettyCash) {
          setSourceAccount(pettyCash.code)
        } else if (assets.length > 0) {
          setSourceAccount(assets[0].code)
        }
      }

      // 2. Payees / Contacts
      if (api.getPayees) {
        const pList = await api.getPayees()
        setPayees(pList || [])
      }

      // 3. Recent Cashier Disbursements
      if (api.getCashierDisbursements) {
        const vouchers = await api.getCashierDisbursements(100)
        setRecentVouchers(vouchers || [])
      }
    } catch (err) {
      console.error('Failed to load cashier disbursement data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Next Sequence
  const fetchNextSeq = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api?.getNextSequence) {
        const next = await api.getNextSequence('PCV-')
        setRefSequence(next)
      }
    } catch (e) {
      setRefSequence('001')
    }
  }

  useEffect(() => {
    loadData()
    fetchNextSeq()
  }, [])

  // Compress image before saving
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (!file.type.startsWith('image/')) {
          resolve(dataUrl)
          return
        }
        const img = new Image()
        img.onload = () => {
          const maxDim = 1600
          let width = img.width
          let height = img.height
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.8))
          } else {
            resolve(dataUrl)
          }
        }
        img.onerror = () => resolve(dataUrl)
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    })
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    try {
      const compressedData = await compressImage(file)
      setAttachment({
        name: file.name,
        type: file.type || 'image/jpeg',
        size: file.size,
        data: compressedData
      })
    } catch (err) {
      console.error('File upload error:', err)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  // Payee Autocomplete filter
  const filteredPayees = useMemo(() => {
    if (!payeeNameInput.trim()) return payees.slice(0, 8)
    const q = payeeNameInput.toLowerCase()
    return payees
      .filter((p) => p.name.toLowerCase().includes(q) || (p.type && p.type.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [payees, payeeNameInput])

  // Calculation for Today's Stats
  const todayStats = useMemo(() => {
    const todayStr = getLocalDateString()
    const todayVouchers = recentVouchers.filter((v) => {
      const d = new Date(v.date)
      const vDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return vDate === todayStr && v.status !== 'VOIDED'
    })

    const totalToday = todayVouchers.reduce((sum, v) => sum + (Number(v.amount) || 0), 0)
    return {
      count: todayVouchers.length,
      total: totalToday
    }
  }, [recentVouchers])

  // Filtered History
  const filteredVouchers = useMemo(() => {
    if (!searchHistoryQuery.trim()) return recentVouchers
    const q = searchHistoryQuery.toLowerCase()
    return recentVouchers.filter(
      (v) =>
        v.referenceNo.toLowerCase().includes(q) ||
        (v.payeeName && v.payeeName.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.expenseAccountName && v.expenseAccountName.toLowerCase().includes(q))
    )
  }, [recentVouchers, searchHistoryQuery])

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)

    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setStatus({ type: 'error', msg: 'Please enter a valid amount.' })
      return
    }

    if (!particulars.trim()) {
      setStatus({ type: 'error', msg: 'Please enter the particulars / purpose of the expense.' })
      return
    }

    if (!attachment) {
      setStatus({
        type: 'error',
        msg: 'Receipt photo is mandatory. Please take or attach a photo of the official receipt or signed petty cash voucher.'
      })
      return
    }

    const payeeToUse = payeeNameInput.trim() || 'Incidental / Cash'
    const fullRefNo = `PCV-${refSequence.padStart(3, '0')}`

    const selectedCategory =
      QUICK_CATEGORIES.find((c) => c.code === selectedCategoryCode) ||
      expenseAccounts.find((a) => a.code === selectedCategoryCode)

    const isHighValue = numAmount > 2000
    const highValueFlag = isHighValue ? ' [HIGH-VALUE ALERT > ₱2,000]' : ''
    const description = `Petty Cash Out: ${payeeToUse} | Purpose: ${particulars.trim()} | Account: ${selectedCategory?.name || 'Expense'}${highValueFlag}`

    const lines = [
      { accountId: selectedCategoryCode, debit: numAmount, credit: 0 },
      { accountId: sourceAccount, debit: 0, credit: numAmount }
    ]

    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api?.submitJournalEntry) {
        throw new Error('Database API unavailable.')
      }

      const result = await api.submitJournalEntry({
        date: new Date(date).toISOString(),
        referenceNo: fullRefNo,
        description: description,
        vatType: 'EXEMPT',
        userId: userId,
        payeeId: selectedPayeeId || undefined,
        lines: lines,
        attachments: attachment ? [attachment] : []
      })

      if (result.success) {
        setStatus({
          type: 'success',
          msg: `Petty Cash Voucher ${fullRefNo} recorded successfully! (₱${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})`
        })

        // Auto prompt to print voucher slip
        const createdVoucher = {
          referenceNo: fullRefNo,
          date: date,
          payeeName: payeeToUse,
          description: particulars.trim(),
          amount: numAmount,
          expenseAccountCode: selectedCategoryCode,
          expenseAccountName: selectedCategory?.name || 'Expense',
          sourceAccountCode: sourceAccount,
          cashierName: 'Cashier'
        }
        setVoucherToPrint(createdVoucher)

        // Reset inputs
        setAmount('')
        setParticulars('')
        setPayeeNameInput('')
        setSelectedPayeeId(null)
        setAttachment(null)

        // Refresh list & sequence
        await loadData()
        await fetchNextSeq()
      } else {
        setStatus({ type: 'error', msg: result.error || 'Failed to save voucher.' })
      }
    } catch (err: any) {
      console.error('Submit error:', err)
      setStatus({ type: 'error', msg: err.message || 'System error connecting to database.' })
    } finally {
      setLoading(false)
    }
  }

  // Trigger Print
  const handlePrintVoucher = (v: any) => {
    setVoucherToPrint(v)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 py-6 font-sans text-gray-800 animate-in fade-in duration-200">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-[#B0DCDA]">
        <div className="flex items-center gap-3.5">
          <div className="bg-[#E9FAFA] p-3 rounded-2xl border border-[#B0DCDA] text-[#1B9387] shadow-2xs">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-gray-800 tracking-tight">
                Cashier Cash Out & Petty Cash
              </h1>
              <span className="bg-emerald-50 text-[#1B9387] border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Small Expenses
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Record incidental clinic expenses, drinking water, courier fares, and routine cash disbursements from the register.
            </p>
          </div>
        </div>

        {/* TODAY'S METRICS */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#B0DCDA] px-4 py-2.5 rounded-xl shadow-2xs text-right">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Today's Cash Out
            </span>
            <span className="text-lg font-black font-mono text-rose-600">
              ₱ {todayStats.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-[#B0DCDA] px-4 py-2.5 rounded-xl shadow-2xs text-right">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Vouchers Issued
            </span>
            <span className="text-lg font-black font-mono text-[#1B9387]">
              {todayStats.count}
            </span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh records"
            className="p-3 bg-white border border-gray-200 hover:border-[#B0DCDA] rounded-xl text-gray-600 hover:text-[#1B9387] shadow-2xs transition cursor-pointer"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close window"
              className="p-3 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-xl border border-gray-200 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {status && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-center justify-between border shadow-2xs ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {status.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{status.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* TWO COLUMN GRID: FORM ON LEFT, VOUCHERS LIST ON RIGHT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: THE CASHIER DISBURSEMENT FORM */}
        <div className="xl:col-span-7 bg-white border border-[#B0DCDA] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-[#FBF8F8] border-b border-[#B0DCDA] flex items-center justify-between">
            <span className="text-xs font-black text-[#1B9387] uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16} />
              Issue New Petty Cash Voucher
            </span>
            <span className="font-mono text-xs font-black bg-[#E9FAFA] text-[#1B9387] px-2.5 py-1 rounded-md border border-[#B0DCDA]">
              PCV-{refSequence.padStart(3, '0')}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* STEP 1: CATEGORY SELECTION */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                1. Select Expense Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {QUICK_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategoryCode === cat.code
                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => setSelectedCategoryCode(cat.code)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#1B9387] bg-teal-50/40 ring-2 ring-[#1B9387]/30 shadow-2xs'
                          : 'border-gray-200 bg-white hover:border-[#B0DCDA] hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-[10px] font-mono font-bold text-gray-400">{cat.code}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-800 leading-tight block">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                        {cat.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 2: AMOUNT */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  2. Disbursement Amount (₱)
                </label>
                <span className="text-[11px] text-gray-400 font-medium italic">
                  Max typical threshold: ₱5,000.00
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-xl font-bold text-gray-400 font-mono">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:border-[#1B9387] focus:bg-white rounded-xl text-2xl font-mono font-black text-gray-900 outline-none transition"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {[50, 100, 200, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount((prev) => (Number(prev) || 0) + preset)}
                    className="px-2.5 py-1 bg-white hover:bg-[#E9FAFA] border border-gray-200 hover:border-[#B0DCDA] rounded-lg text-xs font-bold font-mono text-gray-700 hover:text-[#1B9387] transition cursor-pointer shadow-2xs"
                  >
                    +₱{preset}
                  </button>
                ))}
                {amount !== '' && (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-300 rounded-lg text-xs font-bold text-gray-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {Number(amount) > 2000 && (
                <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-medium animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>High-Value Notice:</strong> Disbursements exceeding <strong>₱2,000.00</strong> will be flagged for Accountant Audit.
                  </span>
                </div>
              )}
            </div>

            {/* STEP 3: PAYEE & PARTICULARS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Paid To */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  3. Paid To (Recipient / Store)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Water Station, Grab, Staff..."
                    value={payeeNameInput}
                    onChange={(e) => {
                      setPayeeNameInput(e.target.value)
                      setSelectedPayeeId(null)
                      setIsPayeeDropdownOpen(true)
                    }}
                    onFocus={() => setIsPayeeDropdownOpen(true)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#1B9387] focus:bg-white rounded-xl text-xs font-bold text-gray-800 outline-none transition"
                  />
                  {selectedPayeeId && (
                    <span className="absolute right-3 top-2.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Linked Contact
                    </span>
                  )}
                </div>

                {/* Dropdown search suggestions */}
                {isPayeeDropdownOpen && filteredPayees.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#B0DCDA] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto py-1">
                    {filteredPayees.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPayeeNameInput(p.name)
                          setSelectedPayeeId(p.id)
                          setIsPayeeDropdownOpen(false)
                        }}
                        className="px-3 py-2 hover:bg-[#E9FAFA] cursor-pointer text-xs flex items-center justify-between"
                      >
                        <span className="font-bold text-gray-800">{p.name}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                          {p.type}
                        </span>
                      </div>
                    ))}
                    <div
                      onClick={() => setIsPayeeDropdownOpen(false)}
                      className="px-3 py-1.5 text-[10px] text-gray-400 text-center border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                    >
                      Close list (use custom name)
                    </div>
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Voucher Date
                </label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 focus-within:border-[#1B9387] focus-within:bg-white rounded-xl px-3 py-2 transition">
                  <Calendar size={16} className="text-gray-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Purpose / Remarks */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                4. Particulars / Purpose of Expense
              </label>
              <textarea
                required
                rows={2}
                placeholder="e.g. 5 gallons drinking water refilling for clinic, or courier fare for sample delivery"
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 focus:border-[#1B9387] focus:bg-white rounded-xl text-xs font-medium text-gray-800 outline-none transition resize-none placeholder:text-gray-400"
              />
            </div>

            {/* Source Account & Receipt Attachment Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
              {/* Payment Source */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Disburse From (Source)
                </label>
                <select
                  value={sourceAccount}
                  onChange={(e) => setSourceAccount(e.target.value)}
                  className="w-full text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1B9387]"
                >
                  {cashAccounts.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receipt Attachment Upload */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Receipt Photo / Voucher <span className="text-rose-500 font-black">*Required</span></span>
                  <span className="text-[10px] text-gray-400 font-normal">Photo of OR / signed slip</span>
                </label>
                {attachment ? (
                  <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <FileText size={16} className="text-[#1B9387] shrink-0" />
                      <span className="text-xs font-bold text-gray-800 truncate" title={attachment.name}>
                        {attachment.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(attachment)}
                        className="p-1 text-gray-400 hover:text-[#1B9387] rounded transition cursor-pointer"
                        title="Preview"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
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
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                      isDragging
                        ? 'bg-[#E9FAFA] border-[#1B9387] text-[#1B9387]'
                        : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <UploadCloud size={16} />
                    <span>Upload Receipt / Paper Slip</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !amount || Number(amount) <= 0 || !particulars.trim()}
                className="w-full py-3.5 bg-[#1B9387] hover:bg-[#15796f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-md shadow-[#1B9387]/20 text-sm transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {loading ? (
                  <span>Processing Disbursement...</span>
                ) : (
                  <>
                    <Receipt size={18} />
                    <span>Confirm & Issue Petty Cash Voucher</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: RECENT VOUCHERS LIST */}
        <div className="xl:col-span-5 bg-white border border-[#B0DCDA] rounded-2xl shadow-sm flex flex-col overflow-hidden max-h-[800px]">
          <div className="px-5 py-4 bg-[#FBF8F8] border-b border-[#B0DCDA] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                Recent Cashier Vouchers
              </h3>
              <p className="text-[10px] text-gray-400 font-medium">
                Petty cash disbursements recorded by cashier
              </p>
            </div>
            {/* Search filter */}
            <div className="relative min-w-[150px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-[#1B9387]"
              />
            </div>
          </div>

          <div className="p-4 overflow-y-auto divide-y divide-gray-100 flex-1 space-y-2">
            {filteredVouchers.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 italic">
                No petty cash vouchers found.
              </div>
            ) : (
              filteredVouchers.map((v) => (
                <div
                  key={v.id || v.referenceNo}
                  className="pt-2 pb-2 first:pt-0 hover:bg-gray-50 p-2.5 rounded-xl transition border border-transparent hover:border-gray-200 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#1B9387] bg-[#E9FAFA] px-2 py-0.5 rounded border border-[#B0DCDA]">
                        {v.referenceNo}
                      </span>
                      <span className="text-[11px] font-bold text-gray-500">
                        {new Date(v.date || v.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-black text-rose-600">
                      ₱ {Number(v.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-700">
                    <span className="font-bold truncate max-w-[200px]">
                      {v.payeeName || 'Cash Out'}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono truncate max-w-[130px]">
                      {v.expenseAccountName || 'Expense'}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500 truncate" title={v.description}>
                    {v.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-100/60 text-[10px]">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      {v.attachments && v.attachments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(v.attachments[0])}
                          className="text-[#1B9387] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                        >
                          <Eye size={11} /> Receipt ({v.attachments.length})
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrintVoucher(v)}
                      className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-700 font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs hover:text-[#1B9387]"
                    >
                      <Printer size={11} />
                      <span>Print Slip</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#FBF8F8]">
              <span className="font-bold text-gray-800 text-sm truncate">
                {previewAttachment.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = previewAttachment.data
                    link.download = previewAttachment.name || 'receipt'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1B9387] text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Download size={13} /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto bg-gray-900/5 flex-1 min-h-[300px]">
              <img
                src={previewAttachment.data}
                alt="Receipt preview"
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE PETTY CASH VOUCHER SLIP */}
      {voucherToPrint && (
        <div className="hidden print:block fixed inset-0 z-[99999] bg-white p-8 font-sans">
          <div className="max-w-[450px] mx-auto border-2 border-dashed border-gray-400 p-6 rounded-lg text-gray-900">
            {/* Header */}
            <div className="text-center pb-4 border-b border-gray-300 mb-4">
              <h2 className="text-xl font-black uppercase tracking-wider">SmartGuys Clinic</h2>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                Petty Cash / Cash Outflow Voucher
              </p>
            </div>

            {/* Voucher Meta */}
            <div className="flex justify-between items-center text-xs mb-3">
              <div>
                <span className="text-gray-500">Voucher No: </span>
                <span className="font-mono font-bold">{voucherToPrint.referenceNo}</span>
              </div>
              <div>
                <span className="text-gray-500">Date: </span>
                <span className="font-bold">
                  {new Date(voucherToPrint.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {/* Payee & Amount */}
            <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Paid To:</span>
                <span className="font-black text-gray-800 uppercase">{voucherToPrint.payeeName}</span>
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-gray-200">
                <span className="text-gray-500 font-medium">Amount Disbursed:</span>
                <span className="text-lg font-black font-mono text-gray-900">
                  ₱ {Number(voucherToPrint.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Particulars & Account */}
            <div className="space-y-2 text-xs mb-6">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  Particulars / Description
                </span>
                <p className="font-semibold text-gray-800 mt-0.5 whitespace-pre-wrap leading-relaxed">
                  {voucherToPrint.description}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  Charge to Account
                </span>
                <span className="font-mono font-bold text-gray-700">
                  {voucherToPrint.expenseAccountCode} - {voucherToPrint.expenseAccountName}
                </span>
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-3 gap-2 pt-6 border-t-2 border-dashed border-gray-300 text-center text-[10px]">
              <div>
                <div className="border-b border-gray-400 pb-1 mb-1 font-bold">
                  {voucherToPrint.cashierName || 'Cashier'}
                </div>
                <span className="text-gray-400 font-semibold uppercase">Prepared By</span>
              </div>
              <div>
                <div className="border-b border-gray-400 pb-1 mb-1 font-bold">
                  Approved
                </div>
                <span className="text-gray-400 font-semibold uppercase">Verified By</span>
              </div>
              <div>
                <div className="border-b border-gray-400 pb-1 mb-1 font-bold">
                  &nbsp;
                </div>
                <span className="text-gray-400 font-semibold uppercase">Received By</span>
              </div>
            </div>

            <div className="mt-6 text-center text-[9px] text-gray-400 italic">
              Clinic Internal Petty Cash Control Slip
            </div>
          </div>
        </div>
      )}
    </div>
  )
}