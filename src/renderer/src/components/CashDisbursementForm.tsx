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
  Eye
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
  // Dropdowns & Data
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])
  const [recentVouchers, setRecentVouchers] = useState<any[]>([])

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
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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

      const result = await api.submitJournalEntry({
        date: new Date(date).toISOString(),
        referenceNo: fullReferenceNo,
        description: description,
        vatType: hasVatableLine ? 'VATABLE' : 'EXEMPT',
        userId,
        payeeId,
        lines
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
            Cash Disbursements (Check / Bank Transfer)
            <span className="bg-emerald-50 text-[#1B9387] border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Multi-Line Enabled
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Issue checks, bank transfers, or official vouchers with single or multiple expense distributions.
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
                      accept=".pdf,.jpg,.png"
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
                              setPreviewAttachment(v.attachments[0])
                            }}
                            className="text-[10px] text-[#1B9387] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                            title="Preview receipt"
                          >
                            <Eye size={11} />
                            <span>Attachment</span>
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

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  )
}
