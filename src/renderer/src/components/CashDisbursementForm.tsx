// src/renderer/src/components/CashDisbursementForm.tsx
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { NewContactModal } from './NewContactModal'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'
import {
  Plus,
  Trash2,
  Receipt,
  FileText,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  SplitSquareHorizontal,
  RefreshCw,
  Eye,
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  Calendar,
  Upload
} from 'lucide-react'

const getLocalDateString = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]

export interface DisbursementLineItem {
  id: string
  accountId: string
  description: string
  amount: number | ''
  isVatable: boolean
}

export const CashDisbursementForm: React.FC<{ userId: string }> = ({ userId }) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'cdv' | 'cashier-audit' | 'history'>('cdv')

  // Dropdowns & Data
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])
  const [recentVouchers, setRecentVouchers] = useState<any[]>([])

  // Cashier Petty Cash Audit State
  const [cashierVouchers, setCashierVouchers] = useState<any[]>([])
  const [loadingCashier, setLoadingCashier] = useState(false)
  const [cashierSearch, setCashierSearch] = useState('')
  const [highValueOnly, setHighValueOnly] = useState(false)
  const [ackFilter, setAckFilter] = useState<'all' | 'pending' | 'acknowledged'>('all')
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [cashierDateSort, setCashierDateSort] = useState<'desc' | 'asc'>('desc')

  // Historical Vouchers Register State
  const [historyVouchers, setHistoryVouchers] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'CDV' | 'PCV' | 'CV' | 'DV' | 'REF'>('ALL')
  const [historyDateSort, setHistoryDateSort] = useState<'desc' | 'asc'>('desc')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')

  // Section 1: Payment Info
  const [date, setDate] = useState(getLocalDateString())
  const [payeeId, setPayeeId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'check' | 'transfer' | 'cash' | ''>('')
  const [refSequence, setRefSequence] = useState('')
  const [payeeTin, setPayeeTin] = useState('')

  // Section 2: Multi-Line Accounting Details
  const [sourceAccount, setSourceAccount] = useState('')
  const [lineItems, setLineItems] = useState<DisbursementLineItem[]>([
    { id: '1', accountId: '', description: '', amount: '', isVatable: false }
  ])

  // Section 3: Supporting Info
  const [remarks, setRemarks] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  // UI States
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('')
  const [showAddPayee, setShowAddPayee] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null)
  const [previewAttachments, setPreviewAttachments] = useState<any[] | null>(null)

  // Dynamic Logic based on Payment Method
  const refPrefix =
    paymentMethod === 'check'
      ? 'CV-'
      : paymentMethod === 'transfer'
        ? 'REF-'
        : paymentMethod === 'cash'
          ? 'DV-'
          : ''
  const refLabel =
    paymentMethod === 'check'
      ? 'Check / Voucher No.'
      : paymentMethod === 'transfer'
        ? 'Bank Reference No.'
        : paymentMethod === 'cash'
          ? 'Disbursement Voucher No.'
          : 'Reference No.'

  const loadCashierVouchers = async () => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api || !api.getCashierDisbursements) return
    setLoadingCashier(true)
    try {
      const data = await api.getCashierDisbursements(200)
      setCashierVouchers(data || [])
    } catch (err) {
      console.error('Failed to load cashier disbursements:', err)
    } finally {
      setLoadingCashier(false)
    }
  }

  const loadData = async () => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api) return
    try {
      const accData = await api.getAccounts()
      setExpenseAccounts(
        accData.filter(
          (a: any) =>
            a.account_type?.name === 'Expense' ||
            a.account_type?.name === 'Liability' ||
            a.account_type?.name === 'Asset'
        )
      )
      const assets = accData.filter((a: any) => a.account_type?.name === 'Asset')
      setCashAccounts(assets)

      if (assets.length > 0 && !sourceAccount) {
        setSourceAccount(assets.find((a: any) => a.code === '1010')?.code || assets[0].code)
      }
      if (api.getPayees) setPayees(await api.getPayees())
      if (api.getRecentDisbursements) setRecentVouchers((await api.getRecentDisbursements(5)) || [])
      await loadCashierVouchers()
      await loadHistoricalVouchers()
    } catch (e) {
      console.error(e)
    }
  }

  const loadHistoricalVouchers = async () => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api || !api.getHistoricalDisbursements) return
    setLoadingHistory(true)
    try {
      const data = await api.getHistoricalDisbursements({
        startDate: historyDateFrom || undefined,
        endDate: historyDateTo || undefined,
        voucherType: historyTypeFilter,
        sortOrder: historyDateSort,
        limit: 500
      })
      setHistoryVouchers(data || [])
    } catch (err) {
      console.error('Failed to load historical vouchers:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistoricalVouchers()
    }
  }, [activeTab, historyDateSort, historyTypeFilter, historyDateFrom, historyDateTo])

  const handleAcknowledge = async (voucherId: string) => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api?.acknowledgeCashierDisbursement) return
    setAcknowledgingId(voucherId)
    try {
      const res = await api.acknowledgeCashierDisbursement(voucherId, userId || 'Accountant')
      if (res.success) {
        setStatus({ type: 'success', msg: 'High-value alert acknowledged successfully.' })
        await loadCashierVouchers()
        await loadHistoricalVouchers()
      } else {
        setStatus({ type: 'error', msg: res.error || 'Failed to acknowledge alert.' })
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Failed to acknowledge alert.' })
    } finally {
      setAcknowledgingId(null)
    }
  }

  const cashierMetrics = useMemo(() => {
    const totalAmount = cashierVouchers.reduce((s, v) => s + (Number(v.amount) || 0), 0)
    const highValueList = cashierVouchers.filter((v) => Number(v.amount) > 2000)
    const pendingList = highValueList.filter((v) => !v.isAcknowledged)
    const acknowledgedList = highValueList.filter((v) => v.isAcknowledged)
    const highValueAmount = highValueList.reduce((s, v) => s + (Number(v.amount) || 0), 0)
    return {
      totalCount: cashierVouchers.length,
      totalAmount,
      highValueCount: highValueList.length,
      pendingCount: pendingList.length,
      acknowledgedCount: acknowledgedList.length,
      highValueAmount
    }
  }, [cashierVouchers])

  const filteredCashierVouchers = useMemo(() => {
    const list = cashierVouchers.filter((v) => {
      const isHigh = Number(v.amount) > 2000
      if (highValueOnly && !isHigh) return false
      if (ackFilter === 'pending' && (!isHigh || v.isAcknowledged)) return false
      if (ackFilter === 'acknowledged' && (!isHigh || !v.isAcknowledged)) return false
      if (!cashierSearch.trim()) return true
      const q = cashierSearch.toLowerCase()
      return (
        v.referenceNo?.toLowerCase().includes(q) ||
        v.payeeName?.toLowerCase().includes(q) ||
        v.cashierName?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.expenseAccountName?.toLowerCase().includes(q) ||
        v.expenseAccountCode?.toLowerCase().includes(q)
      )
    })

    return [...list].sort((a, b) => {
      const timeA = new Date(a.date).getTime()
      const timeB = new Date(b.date).getTime()
      return cashierDateSort === 'asc' ? timeA - timeB : timeB - timeA
    })
  }, [cashierVouchers, highValueOnly, ackFilter, cashierSearch, cashierDateSort])

  const filteredHistoryVouchers = useMemo(() => {
    let list = historyVouchers
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      list = list.filter(
        (v) =>
          v.referenceNo?.toLowerCase().includes(q) ||
          v.payeeName?.toLowerCase().includes(q) ||
          v.issuedBy?.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q) ||
          v.typeLabel?.toLowerCase().includes(q) ||
          v.sourceAccountName?.toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      const timeA = new Date(a.date).getTime()
      const timeB = new Date(b.date).getTime()
      return historyDateSort === 'asc' ? timeA - timeB : timeB - timeA
    })
  }, [historyVouchers, historySearch, historyDateSort])

  const historyMetrics = useMemo(() => {
    const totalAmount = filteredHistoryVouchers.reduce((s, v) => s + (Number(v.amount) || 0), 0)
    const checkAmount = filteredHistoryVouchers
      .filter((v) => v.typeLabel === 'CHECK' || v.typeLabel === 'TRANSFER')
      .reduce((s, v) => s + (Number(v.amount) || 0), 0)
    const cashAmount = filteredHistoryVouchers
      .filter((v) => v.typeLabel === 'CASH VOUCHER' || v.typeLabel === 'PETTY CASH')
      .reduce((s, v) => s + (Number(v.amount) || 0), 0)
    return {
      totalCount: filteredHistoryVouchers.length,
      totalAmount,
      checkAmount,
      cashAmount
    }
  }, [filteredHistoryVouchers])

  // Only fetch sequence if a payment method is selected
  useEffect(() => {
    const fetchNextSeq = async () => {
      if (!refPrefix) {
        setRefSequence('')
        return
      }
      try {
        const api = (window as any).api || (window as any).electronAPI
        const nextSeq = await api.getNextSequence(refPrefix)
        setRefSequence(nextSeq)
      } catch (error) {
        console.error(error)
      }
    }
    fetchNextSeq()
  }, [refPrefix, status])

  // Multi-Line Item Actions
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        accountId: prev[prev.length - 1]?.accountId || '',
        description: '',
        amount: '',
        isVatable: false
      }
    ])
  }

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) return
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateLineItem = (id: string, field: keyof DisbursementLineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  // Live Multi-Line Calculations
  const { lineCalculations, totalNetExpense, totalInputVat, totalCashOut, hasVatableLine } =
    useMemo(() => {
      let netSum = 0
      let vatSum = 0
      let grossSum = 0
      let hasVat = false

      const lines = lineItems.map((item) => {
        const lineAmt = Number(item.amount) || 0
        let net = lineAmt
        let vat = 0
        if (item.isVatable && lineAmt > 0) {
          hasVat = true
          net = Number((lineAmt / 1.12).toFixed(2))
          vat = Number((lineAmt - net).toFixed(2))
        }
        netSum += net
        vatSum += vat
        grossSum += lineAmt
        return {
          ...item,
          lineAmt,
          net,
          vat
        }
      })

      return {
        lineCalculations: lines,
        totalNetExpense: Number(netSum.toFixed(2)),
        totalInputVat: Number(vatSum.toFixed(2)),
        totalCashOut: Number(grossSum.toFixed(2)),
        hasVatableLine: hasVat
      }
    }, [lineItems])

  const formatCurrency = (val: number) =>
    `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments([...attachments, ...Array.from(e.target.files)])
  }

  const removeFile = (index: number) => setAttachments(attachments.filter((_, i) => i !== index))

  // Compress image before saving (preserves white background for transparent PNGs)
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
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.85))
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

  const processAttachments = async () => {
    return Promise.all(
      attachments.map(async (file) => {
        const compressedData = await compressImage(file)
        return {
          name: file.name,
          fileName: file.name,
          type: file.type || 'image/jpeg',
          fileType: file.type || 'image/jpeg',
          size: file.size,
          data: compressedData,
          fileData: compressedData
        }
      })
    )
  }

  const handleAttachToExistingVoucher = async (voucherId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const compressedData = await compressImage(file)
      const api = (window as any).api || (window as any).electronAPI
      if (api?.updateDisbursementAttachment) {
        const res = await api.updateDisbursementAttachment(voucherId, {
          name: file.name,
          type: file.type || 'image/jpeg',
          data: compressedData
        })
        if (res?.success) {
          await loadHistoricalVouchers()
          await loadCashierVouchers()
          await loadData()
          setStatus({ type: 'success', msg: 'Receipt photo attached successfully!' })
        } else {
          setStatus({ type: 'error', msg: res?.error || 'Failed to attach photo.' })
        }
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: `Failed to attach receipt: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handlePreviewFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewAttachment({
        name: file.name,
        data: e.target?.result as string,
        type: file.type
      })
    }
    reader.readAsDataURL(file)
  }

  const executeSubmit = async () => {
    setShowConfirmModal(false)
    setStatus(null)
    setLoading(true)

    try {
      const lines: Array<{ accountId: string; debit: number; credit: number }> = []

      // 1. Add Debits for each line item (Net of VAT)
      lineCalculations.forEach((item) => {
        if (item.net > 0 && item.accountId) {
          lines.push({ accountId: item.accountId, debit: item.net, credit: 0 })
        }
      })

      // 2. Add single consolidated 12% Input VAT debit if any line is VATable
      if (totalInputVat > 0) {
        lines.push({ accountId: '1300', debit: totalInputVat, credit: 0 })
      }

      // 3. Add Credit to Source Bank/Cash Account for Gross Total
      lines.push({ accountId: sourceAccount, debit: 0, credit: totalCashOut })

      const api = (window as any).api || (window as any).electronAPI
      if (hasVatableLine && payeeTin.trim()) {
        await api.updatePayeeTin(payeeId, payeeTin.trim())
      }

      const selectedPayee = payees.find((p) => p.id === payeeId)
      const lineDetails = lineItems
        .filter((l) => l.description.trim())
        .map((l) => l.description.trim())
        .join(', ')

      const finalRemarks = remarks.trim()
        ? `${remarks}${lineDetails ? ` | ${lineDetails}` : ''}`
        : lineDetails || 'Operating Disbursement'

      const description = `Disbursement to ${selectedPayee?.name || 'Supplier'} - ${finalRemarks}${
        hasVatableLine ? ' [VATABLE]' : ''
      }`
      const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`

      // Process attachments before submitting
      const processedAttachments = await processAttachments()

      const result = await api.submitJournalEntry({
        date: new Date(date).toISOString(),
        referenceNo: fullReferenceNo,
        description: description,
        vatType: hasVatableLine ? 'VATABLE' : 'EXEMPT',
        userId,
        payeeId,
        lines,
        attachments: processedAttachments
      })

      if (result.success) {
        setStatus({
          type: 'success',
          msg: `Payment voucher ${fullReferenceNo} issued successfully for ${formatCurrency(totalCashOut)}!`
        })
        setLineItems([{ id: '1', accountId: '', description: '', amount: '', isVatable: false }])
        setRemarks('')
        setAttachments([])
        setPayeeTin('')
        setPayeeId('')
        setPaymentMethod('')
        loadData()
        setTimeout(() => setStatus(null), 5000)
      } else {
        setStatus({ type: 'error', msg: result.error })
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Failed to process disbursement.' })
    } finally {
      setLoading(false)
    }
  }

  // Validations
  const isFormValid =
    totalCashOut > 0 &&
    lineItems.length > 0 &&
    lineItems.every((item) => item.accountId && Number(item.amount) > 0) &&
    sourceAccount &&
    payeeId &&
    refSequence &&
    paymentMethod !== ''

  // Lookups for Display
  const selectedPayee = payees.find((p) => p.id === payeeId)
  const selectedSourceData = cashAccounts.find((a) => a.code === sourceAccount)

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">
      {/* Global Overlay */}
      {isPayeeDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsPayeeDropdownOpen(false)}></div>
      )}

      <div className="mb-6 flex justify-between items-center pb-4 border-b border-[#B0DCDA]">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2.5">
            Cash Disbursements
            <span className="bg-emerald-50 text-[#1B9387] border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              {activeTab === 'cdv'
                ? 'CDV Check & Transfer'
                : activeTab === 'cashier-audit'
                  ? 'Cashier Petty Cash Audit'
                  : 'Voucher History & Register'}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {activeTab === 'cdv'
              ? 'Issue checks, bank transfers, or official vouchers with single or multiple expense distributions.'
              : activeTab === 'cashier-audit'
                ? 'Audit cashier petty cash disbursements, monitor high-value alerts (> ₱2,000), and inspect receipt photos.'
                : 'Browse, sort by date, filter, and audit all historical vouchers issued across CDV and Petty Cash.'}
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          title="Refresh Data"
          className="p-2.5 bg-white border border-gray-200 hover:border-[#B0DCDA] rounded-xl text-gray-600 hover:text-[#1B9387] shadow-2xs transition cursor-pointer"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* TOP TABS */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('cdv')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer border ${
            activeTab === 'cdv'
              ? 'bg-[#1B9387] text-white border-[#1B9387] shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-[#FBF8F8]'
          }`}
        >
          <Receipt size={16} />
          Cash Disbursement Voucher (CDV)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('cashier-audit')
            loadCashierVouchers()
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer border ${
            activeTab === 'cashier-audit'
              ? 'bg-[#1B9387] text-white border-[#1B9387] shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-[#FBF8F8]'
          }`}
        >
          <ShieldAlert size={16} />
          Cashier Petty Cash Audit & Alerts
          {cashierMetrics.pendingCount > 0 ? (
            <span className="ml-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-xs">
              {cashierMetrics.pendingCount} Pending {cashierMetrics.pendingCount === 1 ? 'Alert' : 'Alerts'}
            </span>
          ) : cashierMetrics.acknowledgedCount > 0 ? (
            <span className="ml-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              ✓ All Reviewed
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('history')
            loadHistoricalVouchers()
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer border ${
            activeTab === 'history'
              ? 'bg-[#1B9387] text-white border-[#1B9387] shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-[#FBF8F8]'
          }`}
        >
          <History size={16} />
          Voucher History & Register
          <span className="ml-1 bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-gray-200">
            {historyVouchers.length}
          </span>
        </button>
      </div>

      {activeTab === 'cdv' && (
      <div className="flex flex-col lg:flex-row items-start gap-8">
        {/* LEFT SIDE: MAIN FORM */}
        <div className="flex-1 w-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm relative overflow-hidden">
          <div className="bg-[#FBF8F8] border-b border-[#B0DCDA] px-8 py-5 flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16} className="text-[#1B9387]" />
              New Disbursement Voucher
            </h3>
            <span className="bg-rose-50 text-rose-600 text-[10px] px-3 py-1.5 rounded-md font-extrabold uppercase tracking-widest border border-rose-200">
              💸 Cash Outflow
            </span>
          </div>

          {status && (
            <div
              className={`m-8 mb-0 p-4 rounded-md text-sm font-bold shadow-sm border ${
                status.type === 'success'
                  ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}
            >
              {status.type === 'success' ? '✅ ' : '⚠️ '}
              {status.msg}
            </div>
          )}

          <form
            className="p-8 space-y-8"
            onSubmit={(e) => {
              e.preventDefault()
              if (isFormValid) setShowConfirmModal(true)
            }}
          >
            {/* ① PAYMENT INFORMATION */}
            <section>
              <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
                ① Payment Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm"
                  />
                </div>

                <div className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                      Payee / Vendor (Mandatory)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddPayee(true)}
                      className="text-[10px] font-bold text-[#1B9387] hover:underline cursor-pointer"
                    >
                      + Add New Payee
                    </button>
                  </div>
                  <div
                    onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm flex justify-between items-center"
                  >
                    <span>{selectedPayee ? selectedPayee.name : '-- Select Payee --'}</span>
                    <span className="text-xs text-gray-400">▼</span>
                  </div>

                  {isPayeeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-lg z-20 max-h-60 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-100 bg-[#FBF8F8]">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type to search..."
                          value={payeeSearchQuery}
                          onChange={(e) => setPayeeSearchQuery(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded p-2 text-xs text-gray-800 outline-none focus:border-[#1B9387]"
                        />
                      </div>
                      <ul className="overflow-y-auto flex-1">
                        <li
                          onClick={() => {
                            setPayeeId('')
                            setPayeeTin('')
                            setIsPayeeDropdownOpen(false)
                            setPayeeSearchQuery('')
                          }}
                          className="p-3 text-xs text-gray-400 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-bold"
                        >
                          -- Clear Selection --
                        </li>
                        {payees
                          .filter((p) =>
                            p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase())
                          )
                          .map((p) => (
                            <li
                              key={p.id}
                              onClick={() => {
                                setPayeeId(p.id)
                                setPayeeTin(p.tin || '')
                                setIsPayeeDropdownOpen(false)
                                setPayeeSearchQuery('')
                              }}
                              className="p-3 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-50 flex justify-between items-center"
                            >
                              <div>
                                {p.name}
                                {p.tin && (
                                  <span className="block text-[10px] text-gray-400 font-mono font-normal mt-0.5">
                                    TIN: {p.tin}
                                  </span>
                                )}
                              </div>
                              {p.youOwe > 0 && (
                                <span className="text-xs text-orange-500 font-mono">
                                  {formatCurrency(p.youOwe)}
                                </span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Payment Method
                  </label>
                  <select
                    required
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm"
                  >
                    <option value="" disabled className="text-gray-400 font-normal">
                      -- Select Method --
                    </option>
                    <option value="check">Check (CV-)</option>
                    <option value="transfer">Bank Transfer (REF-)</option>
                    <option value="cash">Cash Voucher (DV-)</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    {refLabel}
                  </label>
                  <div className="flex shadow-sm">
                    <span
                      className={`bg-[#FBF8F8] border border-[#B0DCDA] border-r-0 rounded-l-md px-4 py-3 text-sm font-extrabold select-none ${
                        paymentMethod ? 'text-gray-500' : 'text-gray-300'
                      }`}
                    >
                      {refPrefix || 'XXX-'}
                    </span>
                    <input
                      type="text"
                      required
                      disabled={!paymentMethod}
                      value={refSequence}
                      onChange={(e) => setRefSequence(e.target.value)}
                      placeholder={paymentMethod ? '001' : 'Select method first'}
                      className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-3 text-sm font-mono font-bold text-[#1B9387] focus:border-[#1B9387] outline-none transition disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ② ACCOUNTING DETAILS (MULTI-LINE EXPENSE DISTRIBUTION) */}
            <section>
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                <div>
                  <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-widest">
                    ② Accounting Details & Expense Distribution
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Select the source bank account, then distribute the debit amount across one or multiple expense accounts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Lines: {lineItems.length}
                  </span>
                </div>
              </div>

              {/* Source Account (Credit) */}
              <div className="mb-6 max-w-md">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  Source of Funds (Credit Asset)
                </label>
                <select
                  required
                  value={sourceAccount}
                  onChange={(e) => setSourceAccount(e.target.value)}
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm"
                >
                  {cashAccounts.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                    Expense / Debit Distribution Lines
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-extrabold text-[#1B9387] hover:text-[#15796f] flex items-center gap-1.5 bg-[#E9FAFA] border border-[#B0DCDA] px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Add Expense Line</span>
                  </button>
                </div>

                <div className="border border-[#B0DCDA] rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FBF8F8] border-b border-[#B0DCDA] text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Account to Debit</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Line Description / Purpose</th>
                        <th className="py-2.5 px-3 w-36 text-right">Amount (₱)</th>
                        <th className="py-2.5 px-3 w-28 text-center">12% VAT?</th>
                        <th className="py-2.5 px-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {lineItems.map((item, idx) => {
                        const lineCalc = lineCalculations[idx]
                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition">
                            <td className="py-3 px-3 text-center text-xs font-bold text-gray-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <select
                                required
                                value={item.accountId}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, 'accountId', e.target.value)
                                }
                                className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-lg p-2 text-xs font-bold text-gray-800 focus:border-[#1B9387] outline-none"
                              >
                                <option value="" disabled className="text-gray-400 font-normal">
                                  -- Select Account --
                                </option>
                                {expenseAccounts.map((acc) => (
                                  <option key={acc.code} value={acc.code}>
                                    {acc.code} - {acc.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, 'description', e.target.value)
                                }
                                placeholder="e.g. Office rent portion, water delivery"
                                className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-lg p-2 text-xs text-gray-800 focus:border-[#1B9387] outline-none"
                              />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                value={item.amount}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value)
                                  handleUpdateLineItem(
                                    item.id,
                                    'amount',
                                    isNaN(val) ? '' : Math.abs(val)
                                  )
                                }}
                                placeholder="0.00"
                                className="w-full bg-white border border-[#B0DCDA] rounded-lg p-2 text-xs font-mono font-bold text-right text-gray-800 focus:border-[#1B9387] outline-none"
                              />
                              {item.isVatable && lineCalc && lineCalc.lineAmt > 0 && (
                                <span className="block text-[9px] font-mono text-gray-400 text-right mt-0.5">
                                  Net: {formatCurrency(lineCalc.net)} | VAT: {formatCurrency(lineCalc.vat)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.isVatable}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'isVatable', e.target.checked)
                                  }
                                  className="w-4 h-4 text-[#1B9387] border-gray-300 rounded focus:ring-[#1B9387]"
                                />
                                <span className="text-[11px] font-bold text-gray-600">VAT</span>
                              </label>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                disabled={lineItems.length <= 1}
                                onClick={() => handleRemoveLineItem(item.id)}
                                title="Remove line"
                                className="p-1.5 text-gray-400 hover:text-rose-600 disabled:opacity-20 disabled:hover:text-gray-400 rounded transition cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-bold text-[#1B9387] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>+ Add Another Distribution Line</span>
                  </button>

                  <div className="text-right">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mr-2">
                      Total Check Amount:
                    </span>
                    <span className="text-base font-black font-mono text-[#1B9387]">
                      {formatCurrency(totalCashOut)}
                    </span>
                  </div>
                </div>
              </div>

              {/* TIN Requirement when any line is VATable */}
              {hasVatableLine && (
                <div className="mt-6 p-4 bg-[#E9FAFA] border border-[#B0DCDA] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-[#1B9387] text-white p-2 rounded-lg">
                      <Receipt size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-800 block">
                        VAT Substantiation Required (BIR NIRC Sec. 113)
                      </span>
                      <p className="text-[10px] text-gray-500 font-medium">
                        At least one line item is marked as VATable. Enter the Supplier’s TIN to claim 12% Input VAT.
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-64">
                    <input
                      type="text"
                      required
                      placeholder="Supplier TIN (e.g. 123-456-789-000)"
                      value={payeeTin}
                      onChange={(e) => setPayeeTin(e.target.value)}
                      className="w-full bg-white border border-[#B0DCDA] rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 outline-none focus:border-[#1B9387]"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ③ SUPPORTING INFORMATION */}
            <section>
              <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
                ③ Supporting Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Overall Voucher Remarks / Particulars
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="e.g. Full settlement for Invoice #8821, combined rent and water"
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Supporting Documents / Scanned Invoices
                  </label>
                  <label className="w-full flex items-center justify-center bg-[#FBF8F8] border border-dashed border-[#B0DCDA] hover:bg-[#E9FAFA] hover:border-[#1B9387] rounded-md p-4 text-sm font-bold text-[#1B9387] cursor-pointer transition h-14">
                    📎 Attach Receipt / Invoice
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                    />
                  </label>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((f, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center bg-white border border-gray-200 rounded p-2 text-xs shadow-2xs hover:border-[#1B9387] transition group"
                        >
                          <span
                            onClick={() => handlePreviewFile(f)}
                            className="truncate max-w-[200px] text-gray-700 font-bold hover:text-[#1B9387] cursor-pointer flex items-center gap-1.5"
                            title="Click to preview file"
                          >
                            📎 {f.name}
                            <Eye size={12} className="text-gray-400 group-hover:text-[#1B9387]" />
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="text-gray-400 hover:text-red-500 font-bold px-2 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* PAYMENT SUMMARY & SUBMIT */}
            <div className="border-t-2 border-gray-800 pt-6">
              <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 text-center">
                Voucher Accounting Distribution Summary
              </h4>

              <div className="bg-[#FBF8F8] rounded-xl p-5 mb-6 shadow-inner border border-gray-200 max-w-lg mx-auto">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 font-medium">Vendor / Payee:</span>{' '}
                  <span className="font-bold text-gray-800 truncate w-48 text-right">
                    {selectedPayee?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 font-medium">Source Account (Credit):</span>{' '}
                  <span className="font-bold text-gray-800 truncate w-48 text-right">
                    {selectedSourceData
                      ? `${selectedSourceData.code} - ${selectedSourceData.name}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 font-medium">Distribution Lines:</span>{' '}
                  <span className="font-mono font-bold text-gray-800">{lineItems.length} debits</span>
                </div>

                {/* VAT Summary explicitly surfaced before hitting Submit */}
                {hasVatableLine && totalCashOut > 0 && (
                  <>
                    <div className="border-t border-dashed border-gray-300 my-2"></div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500 font-medium">Net Purchases / Expenses:</span>{' '}
                      <span className="font-bold text-gray-800">
                        {formatCurrency(totalNetExpense)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[#1B9387] font-medium">Input VAT (12%):</span>{' '}
                      <span className="font-bold text-[#1B9387]">
                        {formatCurrency(totalInputVat)}
                      </span>
                    </div>
                  </>
                )}

                <div className="border-t border-dashed border-gray-300 my-3"></div>
                <div className="flex justify-between text-lg font-black text-gray-800">
                  <span className="uppercase tracking-widest">Total Check / Outflow</span>{' '}
                  <span className="font-mono text-[#1B9387]">{formatCurrency(totalCashOut)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormValid || loading}
                className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition shadow-md flex justify-center items-center space-x-2 text-sm ${
                  isFormValid
                    ? 'bg-[#1B9387] hover:bg-[#28958B] text-white cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border border-gray-300'
                }`}
              >
                {loading
                  ? 'Processing...'
                  : isFormValid
                    ? `💸 Issue Disbursement Voucher — ${formatCurrency(totalCashOut)}`
                    : 'Complete Required Fields to Issue'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE: RECENT ACTIVITY */}
        <div className="w-full lg:w-96 flex flex-col space-y-4 sticky top-6">
          <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-[#B0DCDA] pb-3 mb-4">
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={15} className="text-[#1B9387]" />
                Recent Disbursements
              </h3>
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                {recentVouchers.length} Recent
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1">
              {recentVouchers.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center mt-8">
                  No recent disbursements found.
                </p>
              ) : (
                recentVouchers.map((v: any, i: number) => (
                  <div
                    key={i}
                    className="bg-[#FBF8F8] border border-[#B0DCDA]/60 rounded-lg p-4 shadow-sm hover:border-[#1B9387] transition cursor-pointer group"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono font-extrabold text-[#1B9387] group-hover:underline">
                        {v.referenceNo}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">
                        {new Date(v.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-gray-800 truncate mb-1">
                      {v.payeeName || 'Unknown Vendor'}
                    </p>
                    <div className="flex justify-between items-end mt-3 border-t border-gray-200 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center">
                          ✓ ISSUED
                        </span>
                        {v.attachments && v.attachments.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewAttachments(
                                v.attachments.map((a: any) => ({
                                  ...a,
                                  entryId: v.id
                                }))
                              )
                            }}
                            className="text-[10px] text-[#1B9387] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                            title="Preview receipt"
                          >
                            <Eye size={11} />
                            <span>Attachment ({v.attachments.length})</span>
                          </button>
                        )}
                      </div>
                      <span className="text-base font-mono font-black text-rose-600">
                        {formatCurrency(v.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* TAB 2: CASHIER PETTY CASH AUDIT & ALERTS */}
      {activeTab === 'cashier-audit' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                Total Petty Cash Disbursed
              </span>
              <div className="text-2xl font-black text-gray-800 font-mono">
                {formatCurrency(cashierMetrics.totalAmount)}
              </div>
              <span className="text-xs text-gray-500 font-medium mt-1 block">
                {cashierMetrics.totalCount} total cashier vouchers logged
              </span>
            </div>

            <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                Audited Cashier Vouchers
              </span>
              <div className="text-2xl font-black text-[#1B9387] font-mono">
                {cashierMetrics.totalCount}
              </div>
              <span className="text-xs text-gray-500 font-medium mt-1 block">
                Petty Cash Fund (1020) & Cash in Hand (1030)
              </span>
            </div>

            <div
              className={`rounded-xl p-5 shadow-sm border ${
                cashierMetrics.pendingCount > 0
                  ? 'bg-amber-50/60 border-amber-300'
                  : cashierMetrics.highValueCount > 0
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-white border-[#B0DCDA]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    cashierMetrics.pendingCount > 0 ? 'text-amber-800' : 'text-gray-400'
                  }`}
                >
                  High-Value Alerts (&gt; ₱2,000)
                </span>
                {cashierMetrics.pendingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                    <AlertTriangle size={12} /> {cashierMetrics.pendingCount} Pending
                  </span>
                ) : cashierMetrics.highValueCount > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    <CheckCircle size={12} /> All Reviewed
                  </span>
                ) : null}
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  cashierMetrics.pendingCount > 0 ? 'text-amber-900' : 'text-gray-800'
                }`}
              >
                {cashierMetrics.highValueCount}
              </div>
              <span
                className={`text-xs font-medium mt-1 block ${
                  cashierMetrics.pendingCount > 0 ? 'text-amber-700' : 'text-gray-500'
                }`}
              >
                {cashierMetrics.pendingCount > 0
                  ? `${cashierMetrics.pendingCount} pending review (${formatCurrency(cashierMetrics.highValueAmount)} total)`
                  : `All ${cashierMetrics.acknowledgedCount} alerts reviewed and acknowledged`}
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white border border-[#B0DCDA] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={cashierSearch}
                onChange={(e) => setCashierSearch(e.target.value)}
                placeholder="Search reference #, cashier, payee..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] rounded-lg text-xs font-bold text-gray-800 placeholder-gray-400 focus:border-[#1B9387] outline-none transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-100/60 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setHighValueOnly(false)
                    setAckFilter('all')
                  }}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                    !highValueOnly && ackFilter === 'all'
                      ? 'bg-white shadow-2xs text-[#1B9387]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({cashierMetrics.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHighValueOnly(true)
                    setAckFilter('pending')
                  }}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    highValueOnly && ackFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  <AlertTriangle size={12} />
                  Pending Alerts ({cashierMetrics.pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHighValueOnly(true)
                    setAckFilter('all')
                  }}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                    highValueOnly && ackFilter === 'all'
                      ? 'bg-white shadow-2xs text-gray-800'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All &gt; ₱2k ({cashierMetrics.highValueCount})
                </button>
              </div>

              <button
                type="button"
                onClick={loadCashierVouchers}
                title="Reload cashier disbursements"
                className="p-2.5 bg-[#FBF8F8] hover:bg-[#E9FAFA] text-gray-600 hover:text-[#1B9387] border border-[#B0DCDA] rounded-lg transition cursor-pointer"
              >
                <RefreshCw size={15} className={loadingCashier ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Audit Data Table */}
          <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#FBF8F8] border-b border-[#B0DCDA] px-6 py-4 flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={16} className="text-[#1B9387]" />
                Cashier Petty Cash Vouchers ({filteredCashierVouchers.length})
              </h3>
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Audited via General Ledger & Attachments
              </span>
            </div>

            {loadingCashier ? (
              <div className="p-12 text-center text-sm font-bold text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#1B9387]" />
                Loading Cashier Disbursements...
              </div>
            ) : filteredCashierVouchers.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">
                {highValueOnly
                  ? 'No high-value cashier disbursements exceeding ₱2,000 found.'
                  : cashierSearch
                    ? 'No cashier disbursements matched your search query.'
                    : 'No cashier disbursements found.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500">
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none transition"
                        onClick={() => setCashierDateSort(cashierDateSort === 'desc' ? 'asc' : 'desc')}
                        title={`Click to sort by date (${cashierDateSort === 'desc' ? 'Newest first' : 'Oldest first'})`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Date & Ref #</span>
                          {cashierDateSort === 'desc' ? (
                            <ArrowDown size={13} className="text-[#1B9387]" />
                          ) : (
                            <ArrowUp size={13} className="text-[#1B9387]" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4">Cashier</th>
                      <th className="py-3 px-4">Payee / Vendor</th>
                      <th className="py-3 px-4">Account & Description</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Receipt Photo</th>
                      <th className="py-3 px-4 text-center">Audit Status & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredCashierVouchers.map((v: any) => {
                      const isHighValue = Number(v.amount) > 2000
                      const hasAttachment = v.attachments && v.attachments.length > 0
                      return (
                        <tr
                          key={v.id}
                          className={`transition ${
                            isHighValue
                              ? v.isAcknowledged
                                ? 'bg-emerald-50/20 hover:bg-emerald-50/40 border-l-4 border-l-emerald-400'
                                : 'bg-amber-50/50 hover:bg-amber-100/40 border-l-4 border-l-amber-500'
                              : 'hover:bg-gray-50/80 border-l-4 border-l-transparent'
                          }`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono font-black text-gray-800 flex items-center gap-1.5">
                              {v.referenceNo}
                              {isHighValue && !v.isAcknowledged && (
                                <span
                                  title="Disbursement exceeds ₱2,000 threshold"
                                  className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-300"
                                >
                                  <AlertTriangle size={10} className="text-amber-600" /> &gt; ₱2,000 Alert
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {new Date(v.date).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded text-[11px]">
                              {v.cashierName || 'Cashier'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-gray-900 block truncate max-w-[200px]">
                              {v.payeeName || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#1B9387] block text-[11px]">
                              {v.expenseAccountCode ? `${v.expenseAccountCode} - ` : ''}
                              {v.expenseAccountName || 'Expense'}
                            </span>
                            <span className="text-gray-500 text-[11px] block truncate max-w-[280px]">
                              {v.description || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span
                              className={`font-mono font-black text-sm ${
                                isHighValue ? 'text-amber-800 font-extrabold' : 'text-gray-800'
                              }`}
                            >
                              {formatCurrency(v.amount)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {hasAttachment ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewAttachments(
                                    v.attachments.map((a: any) => ({
                                      ...a,
                                      entryId: v.id
                                    }))
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E9FAFA] hover:bg-[#1B9387] text-[#1B9387] hover:text-white rounded-lg text-xs font-bold transition cursor-pointer border border-[#B0DCDA]"
                              >
                                <Eye size={13} />
                                View Receipt ({v.attachments.length})
                              </button>
                            ) : (
                              <span className="text-[11px] text-rose-500 font-bold bg-rose-50 border border-rose-200 px-2 py-1 rounded-md">
                                Missing Photo
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isHighValue ? (
                              v.isAcknowledged ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-300">
                                    <CheckCircle size={12} className="text-emerald-600" /> Acknowledged
                                  </span>
                                  {v.acknowledgedInfo && (
                                    <span
                                      className="text-[9px] text-gray-400 mt-0.5 max-w-[150px] truncate"
                                      title={v.acknowledgedInfo}
                                    >
                                      {v.acknowledgedInfo}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAcknowledge(v.id)}
                                  disabled={acknowledgingId === v.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                                  title="Acknowledge and mark this disbursement as reviewed"
                                >
                                  <CheckCircle size={13} />
                                  <span>
                                    {acknowledgingId === v.id ? 'Saving...' : 'Acknowledge Alert'}
                                  </span>
                                </button>
                              )
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                Standard (&lt; ₱2k)
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in">
          {/* TOP METRICS SUMMARY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Total Disbursed (Filtered)
                </span>
                <span className="p-2 bg-[#E9FAFA] text-[#1B9387] rounded-lg">
                  <Receipt size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900 font-mono">
                {formatCurrency(historyMetrics.totalAmount)}
              </div>
              <p className="text-[11px] font-semibold text-gray-400 mt-1">
                {historyMetrics.totalCount} Vouchers Found
              </p>
            </div>

            <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                  Checks & Transfers
                </span>
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-blue-800 font-mono">
                {formatCurrency(historyMetrics.checkAmount)}
              </div>
              <p className="text-[11px] font-semibold text-gray-400 mt-1">
                Series: CV- (Checks) & REF- (Transfers)
              </p>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  Cash & Petty Cash
                </span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <History size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-800 font-mono">
                {formatCurrency(historyMetrics.cashAmount)}
              </div>
              <p className="text-[11px] font-semibold text-gray-400 mt-1">
                Series: CDV- (Accountant) & PCV- (Cashier)
              </p>
            </div>

            <div className="bg-white border border-purple-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">
                  Date Sorting Order
                </span>
                <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <ArrowUpDown size={16} />
                </span>
              </div>
              <div className="text-sm font-black text-purple-900 mt-1 flex items-center gap-1.5">
                {historyDateSort === 'desc' ? (
                  <>
                    <ArrowDown size={16} className="text-purple-600" />
                    <span>Newest First (Descending)</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={16} className="text-purple-600" />
                    <span>Oldest First (Ascending)</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHistoryDateSort(historyDateSort === 'desc' ? 'asc' : 'desc')}
                className="mt-2 text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline cursor-pointer flex items-center gap-1"
              >
                Switch to {historyDateSort === 'desc' ? 'Oldest First ▲' : 'Newest First ▼'}
              </button>
            </div>
          </div>

          {/* SEARCH, DATE RANGE, & TYPE FILTERS TOOLBAR */}
          <div className="bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by Ref # (e.g. CV-001, PCV-001), payee, issued by, notes..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-[#1B9387] outline-none transition"
                />
              </div>

              {/* Date Range Picker */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-[10px] font-black uppercase text-gray-500">From</span>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-[10px] font-black uppercase text-gray-500">To</span>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer"
                  />
                </div>

                {(historyDateFrom || historyDateTo || historySearch || historyTypeFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryDateFrom('')
                      setHistoryDateTo('')
                      setHistorySearch('')
                      setHistoryTypeFilter('ALL')
                    }}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
                    title="Reset all filters"
                  >
                    Clear Filters
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadHistoricalVouchers}
                  className="p-2 text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA] border border-gray-200 rounded-lg transition cursor-pointer"
                  title="Refresh Register"
                >
                  <RefreshCw size={15} className={loadingHistory ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Voucher Type Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
                <Filter size={12} /> Voucher Type:
              </span>
              {[
                { id: 'ALL', label: 'All Series' },
                { id: 'CDV', label: 'CDV (Accountant Cash)' },
                { id: 'PCV', label: 'PCV (Petty Cash)' },
                { id: 'CV', label: 'CV (Bank Checks)' },
                { id: 'REF', label: 'REF (Bank Transfers)' },
                { id: 'DV', label: 'DV (Disbursements)' }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setHistoryTypeFilter(pill.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                    historyTypeFilter === pill.id
                      ? 'bg-[#1B9387] text-white border-[#1B9387] shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* VOUCHER REGISTER TABLE */}
          <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50/50 border-b border-[#B0DCDA] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#1B9387]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                  Historical Disbursement Voucher Register ({filteredHistoryVouchers.length})
                </h3>
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                Sorted by Date:
                <button
                  type="button"
                  onClick={() => setHistoryDateSort(historyDateSort === 'desc' ? 'asc' : 'desc')}
                  className="font-black text-[#1B9387] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  {historyDateSort === 'desc' ? 'Descending ▼' : 'Ascending ▲'}
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-sm font-bold text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#1B9387]" />
                Loading Historical Vouchers...
              </div>
            ) : filteredHistoryVouchers.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">
                {historySearch || historyDateFrom || historyDateTo || historyTypeFilter !== 'ALL'
                  ? 'No historical vouchers matched your filter criteria.'
                  : 'No historical vouchers found in system.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500">
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none transition"
                        onClick={() => setHistoryDateSort(historyDateSort === 'desc' ? 'asc' : 'desc')}
                        title={`Click to sort by date (${historyDateSort === 'desc' ? 'Newest first' : 'Oldest first'})`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Date</span>
                          {historyDateSort === 'desc' ? (
                            <ArrowDown size={13} className="text-[#1B9387]" />
                          ) : (
                            <ArrowUp size={13} className="text-[#1B9387]" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4">Ref #</th>
                      <th className="py-3 px-4">Type & Source</th>
                      <th className="py-3 px-4">Issued By</th>
                      <th className="py-3 px-4">Payee / Vendor</th>
                      <th className="py-3 px-4">Particulars / Description</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredHistoryVouchers.map((v: any) => {
                      const hasAttachment = v.attachments && v.attachments.length > 0
                      const refStr = v.referenceNo || ''
                      let badgeStyle = 'bg-gray-100 text-gray-800 border-gray-300'
                      if (refStr.startsWith('CV-')) {
                        badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200'
                      } else if (refStr.startsWith('REF-')) {
                        badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200'
                      } else if (refStr.startsWith('PCV-')) {
                        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200'
                      } else if (refStr.startsWith('DV-') || refStr.startsWith('CDV-')) {
                        badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }

                      return (
                        <tr key={v.id} className="hover:bg-gray-50/80 transition">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-gray-700">
                              {new Date(v.date).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block font-mono font-black text-xs px-2.5 py-1 rounded-md border ${badgeStyle}`}
                            >
                              {v.referenceNo}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-gray-800 block text-[11px]">
                              {v.typeLabel || 'Disbursement'}
                            </span>
                            <span className="text-[10px] text-gray-400 block truncate max-w-[150px]">
                              {v.sourceAccountName || v.paymentMethod || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                              {v.issuedBy || 'System'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-gray-900 block truncate max-w-[180px]">
                              {v.payeeName || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="text-gray-600 block text-[11px] truncate max-w-[260px]">
                              {v.description || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-sm text-gray-900">
                              {formatCurrency(v.amount)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {hasAttachment ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewAttachments(
                                    v.attachments.map((a: any) => ({
                                      ...a,
                                      entryId: v.id
                                    }))
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#E9FAFA] text-[#1B9387] border border-[#B0DCDA] rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                title="Inspect receipt attachment"
                              >
                                <Eye size={12} />
                                <span>View ({v.attachments.length})</span>
                              </button>
                            ) : (
                              <label
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-[#E9FAFA] text-gray-500 hover:text-[#1B9387] border border-dashed border-gray-300 hover:border-[#1B9387] rounded-lg text-[11px] font-bold transition cursor-pointer"
                                title="Attach receipt photo to this voucher"
                              >
                                <Upload size={12} />
                                <span>Attach</span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                                  className="hidden"
                                  onChange={(e) => handleAttachToExistingVoucher(v.id, e)}
                                />
                              </label>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#B0DCDA]">
            <div className="bg-[#1B9387] p-5 text-center text-white">
              <h2 className="text-xl font-black uppercase tracking-widest">Confirm Disbursement</h2>
              <p className="text-sm font-medium mt-1 text-[#E9FAFA]">
                Review accounting distributions before posting to General Ledger.
              </p>
            </div>
            <div className="p-6 space-y-4 text-sm font-medium text-gray-600">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Vendor / Payee:</span>{' '}
                <span className="font-bold text-gray-800">{selectedPayee?.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Source of Funds:</span>{' '}
                <span className="font-bold text-gray-800 truncate max-w-[220px] text-right">
                  {selectedSourceData?.code} - {selectedSourceData?.name}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>{refLabel}:</span>{' '}
                <span className="font-mono font-bold text-gray-800">
                  {refPrefix}
                  {refSequence.padStart(3, '0')}
                </span>
              </div>

              {/* Itemized Distributions */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 max-h-48 overflow-y-auto">
                <span className="text-[10px] font-extrabold uppercase text-gray-400 block mb-2 tracking-wider">
                  Debit Distribution Lines ({lineItems.length}):
                </span>
                <div className="space-y-1.5 font-mono text-xs">
                  {lineCalculations.map((item, idx) => {
                    const accObj = expenseAccounts.find((a) => a.code === item.accountId)
                    return (
                      <div key={idx} className="flex justify-between items-center text-gray-700">
                        <span className="truncate max-w-[260px]">
                          {item.accountId} {accObj ? `(${accObj.name})` : ''}
                          {item.description ? ` - ${item.description}` : ''}
                        </span>
                        <span className="font-bold">{formatCurrency(item.net)}</span>
                      </div>
                    )
                  })}
                  {totalInputVat > 0 && (
                    <div className="flex justify-between items-center text-[#1B9387] pt-1 border-t border-gray-200">
                      <span>1300 (Input VAT 12%)</span>
                      <span className="font-bold">{formatCurrency(totalInputVat)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#FBF8F8] p-4 rounded-lg mt-2 border border-gray-200 font-mono">
                <div className="flex justify-between mb-1">
                  <span>Net Expense:</span> <span>{formatCurrency(totalNetExpense)}</span>
                </div>
                {totalInputVat > 0 && (
                  <div className="flex justify-between mb-1 text-[#1B9387]">
                    <span>12% Input VAT:</span> <span>{formatCurrency(totalInputVat)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 my-2"></div>
                <div className="flex justify-between text-lg font-black text-[#1B9387]">
                  <span className="font-sans uppercase">Total Check Outflow:</span>{' '}
                  <span>{formatCurrency(totalCashOut)}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-md font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSubmit}
                className="px-5 py-2.5 rounded-md font-black uppercase tracking-wider text-white bg-[#1B9387] hover:bg-[#28958B] shadow-md transition cursor-pointer"
              >
                Confirm & Issue Check
              </button>
            </div>
          </div>
        </div>
      )}

      <NewContactModal
        isOpen={showAddPayee}
        onClose={() => setShowAddPayee(false)}
        onSaveSuccess={() => {
          loadData()
          setStatus({ type: 'success', msg: 'Vendor successfully added!' })
        }}
        defaultType="SUPPLIER"
      />

      {(previewAttachment || (previewAttachments && previewAttachments.length > 0)) && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          attachments={previewAttachments || undefined}
          onClose={() => {
            setPreviewAttachment(null)
            setPreviewAttachments(null)
          }}
          onAttachmentUpdated={() => {
            loadCashierVouchers()
            loadHistoricalVouchers()
            loadData()
          }}
        />
      )}
    </div>
  )
}
