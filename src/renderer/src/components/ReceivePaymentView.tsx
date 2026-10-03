// src/renderer/src/components/ReceivePaymentView.tsx
import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  CheckCircle,
  History,
  Info,
  X,
  Wallet,
  Smartphone,
  Landmark,
  Printer,
  Receipt
} from 'lucide-react'
import { cleanDescription } from '../utils/formatters'

interface ReceivePaymentViewProps {
  userId: string
  prefillData?: {
    prefillEntity?: string
    prefillAmount?: number
    referenceNo?: string
    payeeId?: string
  }
}

export function ReceivePaymentView({ userId, prefillData }: ReceivePaymentViewProps) {
  // --- States ---
  const [payees, setPayees] = useState<any[]>([])
  const [payeeId, setPayeeId] = useState('')
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('')

  const [outstandingBalance, setOutstandingBalance] = useState(0)

  // Invoice Tracking States
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  const [checkedInvoiceIds, setCheckedInvoiceIds] = useState<string[]>([])
  const [fetchingInvoices, setFetchingInvoices] = useState(false)

  // Payment & Deduction States
  const [amountReceived, setAmountReceived] = useState<number | ''>('')
  const [cwtAmount, setCwtAmount] = useState<number | ''>('')

  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  const [refPrefix] = useState('OR-')
  const [refSequence, setRefSequence] = useState('')

  // Modals & Views
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [successData, setSuccessData] = useState<any | null>(null)

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // --- Computations ---
  const received = Number(amountReceived) || 0
  const tax = Number(cwtAmount) || 0

  // Total value applied against the A/R
  const totalCredit = received + tax

  const selectedTotal = unpaidInvoices
    .filter((inv) => checkedInvoiceIds.includes(inv.referenceNo))
    .reduce((sum, inv) => sum + inv.balance, 0)

  const targetAmount = selectedTotal > 0 ? selectedTotal : outstandingBalance
  const remainingTarget = Math.max(0, targetAmount - totalCredit)
  const remainingBalance = Math.max(0, outstandingBalance - totalCredit)
  const isPartialPayment = targetAmount > 0 && totalCredit > 0 && totalCredit < targetAmount - 0.009

  // Validation: Allow partial payment up to targetAmount (or total outstanding balance)
  const isValid =
    payeeId !== '' &&
    paymentMethod !== '' &&
    received > 0 &&
    totalCredit <= targetAmount + 0.01

  // --- Effects ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPayeeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const data = await (window as any).api.getPayees()
        setPayees(data)
      } catch (error) {
        console.error(error)
      }
    }
    fetchPayees()
  }, [])

  useEffect(() => {
    const fetchNextSeq = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const nextSeq = await api.getNextSequence(refPrefix)
        setRefSequence(nextSeq)
      } catch (error) {
        console.error(error)
      }
    }
    if (!successData) fetchNextSeq()
  }, [refPrefix, successData])

  // Handle prefill data from A/R Invoice Tracker navigation
  useEffect(() => {
    if (prefillData?.prefillEntity && payees.length > 0) {
      const match = payees.find(
        (p) =>
          p.name?.trim().toLowerCase() === prefillData.prefillEntity?.trim().toLowerCase() ||
          p.id === prefillData.payeeId
      )
      if (match) {
        setPayeeId(match.id)
      }
    }
  }, [prefillData, payees])

  useEffect(() => {
    if (!payeeId) {
      setOutstandingBalance(0)
      setAmountReceived('')
      setCwtAmount('')
      setPaymentReference('')
      setUnpaidInvoices([])
      setCheckedInvoiceIds([])
      return
    }

    const fetchData = async () => {
      setFetchingInvoices(true)
      try {
        const api = (window as any).api || (window as any).electronAPI

        const bal = await api.getPayeeBalance(payeeId)
        setOutstandingBalance(bal?.receivable || 0)

        const tracker = await api.getInvoiceTracker()
        const selectedName = payees.find((p) => p.id === payeeId)?.name

        const pending = tracker.filter(
          (inv: any) => inv.payeeName === selectedName && inv.balance > 0
        )

        setUnpaidInvoices(pending)

        // If navigating with prefill invoice reference, pre-check it
        if (prefillData?.referenceNo && pending.some((inv: any) => inv.referenceNo === prefillData.referenceNo)) {
          setCheckedInvoiceIds([prefillData.referenceNo])
          if (prefillData.prefillAmount) {
            setAmountReceived(prefillData.prefillAmount)
          }
        } else {
          setCheckedInvoiceIds([])
          setAmountReceived('')
        }
        setCwtAmount('')
      } catch (error) {
        console.error(error)
      } finally {
        setFetchingInvoices(false)
      }
    }

    fetchData()
  }, [payeeId, payees, prefillData])

  // --- Handlers ---
  const handleToggleInvoice = (refNo: string) => {
    setCheckedInvoiceIds((prev) =>
      prev.includes(refNo) ? prev.filter((id) => id !== refNo) : [...prev, refNo]
    )
  }

  const handleToggleAll = () => {
    if (checkedInvoiceIds.length === unpaidInvoices.length) {
      setCheckedInvoiceIds([])
    } else {
      setCheckedInvoiceIds(unpaidInvoices.map((inv) => inv.referenceNo))
    }
  }

  const handleAutoComputeTax = () => {
    if (received > 0) {
      const gross = received / 0.98
      const computedTax = gross * 0.02
      setCwtAmount(Number(computedTax.toFixed(2)))
    } else if (targetAmount > 0) {
      const computedTax = targetAmount * 0.02
      const netAmount = targetAmount - computedTax
      setCwtAmount(Number(computedTax.toFixed(2)))
      setAmountReceived(netAmount > 0 ? Number(netAmount.toFixed(2)) : 0)
    }
  }

  const handleExactAmount = () => {
    const netAmount = targetAmount - tax
    setAmountReceived(netAmount > 0 ? Number(netAmount.toFixed(2)) : targetAmount)
  }

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setIsConfirmModalOpen(true)
  }

  const handleActualSubmit = async () => {
    setStatus(null)
    setLoading(true)

    try {
      const lines: any[] = []
      const debitAccount = paymentMethod === 'CASH' ? '1020' : '1010'

      lines.push({ accountId: debitAccount, debit: received, credit: 0 })

      if (tax > 0) lines.push({ accountId: '1310', debit: tax, credit: 0 })

      lines.push({ accountId: '1200', debit: 0, credit: totalCredit })

      const selectedName = payees.find((p) => p.id === payeeId)?.name
      const fullReferenceNo = `${refPrefix}${(refSequence || '1').padStart(3, '0')}`

      const invList = checkedInvoiceIds.length > 0 ? ` [Invs: ${checkedInvoiceIds.join(', ')}]` : ''
      const isPartial = targetAmount > 0 && totalCredit < targetAmount - 0.009
      const partialTag = isPartial ? ' [PARTIAL PAYMENT]' : ''
      const description = `Collection of A/R from ${selectedName}${invList}${partialTag} via ${paymentMethod} ${paymentReference ? `(Ref: ${paymentReference})` : ''}`

      const entryData = {
        date: new Date().toISOString(),
        referenceNo: fullReferenceNo,
        description: description,
        vatType: 'EXEMPT',
        userId: userId,
        payeeId: payeeId,
        lines: lines
      }

      const response = await (window as any).api.submitJournalEntry(entryData)

      if (response && response.success === false) {
        setStatus({ type: 'error', msg: 'Database Error: ' + response.error })
        setIsConfirmModalOpen(false)
        return
      }

      setIsConfirmModalOpen(false)
      setSuccessData({
        orNo: fullReferenceNo,
        name: selectedName,
        amount: received,
        tax: tax,
        method: paymentMethod,
        ref: paymentReference,
        remaining: remainingBalance,
        invoicesCovered: checkedInvoiceIds,
        isPartial: isPartial
      })
    } catch (error) {
      console.error(error)
      setStatus({ type: 'error', msg: 'System Error: Could not save payment.' })
      setIsConfirmModalOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setPayeeId('')
    setPaymentMethod('')
    setSuccessData(null)
    setStatus(null)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const filteredPayees = payees.filter((p) =>
    p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase())
  )
  const selectedPayee = payees.find((p) => p.id === payeeId)

  // ==========================================
  // VIEW 1: SUCCESS SCREEN
  // ==========================================
  if (successData) {
    return (
      <div className="w-full flex justify-center p-8 bg-slate-50 min-h-[calc(100vh-64px)]">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #receipt-print-area, #receipt-print-area * { visibility: visible; }
            #receipt-print-area {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              margin: 0;
              padding: 24px;
              box-shadow: none !important;
              border: none !important;
            }
            #receipt-print-hide { display: none !important; }
          }
        `}</style>

        <div
          id="receipt-print-area"
          className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl p-12 shadow-sm flex flex-col items-center"
        >
          <CheckCircle size={64} className="text-emerald-500 mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 tracking-widest uppercase mb-2">
            Payment Received
          </h2>
          <p className="text-5xl font-mono font-bold text-emerald-500 mb-8">
            ₱ {successData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>

          <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4 mb-8">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Payer/Entity</span>
              <span className="text-slate-800 font-bold">{successData.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">OR No.</span>
              <span className="text-slate-800 font-bold">{successData.orNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Method</span>
              <span className="text-slate-800 font-bold">
                {successData.method} {successData.ref && `(${successData.ref})`}
              </span>
            </div>

            {successData.isPartial && (
              <div className="flex justify-between text-xs bg-amber-50 text-amber-800 p-2 rounded border border-amber-200 font-bold">
                <span>Payment Type</span>
                <span>PARTIAL PAYMENT</span>
              </div>
            )}

            {successData.tax > 0 && (
              <div className="border-t border-slate-200 pt-3 flex justify-between text-xs">
                <span className="text-slate-500">2% Withholding Tax Credit</span>
                <span className="text-slate-600 font-mono">
                  ₱ {successData.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {successData.invoicesCovered?.length > 0 && (
              <div className="border-t border-slate-200 pt-3 flex justify-between text-sm">
                <span className="text-slate-500">Invoices Cleared</span>
                <span className="text-indigo-600 font-mono font-bold text-right max-w-[200px]">
                  {successData.invoicesCovered.join(', ')}
                </span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3 flex justify-between text-sm">
              <span className="text-slate-500">Remaining Balance</span>
              <span className="text-slate-800 font-bold">
                ₱ {successData.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div id="receipt-print-hide" className="flex gap-4 w-full max-w-md">
            <button
              onClick={handlePrintReceipt}
              className="flex-1 flex justify-center items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-md transition"
            >
              <Printer size={20} /> Print Receipt
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-md transition shadow-md"
            >
              New Collection
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: MAIN FORM
  // ==========================================
  return (
    <div className="w-full min-h-[calc(100vh-64px)] p-6 md:p-10 flex justify-center items-start bg-[#f9fafb]">
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-xl shadow-sm font-sans flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 lg:px-10 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 tracking-wide">
            Receive Payment (Collections)
          </h2>
          <span className="bg-emerald-50 text-emerald-600 text-xs px-3 py-1.5 rounded font-bold uppercase tracking-widest border border-emerald-200 flex items-center gap-2">
            <Receipt size={14} /> Payment Collection
          </span>
        </div>

        <div className="p-6 lg:p-10">
          {status && (
            <div
              className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : ''}`}
            >
              ⚠️ {status.msg}
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-8">
            {/* STEP 1: ACCOUNT SELECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  1. Select Payer (HMO/Patient)
                </label>
                <div className="relative mt-2">
                  <div
                    onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                    className={`w-full bg-white border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-1 ring-[#1B9387]' : 'border-slate-200 hover:border-slate-300'} rounded-lg p-4 text-sm text-slate-700 transition cursor-pointer flex justify-between items-center shadow-sm`}
                  >
                    <div className="flex items-center gap-3">
                      <Search size={18} className={payeeId ? 'text-[#1B9387]' : 'text-slate-400'} />
                      <span
                        className={
                          payeeId ? 'text-slate-800 font-bold text-base' : 'text-slate-400'
                        }
                      >
                        {selectedPayee?.name || 'Search patient or HMO...'}
                      </span>
                    </div>
                  </div>
                  {isPayeeDropdownOpen && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <input
                          type="text"
                          autoFocus
                          placeholder="🔍 Type to search..."
                          value={payeeSearchQuery}
                          onChange={(e) => setPayeeSearchQuery(e.target.value)}
                          className="w-full bg-transparent p-2 text-sm text-slate-800 outline-none placeholder-slate-400"
                        />
                      </div>
                      <ul className="max-h-64 overflow-y-auto">
                        {filteredPayees.map((p) => (
                          <li
                            key={p.id}
                            onClick={() => {
                              setPayeeId(p.id)
                              setIsPayeeDropdownOpen(false)
                              setPayeeSearchQuery('')
                            }}
                            className="p-4 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#1B9387] cursor-pointer transition border-b border-slate-50 last:border-0 font-medium flex justify-between"
                          >
                            <span>{p.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded uppercase font-bold">
                              {p.type}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <div
                  className={`p-5 rounded-xl border flex flex-col justify-center items-end shadow-sm ${outstandingBalance > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}
                >
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                    Total Outstanding Balance
                  </p>
                  <p
                    className={`text-4xl font-bold font-mono ${outstandingBalance > 0 ? 'text-red-500' : 'text-[#10b981]'}`}
                  >
                    ₱ {outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 2: SELECT INVOICES */}
            <div
              className={`bg-white p-8 border ${checkedInvoiceIds.length > 0 ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'} shadow-sm rounded-xl relative transition-all`}
            >
              <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  2. Select Unpaid Invoices
                </label>
                <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  Selected Target:
                  <span
                    className={`text-sm font-mono transition-colors ${checkedInvoiceIds.length > 0 ? 'text-emerald-600 font-black' : 'text-slate-400'}`}
                  >
                    ₱ {selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {!payeeId ? (
                <div className="flex justify-center items-center py-10 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">
                    Select an account to view invoices
                  </span>
                </div>
              ) : fetchingInvoices ? (
                <div className="flex justify-center items-center py-10">
                  <span className="text-slate-400 font-bold text-sm tracking-widest uppercase animate-pulse">
                    Loading invoices...
                  </span>
                </div>
              ) : unpaidInvoices.length === 0 ? (
                <div className="flex flex-col justify-center items-center py-10 bg-emerald-50/30 rounded-lg border border-dashed border-emerald-200">
                  <CheckCircle size={32} className="text-emerald-300 mb-3" />
                  <span className="text-emerald-600 font-bold text-sm tracking-widest uppercase">
                    No outstanding invoices
                  </span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider font-bold sticky top-0 z-10">
                      <tr>
                        <th
                          className="p-3 w-12 text-center cursor-pointer hover:bg-slate-100"
                          onClick={handleToggleAll}
                          title="Select All"
                        >
                          <input
                            type="checkbox"
                            className="cursor-pointer w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500"
                            onChange={handleToggleAll}
                            checked={
                              checkedInvoiceIds.length === unpaidInvoices.length &&
                              unpaidInvoices.length > 0
                            }
                          />
                        </th>
                        <th className="p-3">Reference No.</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Patient & Details</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Invoice Total</th>
                        <th className="p-3 text-right text-red-500">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unpaidInvoices.map((inv) => (
                        <tr
                          key={inv.referenceNo}
                          className={`hover:bg-slate-50 transition cursor-pointer ${checkedInvoiceIds.includes(inv.referenceNo) ? 'bg-emerald-50/40' : ''}`}
                          onClick={() => handleToggleInvoice(inv.referenceNo)}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              className="cursor-pointer w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500 pointer-events-none"
                              checked={checkedInvoiceIds.includes(inv.referenceNo)}
                              readOnly
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-700 text-xs">
                            {inv.referenceNo}
                          </td>
                          <td className="p-3 text-slate-500 text-xs">
                            {new Date(inv.date).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-xs w-1/3">
                            <div
                              className="flex flex-col max-w-[220px] overflow-hidden"
                              title={cleanDescription(inv.description)}
                            >
                              <span className="text-slate-800 font-bold truncate">
                                {cleanDescription(inv.description)
                                  ? cleanDescription(inv.description).split('|')[0].trim()
                                  : 'Manual Invoice'}
                              </span>
                              {cleanDescription(inv.description).includes('|') && (
                                <span className="text-slate-500 truncate text-[10px] mt-0.5">
                                  {cleanDescription(inv.description)
                                    .substring(cleanDescription(inv.description).indexOf('|') + 1)
                                    .trim()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {inv.status === 'Partially Paid' || (inv.paid > 0) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                Partial (₱{Number(inv.paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} paid)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-400 text-xs">
                            ₱ {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-red-500">
                            ₱ {inv.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* STEP 3: PAYMENT DETAILS */}
            <div className="bg-white p-8 border border-slate-200 shadow-sm rounded-xl relative">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-8 pb-4 border-b border-slate-100">
                3. Payment Details
              </label>

              {!payeeId && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center"></div>
              )}

              <div className="space-y-10">
                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex justify-center items-center gap-2 cursor-pointer py-3.5 text-xs font-bold rounded-lg border transition-all ${paymentMethod === 'CASH' ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <Wallet size={16} /> CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('GCASH')}
                      className={`flex justify-center items-center gap-2 cursor-pointer py-3.5 text-xs font-bold rounded-lg border transition-all ${paymentMethod === 'GCASH' ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <Smartphone size={16} /> E-WALLET
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK')}
                      className={`flex justify-center items-center gap-2 cursor-pointer py-3.5 text-xs font-bold rounded-lg border transition-all ${paymentMethod === 'BANK' ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <Landmark size={16} /> BANK
                    </button>
                  </div>

                  {(paymentMethod === 'GCASH' || paymentMethod === 'BANK') && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <input
                        type="text"
                        placeholder={
                          paymentMethod === 'GCASH'
                            ? 'Enter GCash/Maya Reference No.'
                            : 'Enter Bank Transfer Ref No.'
                        }
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-800 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition shadow-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Amounts & Tax Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                  {/* Amount Received (Primary) */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-[#10b981] uppercase tracking-wider">
                        Amount Received (Actual)
                      </label>
                      {targetAmount > 0 && (
                        <button
                          type="button"
                          onClick={handleExactAmount}
                          className={`text-[10px] font-bold px-3 py-1 rounded-full transition cursor-pointer ${checkedInvoiceIds.length > 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                        >
                          Fill Remaining (₱{targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                        </button>
                      )}
                    </div>
                    <div className="relative shadow-sm rounded-lg mb-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-emerald-500/50 font-mono">
                        ₱
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(parseFloat(e.target.value) || '')}
                        placeholder="0.00"
                        className="w-full bg-white border-2 border-[#34d399] rounded-lg py-5 pl-12 pr-6 text-3xl text-slate-800 font-mono font-bold text-right focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none transition placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* 2% Withholding Tax */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div
                        className="flex items-center gap-1 cursor-help w-fit"
                        title="Usually applicable only for HMOs and corporate accounts."
                      >
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                          2% Withholding Tax <span className="lowercase font-normal text-slate-400">(HMO/Corp)</span>
                        </label>
                        <Info
                          size={12}
                          className="text-slate-400 hover:text-slate-600 transition"
                        />
                      </div>
                      {targetAmount > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoComputeTax}
                          className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold px-3 py-1 rounded-full transition cursor-pointer"
                        >
                          Auto-Compute 2%
                        </button>
                      )}
                    </div>
                    <div className="relative shadow-sm rounded-lg">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400 font-mono">
                        ₱
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cwtAmount}
                        onChange={(e) => setCwtAmount(parseFloat(e.target.value) || '')}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-300 rounded-lg py-5 pl-12 pr-6 text-2xl text-slate-800 font-mono font-bold text-right focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Settlement Status Indicator */}
                {totalCredit > 0 && (
                  <div>
                    {isPartialPayment ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-200 text-amber-900 font-black px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                            Partial Payment
                          </span>
                          <span>
                            Recording partial payment of <strong>₱{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> against <strong>₱{targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> due.
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-900">
                          Remaining Unpaid: ₱{remainingTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-200 text-emerald-900 font-black px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                            Full Settlement
                          </span>
                          <span>
                            Recording full settlement of <strong>₱{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>.
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900">
                          Balance: ₱0.00
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Remaining Balance Summary Box */}
                {payeeId && totalCredit > 0 && (
                  <div className="bg-slate-800 rounded-lg p-5 font-mono text-sm shadow-xl flex justify-between items-center text-white">
                    <div className="space-y-1 text-xs text-slate-300">
                      <div className="flex gap-4">
                        <span className="w-24 uppercase tracking-widest text-[9px] font-bold text-slate-400">
                          Target
                        </span>
                        <span>
                          ₱ {targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <span className="w-24 uppercase tracking-widest text-[9px] font-bold text-slate-400">
                          Total Credits
                        </span>
                        <span className="text-emerald-400">
                          - ₱ {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Unpaid Balance
                      </span>
                      <span
                        className={`text-xl font-bold ${remainingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}
                      >
                        ₱ {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CONFIRM BUTTON */}
            <button
              type="submit"
              disabled={!isValid || loading}
              className="cursor-pointer w-full mt-4 bg-[#10b981] disabled:bg-[#f0fdfa] disabled:text-[#064e3b]/40 disabled:border disabled:border-emerald-100 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold py-5 rounded-xl transition-all hover:bg-[#059669] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-3 text-lg"
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  <CheckCircle size={24} />
                  {isValid
                    ? `Record ₱ ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} Credit to Account`
                    : 'Complete Form to Proceed'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ========================================== */}
      {/* CONFIRMATION MODAL                           */}
      {/* ========================================== */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-slate-800 font-bold tracking-wide">Confirm Payment</h3>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition bg-white rounded-full p-1 border border-slate-200 shadow-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">
                  Patient / Entity
                </p>
                <p className="text-slate-800 font-bold text-lg">{selectedPayee?.name}</p>
                {checkedInvoiceIds.length > 0 && (
                  <p className="text-indigo-600 text-xs font-mono font-bold mt-1">
                    Paying {checkedInvoiceIds.length} invoice(s)
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 font-mono shadow-inner">
                {isPartialPayment && (
                  <div className="text-xs bg-amber-100 text-amber-900 px-3 py-1.5 rounded font-bold uppercase tracking-wider text-center">
                    Partial Payment (Target: ₱{targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </div>
                )}
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Actual Cash Received</span>
                  <span>₱ {received.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>2% Tax Credit</span>
                    <span>₱ {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 flex justify-between text-indigo-700 font-bold text-base mt-2">
                  <span>Total Applied Credit</span>
                  <span>
                    ₱ {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {isPartialPayment && (
                  <div className="flex justify-between text-amber-700 text-xs font-bold pt-1">
                    <span>Remaining Unpaid</span>
                    <span>₱ {remainingTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-3 rounded-lg font-bold transition shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleActualSubmit}
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white py-3 rounded-lg font-bold tracking-wide transition shadow-md cursor-pointer"
              >
                Confirm & Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
