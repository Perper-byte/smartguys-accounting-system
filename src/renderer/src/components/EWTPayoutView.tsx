// src/renderer/src/components/EWTPayoutView.tsx
import React, { useState, useEffect } from 'react'
import {
  Building,
  Printer,
  X,
  Plus,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle,
  Wallet,
  Landmark,
  CreditCard,
  KeyRound
} from 'lucide-react'

// BIR RR 2-98 Standard ATC for Real Property Rentals
const RENT_ATC = {
  code: 'WI100',
  desc: 'Real Property Rentals (5% EWT)',
  rate: 5
}

const getLocalDateString = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]

export function RentPayoutView({ userId }: { userId: string }) {
  const [historyData, setHistoryData] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])

  // Form States
  const [date, setDate] = useState(getLocalDateString())
  const [sourceAccount, setSourceAccount] = useState('')
  const [debitAccount, setDebitAccount] = useState('5040') // Default 5040 Rent Expense, or 2010 A/P
  const [paymentMethod, setPaymentMethod] = useState<'check' | 'transfer' | 'cash' | ''>('')
  const [payeeId, setPayeeId] = useState('')
  const [payableBalance, setPayableBalance] = useState(0)
  const [amountToPay, setAmountToPay] = useState<number | ''>('')
  const [refSequence, setRefSequence] = useState('')
  const [remarks, setRemarks] = useState('')

  // Dynamic Reference Logic
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
      ? 'Check No.'
      : paymentMethod === 'transfer'
        ? 'Bank Reference No.'
        : paymentMethod === 'cash'
          ? 'Voucher No.'
          : 'Reference No.'

  // UI States
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('')
  const [showAddPayee, setShowAddPayee] = useState(false)
  const [newPayeeName, setNewPayeeName] = useState('')
  const [newPayeeTin, setNewPayeeTin] = useState('')

  const [isSubmittingPayee, setIsSubmittingPayee] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [generated2307, setGenerated2307] = useState<any | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const loadData = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api) return

      // Load all non-patient contacts (Landlords, Suppliers, Lessors)
      const allPayees = await api.getPayees()
      const landlordsAndSuppliers = (allPayees || []).filter(
        (p: any) => p.type === 'LANDLORD' || p.type === 'SUPPLIER' || p.type !== 'PATIENT'
      )
      setPayees(landlordsAndSuppliers)

      const accData = await api.getAccounts()
      const assets = accData.filter((acc: any) => acc.account_type?.name === 'Asset')
      setCashAccounts(assets)
      if (assets.length > 0 && !sourceAccount) {
        setSourceAccount(assets.find((a: any) => a.code === '1010')?.code || assets[0].code)
      }

      const hist = await api.getPayoutHistory()
      setHistoryData(hist || [])
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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

  // Auto-fill when selecting a landlord
  useEffect(() => {
    if (!payeeId) {
      setPayableBalance(0)
      setAmountToPay('')
      return
    }

    const fetchBalance = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const bal = await api.getPayeeBalance(payeeId)
        const rawUnpaid = Number(bal?.payable) || 0
        const unpaid = Math.abs(rawUnpaid)

        setPayableBalance(unpaid)
        if (unpaid > 0) setAmountToPay(unpaid)
      } catch (error) {
        console.error(error)
      }
    }
    fetchBalance()
  }, [payeeId])

  const handleCreatePayee = async () => {
    if (!newPayeeName.trim()) return
    setIsSubmittingPayee(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      await api.createPayee(newPayeeName.trim(), 'LANDLORD')

      await loadData()

      const newRecord = payees.find(
        (p: any) => p.name.toLowerCase() === newPayeeName.trim().toLowerCase()
      )
      if (newRecord) {
        setPayeeId(newRecord.id)
        if (newPayeeTin.trim()) {
          await api.updatePayeeTin(newRecord.id, newPayeeTin.trim())
        }
      }

      setShowAddPayee(false)
      setNewPayeeName('')
      setNewPayeeTin('')
      setStatus({ type: 'success', msg: `Successfully added ${newPayeeName} as Lessor / Landlord!` })
      setTimeout(() => setStatus(null), 4000)
    } catch (error) {
      setStatus({ type: 'error', msg: 'Failed to create new landlord record.' })
    } finally {
      setIsSubmittingPayee(false)
    }
  }

  // Live Calculations (Strict 5% EWT under BIR RR 2-98)
  const grossAmount = Math.abs(Number(amountToPay) || 0)
  const ewtAmount = Number((grossAmount * (RENT_ATC.rate / 100)).toFixed(2))
  const netAmount = Number((grossAmount - ewtAmount).toFixed(2))

  const formatCurrency = (val: number) =>
    `₱ ${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const executeSubmit = async () => {
    setShowConfirmModal(false)
    setStatus(null)

    try {
      setLoading(true)
      const lines = [
        { accountId: debitAccount, debit: grossAmount, credit: 0 },
        { accountId: sourceAccount, debit: 0, credit: netAmount }
      ]
      if (ewtAmount > 0) {
        lines.splice(1, 0, { accountId: '2050', debit: 0, credit: ewtAmount })
      }

      const selectedPayee = payees.find((p) => p.id === payeeId)
      const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`

      const entryData = {
        date: new Date(date).toISOString(),
        referenceNo: fullReferenceNo,
        description: `Rent Payout to ${selectedPayee?.name || 'Landlord'} - ${remarks || 'Clinic Space Rental'} (Less 5% EWT ATC: WI100)`,
        vatType: 'EXEMPT',
        userId: userId,
        payeeId: payeeId,
        lines: lines
      }

      const api = (window as any).api || (window as any).electronAPI
      const response = await api.submitJournalEntry(entryData)
      if (response && response.success === false) throw new Error(response.error)

      setStatus({
        type: 'success',
        msg: `Rent Voucher ${fullReferenceNo} recorded! Net Check/Transfer: ${formatCurrency(netAmount)} (5% EWT: ${formatCurrency(ewtAmount)}).`
      })

      setGenerated2307({
        payee: selectedPayee,
        date: new Date(date),
        gross: grossAmount,
        tax: ewtAmount,
        net: netAmount,
        atc: RENT_ATC,
        ref: fullReferenceNo
      })

      // Reset Form
      setAmountToPay('')
      setRemarks('')
      setPayeeId('')
      setPaymentMethod('')
      loadData()
      setTimeout(() => setStatus(null), 6000)
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message || 'System Error: Could not save rent payout.' })
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = Boolean(
    payeeId && paymentMethod && sourceAccount && refSequence && grossAmount > 0
  )

  const getButtonLabel = () => {
    if (loading) return 'Processing...'
    if (!payeeId) return 'Select Landlord / Lessor'
    if (!paymentMethod) return 'Select Payment Method'
    if (!sourceAccount) return 'Select Source Bank/Cash'
    if (!refSequence) return 'Enter Check / Voucher No.'
    if (grossAmount <= 0) return 'Enter Monthly Rental Amount'
    return `✓ ISSUE RENT PAYMENT — ${formatCurrency(netAmount)}`
  }

  const selectedPayee = payees.find((p) => p.id === payeeId)

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">
      {isPayeeDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsPayeeDropdownOpen(false)}></div>
      )}

      {/* HEADER */}
      <div className="mb-6 pb-4 border-b border-[#B0DCDA] flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-[#E9FAFA] p-2.5 rounded-xl border border-[#B0DCDA] text-[#1B9387]">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2.5">
                Rent & Lease Payouts
                <span className="bg-emerald-50 text-[#1B9387] border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                  5% EWT (ATC: WI100)
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">
                Issue rent payments to property owners/lessors, withhold 5% Expanded Withholding Tax, and generate BIR Form 2307.
              </p>
            </div>
          </div>
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
          <div className="bg-[#FBF8F8] border-b border-[#B0DCDA] px-6 py-4 flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <KeyRound size={16} className="text-[#1B9387]" />
              New Rental Disbursement
            </h3>
            <span className="bg-rose-50 text-rose-600 text-[10px] px-3 py-1 rounded-md font-extrabold uppercase tracking-widest border border-rose-200">
              🏢 Real Property Lease
            </span>
          </div>

          {status && (
            <div
              className={`m-6 mb-0 p-4 rounded-md text-sm font-bold shadow-sm border ${
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
            className="p-6 space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (isFormValid) setShowConfirmModal(true)
            }}
          >
            {/* ROW 1: LESSOR / LANDLORD SELECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 relative z-20">
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Property Owner / Lessor
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddPayee(!showAddPayee)}
                    className="text-[10px] font-extrabold text-[#1B9387] hover:text-[#28958B] transition uppercase tracking-wider cursor-pointer"
                  >
                    {showAddPayee ? 'Cancel' : '+ Add New Landlord'}
                  </button>
                </div>

                {showAddPayee && (
                  <div className="mb-2 p-3 bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg space-y-2 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Landlord / Company Name"
                        value={newPayeeName}
                        onChange={(e) => setNewPayeeName(e.target.value)}
                        className="bg-white border border-[#B0DCDA] rounded px-3 py-1.5 text-xs text-gray-800 outline-none"
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="TIN (e.g. 123-456-789-000)"
                        value={newPayeeTin}
                        onChange={(e) => setNewPayeeTin(e.target.value)}
                        className="bg-white border border-[#B0DCDA] rounded px-3 py-1.5 text-xs font-mono text-gray-800 outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleCreatePayee}
                        disabled={isSubmittingPayee || !newPayeeName.trim()}
                        className="bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold px-4 py-1.5 rounded transition cursor-pointer"
                      >
                        Save Landlord
                      </button>
                    </div>
                  </div>
                )}

                <div
                  onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                  className={`w-full bg-[#FBF8F8] border ${
                    isPayeeDropdownOpen
                      ? 'border-[#1B9387] ring-1 ring-[#1B9387]'
                      : 'border-[#B0DCDA]'
                  } rounded-md p-3 text-sm transition cursor-pointer flex justify-between items-center shadow-sm`}
                >
                  <span
                    className={payeeId ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}
                  >
                    {selectedPayee?.name || '-- Select Landlord / Lessor --'}
                  </span>
                  <span className="text-xs text-gray-400">▼</span>
                </div>

                {isPayeeDropdownOpen && (
                  <div className="absolute w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden z-30">
                    <div className="p-2 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                      <input
                        type="text"
                        autoFocus
                        placeholder="🔍 Search landlords or companies..."
                        value={payeeSearchQuery}
                        onChange={(e) => setPayeeSearchQuery(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-800 outline-none focus:border-[#1B9387]"
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
                              setIsPayeeDropdownOpen(false)
                              setPayeeSearchQuery('')
                            }}
                            className="p-3 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-50 flex justify-between items-center"
                          >
                            <span>{p.name}</span>
                            {p.tin && (
                              <span className="text-[10px] font-mono text-gray-400">
                                TIN: {p.tin}
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-end">
                <div
                  className={`p-2.5 rounded-md border text-center relative ${
                    payeeId && payableBalance > 0
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-[#FBF8F8] border-[#B0DCDA]'
                  }`}
                >
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold mb-0.5">
                    Unpaid Rent Balance
                  </p>

                  <p
                    className={`text-xl font-black font-mono ${
                      !payeeId
                        ? 'text-gray-300'
                        : payableBalance > 0
                          ? 'text-orange-500'
                          : 'text-gray-400'
                    }`}
                  >
                    {payeeId ? formatCurrency(payableBalance) : '—'}
                  </p>

                  {payeeId && payableBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmountToPay(payableBalance)}
                      className="absolute -top-3 -right-2 bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-extrabold uppercase px-2 py-1 rounded shadow transition cursor-pointer"
                    >
                      Pay Full
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 2: PAYMENT METHOD & SOURCE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <select
                  required
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                >
                  <option value="" disabled className="text-gray-400 font-normal">
                    -- Select Method --
                  </option>
                  <option value="check">Check (CV-)</option>
                  <option value="transfer">Bank Transfer (REF-)</option>
                  <option value="cash">Cash Voucher (DV-)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  {refLabel}
                </label>
                <div className="flex shadow-sm">
                  <span
                    className={`bg-[#FBF8F8] border border-[#B0DCDA] border-r-0 rounded-l-md px-3 py-2.5 text-sm font-extrabold select-none ${
                      paymentMethod ? 'text-gray-500' : 'text-gray-300'
                    }`}
                  >
                    {paymentMethod ? refPrefix : '---'}
                  </span>
                  <input
                    type="text"
                    required
                    disabled={!paymentMethod}
                    value={refSequence}
                    onChange={(e) => setRefSequence(e.target.value)}
                    className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-2.5 text-sm font-mono font-bold text-[#1B9387] focus:border-[#1B9387] outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Source Bank / Cash
                </label>
                <select
                  required
                  value={sourceAccount}
                  onChange={(e) => setSourceAccount(e.target.value)}
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                >
                  {cashAccounts.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ROW 3: DEBIT ACCOUNT & REMARKS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Account to Debit
                </label>
                <select
                  value={debitAccount}
                  onChange={(e) => setDebitAccount(e.target.value)}
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                >
                  <option value="5040">5040 - Rent Expense</option>
                  <option value="2010">2010 - Accounts Payable (Rent)</option>
                  <option value="1400">1400 - Prepaid Rent</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Tax Withholding Code
                </label>
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-2.5 text-xs text-gray-700 font-mono font-bold flex items-center justify-between">
                  <span>{RENT_ATC.code} - {RENT_ATC.desc}</span>
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-black">
                    5% EWT
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Lease Period / Remarks
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Clinic Space Rental for October 2026"
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm"
                />
              </div>
            </div>

            {/* ROW 4: INTEGRATED RENT SUMMARY BOX */}
            <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-6 shadow-inner max-w-xl mx-auto mt-4">
              <div className="flex justify-between items-center mb-3 relative">
                <label className="text-xs font-extrabold text-gray-700 uppercase tracking-widest">
                  Gross Monthly Rental
                </label>
                <div className="relative w-48 shadow-sm">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-mono font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amountToPay}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setAmountToPay(isNaN(val) ? '' : Math.abs(val))
                    }}
                    placeholder="0.00"
                    className="w-full bg-white border border-[#B0DCDA] focus:border-[#1B9387] rounded-md py-2.5 pl-8 pr-3 text-right font-mono font-bold text-gray-800 outline-none transition"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 text-orange-600">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest block">
                    Less: 5% EWT (ATC: WI100)
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Withheld for BIR Remittance
                  </span>
                </div>
                <span className="font-mono text-lg font-bold w-48 text-right pr-3">
                  - {formatCurrency(ewtAmount)}
                </span>
              </div>

              <div className="border-t border-dashed border-[#B0DCDA] my-4"></div>

              <div className="flex justify-between items-center text-[#1B9387]">
                <div>
                  <span className="font-black uppercase tracking-widest text-lg block">
                    Net Check / Outflow
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Actual payment to Landlord
                  </span>
                </div>
                <span className="font-mono font-black text-2xl w-48 text-right pr-3">
                  {formatCurrency(netAmount)}
                </span>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="border-t-2 border-gray-800 pt-6">
              <button
                type="submit"
                disabled={!isFormValid || loading}
                className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition shadow-md flex justify-center items-center text-sm ${
                  isFormValid
                    ? 'bg-[#1B9387] hover:bg-[#28958B] text-white cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border border-gray-300'
                }`}
              >
                {getButtonLabel()}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE: RECENT HISTORY */}
        <div className="w-full lg:w-[360px] flex flex-col space-y-4 sticky top-6">
          <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-[#B0DCDA] pb-3 mb-4">
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={15} className="text-[#1B9387]" />
                Recent Rent Payouts
              </h3>
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                {historyData.length} Recorded
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1">
              {historyData.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center mt-8">
                  No rent disbursements found.
                </p>
              ) : (
                historyData.slice(0, 10).map((tx: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-[#FBF8F8] border border-[#B0DCDA]/60 rounded-lg p-3 shadow-sm hover:border-[#1B9387] transition group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-extrabold text-gray-800 truncate mb-0.5">
                          {tx.payee?.name || 'Property Owner'}
                        </p>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {new Date(tx.date).toLocaleDateString()} • {tx.referenceNo}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs font-mono text-gray-500 mb-3 border-t border-gray-200 pt-2">
                      <div className="flex justify-between">
                        <span>Gross Rent:</span> <span>{formatCurrency(tx.gross)}</span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>5% EWT:</span> <span>- {formatCurrency(tx.tax)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-800 border-t border-gray-100 pt-1">
                        <span>Net Paid:</span> <span>{formatCurrency(tx.net)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setGenerated2307({
                          payee: tx.payee,
                          date: new Date(tx.date),
                          gross: tx.gross,
                          tax: tx.tax,
                          net: tx.net,
                          atc: RENT_ATC,
                          isReprint: true,
                          ref: tx.referenceNo
                        })
                      }}
                      className="w-full py-2 bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] text-[10px] font-extrabold uppercase tracking-widest rounded shadow-2xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Printer size={12} />
                      View / Print Rent Memo
                    </button>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#B0DCDA]">
            <div className="bg-[#1B9387] p-5 text-center text-white">
              <h2 className="text-xl font-black uppercase tracking-widest">Confirm Rent Payment</h2>
              <p className="text-sm font-medium mt-1 text-[#E9FAFA]">
                Review breakdown before posting to general ledger.
              </p>
            </div>
            <div className="p-6 space-y-4 text-sm font-medium text-gray-600">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Landlord / Lessor:</span>{' '}
                <span className="font-bold text-gray-800">{selectedPayee?.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Debit Account:</span>{' '}
                <span className="font-bold text-gray-800">{debitAccount} (Rent)</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>{refLabel}:</span>{' '}
                <span className="font-mono font-bold text-gray-800">
                  {refPrefix}
                  {refSequence.padStart(3, '0')}
                </span>
              </div>

              <div className="bg-[#FBF8F8] p-4 rounded-lg mt-4 border border-gray-200 font-mono">
                <div className="flex justify-between mb-1">
                  <span>Gross Rent:</span> <span>{formatCurrency(grossAmount)}</span>
                </div>
                <div className="flex justify-between mb-1 text-orange-600 font-bold">
                  <span>Less 5% EWT:</span> <span>- {formatCurrency(ewtAmount)}</span>
                </div>
                <div className="border-t border-gray-300 my-2"></div>
                <div className="flex justify-between text-lg font-black text-[#1B9387]">
                  <span className="font-sans uppercase tracking-widest">Net Outflow:</span>{' '}
                  <span>{formatCurrency(netAmount)}</span>
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

      {/* PRINT MODAL (CLINIC RENT & WITHHOLDING MEMO) */}
      {generated2307 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm print:bg-white print:block print:relative print:inset-auto print:z-0">
          <div className="bg-white text-gray-900 p-8 rounded-2xl shadow-2xl w-[750px] max-h-[92vh] overflow-y-auto print:w-full print:h-full print:max-h-full print:shadow-none print:p-0">
            <div className="flex justify-end space-x-3 mb-4 print:hidden border-b pb-4">
              <button
                type="button"
                onClick={() => setGenerated2307(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-black font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-xl text-sm font-bold transition shadow cursor-pointer flex items-center gap-2"
              >
                <Printer size={15} />
                Print Rent Memo
              </button>
            </div>

            {/* MEMO SLIP CONTAINER */}
            <div className="border border-gray-300 rounded-xl p-6 sm:p-8 bg-white font-sans text-gray-800">
              {/* HEADER */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-5 mb-5">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-gray-900">
                    SMARTGUYS CLINIC
                  </h1>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Internal Clinic & Lessor Acknowledgment Copy
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-50 text-[#1B9387] border border-emerald-200 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider block mb-1">
                    Rent Payment Memo
                  </span>
                  <p className="text-xs font-mono font-bold text-gray-500">
                    Ref: {generated2307.ref || 'RENT-VOUCHER'}
                  </p>
                </div>
              </div>

              {/* DETAILS GRID */}
              <div className="grid grid-cols-2 gap-6 bg-gray-50/70 rounded-xl p-4 border border-gray-100 mb-6 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                    Landlord / Property Owner
                  </span>
                  <p className="text-sm font-black text-gray-800 mt-0.5">
                    {generated2307.payee?.name || 'Property Owner'}
                  </p>
                  {generated2307.payee?.tin && (
                    <p className="font-mono text-gray-500 text-[11px] mt-0.5">
                      TIN: {generated2307.payee.tin}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                    Payment Date & Space
                  </span>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">
                    {generated2307.date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-gray-500 text-[11px] mt-0.5">Clinic Space Lease</p>
                </div>
              </div>

              {/* BREAKDOWN TABLE */}
              <table className="w-full text-left border-collapse border border-gray-200 rounded-lg overflow-hidden mb-6 text-sm">
                <thead>
                  <tr className="bg-gray-100/80 text-[10px] font-black text-gray-600 uppercase tracking-wider border-b border-gray-200">
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount (₱)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  <tr>
                    <td className="p-3.5">
                      <p className="font-bold text-gray-800">Monthly Clinic Space Rental (Gross)</p>
                      <span className="text-xs text-gray-400">Total agreed rental amount</span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-gray-800">
                      ₱ {generated2307.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="bg-orange-50/30">
                    <td className="p-3.5 text-orange-700">
                      <p className="font-bold">Less: 5% Withholding Tax Retained</p>
                      <span className="text-xs text-orange-600/80">
                        Retained by clinic finance for annual/quarterly tax filing
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-orange-600">
                      - ₱ {generated2307.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="bg-[#E9FAFA]/60 font-black">
                    <td className="p-4 text-base text-[#1B9387]">
                      NET RENT RELEASED TO LANDLORD
                    </td>
                    <td className="p-4 text-right font-mono text-xl text-[#1B9387]">
                      ₱ {generated2307.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* MEMO EXPLANATION BOX */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mb-8 text-xs text-gray-600 leading-relaxed">
                <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                  📌 Note & Filing Reminder
                </span>
                This voucher serves as a formal acknowledgment of clinic rent released. The 5% withholding tax (₱{generated2307.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}) has been deducted and held by SMARTGUYS CLINIC INC. to be remitted for tax filing on behalf of the property owner.
              </div>

              {/* SIGNATURES */}
              <div className="grid grid-cols-2 gap-10 text-center text-xs pt-4 border-t border-gray-200">
                <div>
                  <div className="border-b border-gray-400 w-52 mx-auto mb-2"></div>
                  <p className="font-black text-gray-800 uppercase tracking-wider">
                    Released By (Clinic Finance)
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Signature over Printed Name</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-52 mx-auto mb-2"></div>
                  <p className="font-black text-gray-800 uppercase tracking-wider">
                    Received By (Landlord / Lessor)
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Signature over Printed Name</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Backwards-compatibility alias so existing imports don't break
export { RentPayoutView as EWTPayoutView }
