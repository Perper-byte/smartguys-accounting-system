import React, { useState, useEffect } from 'react'

// Real property rental withholding tax codes (BIR Form 2307)
const ATC_CODES = [
  { code: 'WI100', desc: 'Real Property Rentals - Individual (5%)', rate: 5 },
  { code: 'WC100', desc: 'Real Property Rentals - Corporate (5%)', rate: 5 },
  { code: 'WI158', desc: 'Rentals of Personal Properties (5%)', rate: 5 },
  { code: 'NONE', desc: 'Non-Withholding / Direct Rent (0%)', rate: 0 }
]

// This screen only deals with landlords
const RENT_PAYEE_TYPES = 'LANDLORD'

const getLocalDateString = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]

// Guess the ATC of a past payout from its saved data.
// (Heuristic: corporate landlords are detected by name. A proper fix is to store
// the landlord classification on the payee record.)
const atcForTx = (tx: any) => {
  if (!(tx.tax > 0)) return ATC_CODES[3] // NONE
  return /\b(corp|inc|co|ltd|company)\b/i.test(tx.payee?.name || '')
    ? ATC_CODES[1] // WC100
    : ATC_CODES[0] // WI100
}

// Effective withholding rate of a past payout, e.g. 5 or 0
const txRate = (tx: any) => (tx.gross > 0 ? Math.round((tx.tax / tx.gross) * 100) : 0)
const escapeHtml = (s: string) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )

// Standalone HTML for the certificate (rendered by the hidden PDF window)
const build2307Html = (cert: any) => {
  const money = (n: number) =>
    `₱ ${Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  const rate = cert.gross > 0 ? Math.round((cert.tax / cert.gross) * 100) : 0
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>BIR Form 2307</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 13px; margin: 0; }
  .box { border: 3px solid #000; padding: 16px; }
  .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
  .head h1 { font-size: 18px; text-transform: uppercase; margin: 0 0 4px; }
  .head p { font-size: 13px; font-weight: bold; margin: 0; }
  .parties { display: flex; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
  .parties > div { flex: 1; }
  .parties p { margin: 0 0 3px; }
  .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
  th { background: #eee; }
  .r { text-align: right; }
  .c { text-align: center; }
  .mono { font-family: 'Courier New', monospace; }
</style></head>
<body>
  <div class="box">
    <div class="head">
      <h1>Certificate of Creditable Tax Withheld at Source</h1>
      <p>(BIR Form No. 2307 Equivalent)</p>
    </div>
    <div class="parties">
      <div>
        <p class="label">Payee (Landlord / Lessor):</p>
        <p><strong>${escapeHtml(cert.payee?.name || '')}</strong></p>
        <p>TIN: ${escapeHtml(cert.payee?.tin || 'Not Provided')}</p>
      </div>
      <div>
        <p class="label">Payor (Tenant):</p>
        <p><strong>SMARTGUYS CLINIC INC.</strong></p>
        <p>Date: ${escapeHtml(cert.date.toLocaleDateString())}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Income Payment</th>
          <th class="c">ATC</th>
          <th class="r">Gross Rent</th>
          <th class="r">Tax Withheld (${rate}%)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(cert.atc.desc)}</td>
          <td class="c"><strong>${escapeHtml(cert.atc.code)}</strong></td>
          <td class="r mono">${money(cert.gross)}</td>
          <td class="r mono"><strong>${money(cert.tax)}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
</body></html>`
}

export function EWTPayoutView({ userId }: { userId: string }) {
  const [historyData, setHistoryData] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [payees, setPayees] = useState<any[]>([])

  // Form States
  const [date, setDate] = useState(getLocalDateString())
  const [sourceAccount, setSourceAccount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'check' | 'transfer' | 'cash' | ''>('')
  const [payeeId, setPayeeId] = useState('')
  const [payableBalance, setPayableBalance] = useState(0)
  const [amountToPay, setAmountToPay] = useState<number | ''>('')
  const [selectedATC, setSelectedATC] = useState(ATC_CODES[0])
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

  const [isSubmittingPayee, setIsSubmittingPayee] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [generated2307, setGenerated2307] = useState<any | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  )
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState('')

  const loadData = async () => {
    const api = (window as any).api || (window as any).electronAPI
    if (!api) return
    try {
      // Landlords only
      const fetchedPayees = await api.getPayees(RENT_PAYEE_TYPES)
      setPayees(Array.isArray(fetchedPayees) ? fetchedPayees : [])

      // Cash & Bank assets
      const accData = await api.getAccounts()
      const assets = (accData || []).filter((acc: any) => acc.account_type?.name === 'Asset')
      setCashAccounts(assets)
      if (assets.length > 0 && !sourceAccount) {
        setSourceAccount(assets.find((a: any) => a.code === '1010')?.code || assets[0].code)
      }

      // Landlord payout history
      const hist = await api.getPayoutHistory(RENT_PAYEE_TYPES)
      setHistoryData(Array.isArray(hist) ? hist : [])
    } catch (error: any) {
      console.error('Failed to load data:', error)
      setStatus({ type: 'error', msg: `Could not load landlord data: ${error.message}` })
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
        setRefSequence(nextSeq || '001')
      } catch (error) {
        console.error(error)
      }
    }
    fetchNextSeq()
  }, [refPrefix, status])

  // Auto-fill when selecting a Landlord
  useEffect(() => {
    if (!payeeId) {
      setPayableBalance(0)
      setAmountToPay('')
      return
    }

    setSelectedATC(ATC_CODES[0])

    const fetchBalance = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const bal = await api.getPayeeBalance(payeeId)
        const rawUnpaid = Number(bal?.payable) || 0
        const unpaid = Math.abs(rawUnpaid)

        setPayableBalance(unpaid)
        setAmountToPay(unpaid > 0 ? unpaid : '')
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

      // Create the record in the database
      const response = await api.createPayee(newPayeeName.trim(), 'LANDLORD')

      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to save record.')
      }

      // Instantly inject the new landlord into the dropdown
      if (response?.payee) {
        setPayees((prev) => {
          if (prev.some((p) => p.id === response.payee.id)) return prev
          const newList = [...prev, response.payee]
          return newList.sort((a, b) => a.name.localeCompare(b.name))
        })

        // Auto-select the newly created landlord
        setPayeeId(response.payee.id)
      }

      // Clean up UI state
      setShowAddPayee(false)
      setNewPayeeName('')
      setPayeeSearchQuery('')

      setStatus({ type: 'success', msg: `Successfully added ${newPayeeName.trim()}!` })
      setTimeout(() => setStatus(null), 4000)
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message || 'Failed to create new landlord record.' })
    } finally {
      setIsSubmittingPayee(false)
    }
  }

  // Live Calculations (rounded to centavos so journal lines always balance)
  const grossAmount = Math.round(Math.abs(Number(amountToPay) || 0) * 100) / 100
  const ewtAmount = Math.round(grossAmount * selectedATC.rate) / 100
  const netAmount = Math.round((grossAmount - ewtAmount) * 100) / 100
  const formatCurrency = (val: number) =>
    `₱ ${Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  const executeSubmit = async () => {
    setShowConfirmModal(false)
    setStatus(null)

    try {
      setLoading(true)
      const lines = [
        { accountId: '2010', debit: grossAmount, credit: 0 },
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
        description: `Rental Payout to ${selectedPayee?.name} - ${remarks} (Less ${selectedATC.rate}% EWT)`,
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
        msg: `Voucher ${fullReferenceNo} recorded! Net Rental Payout: ${formatCurrency(netAmount)}.`
      })

      // Only open a 2307 certificate if tax was actually withheld
      if (ewtAmount > 0) {
        setGenerated2307({
          payee: selectedPayee,
          date: new Date(date),
          gross: grossAmount,
          tax: ewtAmount,
          net: netAmount,
          atc: selectedATC
        })
      }

      // Reset Form
      setAmountToPay('')
      setRemarks('')
      setPayeeId('')
      setPaymentMethod('')
      setPayeeSearchQuery('')
      loadData()
      setTimeout(() => setStatus(null), 6000)
    } catch (error: any) {
      setStatus({
        type: 'error',
        msg: error.message || 'System Error: Could not save rent payout.'
      })
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = Boolean(
    payeeId && paymentMethod && sourceAccount && refSequence && grossAmount > 0
  )

  const getButtonLabel = () => {
    if (loading) return 'Processing...'
    if (!payeeId) return 'Select a Landlord'
    if (!paymentMethod) return 'Select Payment Method'
    if (!sourceAccount) return 'Select Source of Funds'
    if (!refSequence) return 'Enter Reference / Voucher No.'
    if (grossAmount <= 0) return 'Enter Gross Rent Amount'
    return `✓ ISSUE RENT PAYOUT — ${formatCurrency(netAmount)}`
  }

  const selectedPayee = payees.find((p) => p.id === payeeId)

  // Opens the 2307 certificate for a past payout
  const openReprint = (tx: any) => {
    setGenerated2307({
      payee: tx.payee,
      date: new Date(tx.date),
      gross: tx.gross,
      tax: tx.tax,
      net: tx.net,
      atc: atcForTx(tx),
      isReprint: true,
      ref: tx.referenceNo
    })
  }

  const filteredHistory = historyData.filter((tx: any) => {
    const query = historySearchQuery.toLowerCase()
    return (
      (tx.payee?.name || '').toLowerCase().includes(query) ||
      (tx.referenceNo || '').toLowerCase().includes(query)
    )
  })

  // Filtering logic for the dropdown
  const filteredPayees = payees.filter((p) =>
    p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase())
  )

  const handleExportPDF = async () => {
    if (!generated2307) return
    const api = (window as any).api || (window as any).electronAPI
    if (!api?.exportHtmlToPDF) {
      setExportMsg({ type: 'error', msg: 'Export is unavailable. Restart the app.' })
      return
    }
    setExporting(true)
    setExportMsg(null)
    try {
      const safeName = (generated2307.payee?.name || 'Landlord')
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
      const stamp = generated2307.date.toLocaleDateString('en-CA') // YYYY-MM-DD
      const res = await api.exportHtmlToPDF(
        build2307Html(generated2307),
        `BIR-2307_${safeName}_${stamp}.pdf`
      )
      if (res?.success) {
        setExportMsg({ type: 'success', msg: 'PDF saved.' })
      } else if (res?.error && res.error !== 'Export cancelled') {
        setExportMsg({ type: 'error', msg: res.error })
      }
    } catch (error: any) {
      setExportMsg({ type: 'error', msg: error.message || 'Export failed.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="w-full h-full px-8 py-6 flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">
      {isPayeeDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsPayeeDropdownOpen(false)} />
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">
          Landlord Payouts & Withholding Tax
        </h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          Settle Real Property Rental Accounts Payable and generate BIR Form 2307 certificates.
        </p>
      </div>

      <div className="w-full flex flex-col 2xl:flex-row items-start gap-8">
        {/* LEFT SIDE: MAIN FORM */}
        <div className="flex-1 w-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm relative overflow-hidden">
          <div className="bg-[#FBF8F8] border-b border-[#B0DCDA] px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-extrabold text-gray-800">New Rent Payout</h3>
            <span className="bg-emerald-50 text-[#1B9387] text-[10px] px-3 py-1.5 rounded-md font-extrabold uppercase tracking-widest border border-[#B0DCDA]">
              🏢 Real Estate / Rental Payment
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
            {/* ROW 1: LANDLORD SELECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 relative z-20">
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Search Landlord
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddPayee(!showAddPayee)}
                    className="text-[10px] font-extrabold text-[#1B9387] hover:text-[#28958B] transition uppercase tracking-wider cursor-pointer"
                  >
                    {showAddPayee ? 'Cancel' : '+ Add New'}
                  </button>
                </div>

                {showAddPayee && (
                  <div className="mb-2 p-2.5 bg-[#E9FAFA] border border-[#B0DCDA] rounded-md flex gap-2 shadow-inner">
                    <input
                      type="text"
                      placeholder="e.g. Ayala Land Inc. or John Landlord"
                      value={newPayeeName}
                      onChange={(e) => setNewPayeeName(e.target.value)}
                      className="flex-1 bg-white border border-[#B0DCDA] rounded px-3 text-sm text-gray-800 outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreatePayee}
                      disabled={isSubmittingPayee || !newPayeeName.trim()}
                      className="bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold px-4 py-1.5 rounded transition cursor-pointer"
                    >
                      Save
                    </button>
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
                    {selectedPayee?.name || '-- Select Landlord --'}
                  </span>
                  <span className="text-xs text-gray-400">▼</span>
                </div>

                {isPayeeDropdownOpen && (
                  <div className="absolute w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden z-30">
                    <div className="p-2 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                      <input
                        type="text"
                        autoFocus
                        placeholder="🔍 Search landlords..."
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
                        className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium border-b border-gray-100"
                      >
                        -- Clear Selection --
                      </li>

                      {filteredPayees.length === 0 ? (
                        <li className="p-4 text-xs text-gray-400 italic text-center">
                          No results found. Add a new one above.
                        </li>
                      ) : (
                        filteredPayees.map((p) => (
                          <li
                            key={p.id}
                            onClick={() => {
                              setPayeeId(p.id)
                              setIsPayeeDropdownOpen(false)
                              setPayeeSearchQuery('')
                            }}
                            className="p-3 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 flex justify-between items-center"
                          >
                            <span>{p.name}</span>
                            <span className="text-[9px] text-gray-400 font-medium uppercase tracking-widest">
                              {p.type}
                            </span>
                          </li>
                        ))
                      )}
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
                      Pay In Full
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 2: PAYMENT METHOD & SOURCE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm"
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
                    -- Select --
                  </option>
                  <option value="check">Check</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
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
                  Source of Funds
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

            {/* ROW 3: ATC & REMARKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  ATC (Rental Tax Code)
                </label>
                <select
                  value={selectedATC.code}
                  onChange={(e) =>
                    setSelectedATC(
                      ATC_CODES.find((atc) => atc.code === e.target.value) || ATC_CODES[0]
                    )
                  }
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                >
                  {ATC_CODES.map((atc) => (
                    <option key={atc.code} value={atc.code}>
                      {atc.code} - {atc.rate}% ({atc.desc})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  Remarks / Rental Period
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., Clinic Rent for September 2026"
                  className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm"
                />
              </div>
            </div>

            {/* ROW 4: PAYOUT SUMMARY */}
            <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-6 shadow-inner w-full mt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-extrabold text-gray-700 uppercase tracking-widest">
                  Gross Rental Payout (A/P)
                </label>
                <div className="relative w-64 shadow-sm">
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
                    className="w-full bg-white border border-[#B0DCDA] focus:border-[#1B9387] rounded-md py-2.5 pl-8 pr-3 text-right font-mono font-bold text-gray-800 outline-none transition"
                  />
                </div>
              </div>

              {payableBalance > 0 && grossAmount > payableBalance && (
                <p className="text-[10px] text-amber-600 font-bold text-right -mt-2 mb-2">
                  ℹ️ Note: ₱ {(grossAmount - payableBalance).toFixed(2)} will be recorded as an
                  advance rental payment.
                </p>
              )}

              <div className="flex justify-between items-center mb-4 text-orange-500">
                <label className="text-xs font-extrabold uppercase tracking-widest">
                  Less: {selectedATC.rate}% Rental EWT
                </label>
                <span className="font-mono text-lg font-bold w-64 text-right pr-3">
                  - {formatCurrency(ewtAmount)}
                </span>
              </div>

              <div className="border-t border-dashed border-[#B0DCDA] my-4" />

              <div className="flex justify-between items-center text-[#1B9387]">
                <span className="font-black uppercase tracking-widest text-lg">
                  Net Landlord Payout
                </span>
                <span className="font-mono font-black text-2xl w-64 text-right pr-3">
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

        {/* RIGHT SIDE: RECENT PAYOUTS */}
        <div className="w-full 2xl:w-[420px] flex flex-col space-y-4">
          <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-[#B0DCDA] pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">
                Recent Landlord Payouts
              </h3>
              <button
                type="button"
                onClick={() => setShowAllHistoryModal(true)}
                className="text-xs text-[#1B9387] font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                View All ({historyData.length})
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1">
              {historyData.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-gray-400 italic">No recent payouts found.</p>
                  <button
                    type="button"
                    onClick={loadData}
                    className="mt-3 text-[11px] text-[#1B9387] font-bold hover:underline cursor-pointer"
                  >
                    ↻ Refresh Data
                  </button>
                </div>
              ) : (
                historyData.slice(0, 10).map((tx: any, idx: number) => (
                  <div
                    key={tx.id || idx}
                    className="bg-[#FBF8F8] border border-[#B0DCDA]/60 rounded-lg p-3 shadow-sm hover:border-[#1B9387] transition group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-extrabold text-gray-800 truncate mb-0.5">
                          {tx.payee?.name || 'Landlord'}
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
                      <div className="flex justify-between text-orange-500">
                        <span>EWT ({txRate(tx)}%):</span> <span>- {formatCurrency(tx.tax)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>Net Rent:</span> <span>{formatCurrency(tx.net)}</span>
                      </div>
                    </div>

                    {tx.tax > 0 ? (
                      <button
                        type="button"
                        onClick={() => openReprint(tx)}
                        className="w-full py-1.5 bg-[#1B9387] hover:bg-[#28958B] text-white text-[10px] font-extrabold uppercase tracking-widest rounded shadow-sm transition cursor-pointer"
                      >
                        📄 Generate BIR Form 2307
                      </button>
                    ) : (
                      <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        No tax withheld — no 2307
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* "VIEW ALL" HISTORY MODAL */}
      {showAllHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-[#B0DCDA] overflow-hidden">
            <div className="bg-[#1B9387] p-4 px-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">
                  All Landlord Payout History
                </h3>
                <p className="text-xs text-[#E9FAFA]">
                  Complete log of rental settlements and Form 2307 certificates
                </p>
              </div>
              <button
                onClick={() => setShowAllHistoryModal(false)}
                className="text-white hover:text-gray-200 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center gap-4">
              <input
                type="text"
                placeholder="🔍 Filter by landlord name or voucher no..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full max-w-md bg-white border border-[#B0DCDA] rounded-md px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1B9387]"
              />
              <span className="text-xs text-gray-500 font-bold whitespace-nowrap">
                Total: {filteredHistory.length} Record(s)
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredHistory.length === 0 ? (
                <p className="text-center py-12 text-gray-400 italic">
                  No payouts match your search filter.
                </p>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider text-gray-500 font-extrabold">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Reference</th>
                      <th className="py-2.5">Landlord</th>
                      <th className="py-2.5 text-right">Gross Rent</th>
                      <th className="py-2.5 text-right">EWT Withheld</th>
                      <th className="py-2.5 text-right">Net Paid</th>
                      <th className="py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map((tx: any, idx: number) => (
                      <tr key={tx.id || idx} className="hover:bg-teal-50/40">
                        <td className="py-3 font-medium text-xs text-gray-600">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-mono font-bold text-xs text-[#1B9387]">
                          {tx.referenceNo}
                        </td>
                        <td className="py-3 font-bold text-gray-800">
                          {tx.payee?.name || 'Landlord'}
                        </td>
                        <td className="py-3 font-mono text-right text-gray-700">
                          {formatCurrency(tx.gross)}
                        </td>
                        <td className="py-3 font-mono text-right text-orange-500">
                          {formatCurrency(tx.tax)}{' '}
                          <span className="text-[10px] text-gray-400">({txRate(tx)}%)</span>
                        </td>
                        <td className="py-3 font-mono font-bold text-right text-[#1B9387]">
                          {formatCurrency(tx.net)}
                        </td>
                        <td className="py-3 text-center">
                          {tx.tax > 0 ? (
                            <button
                              onClick={() => {
                                setShowAllHistoryModal(false)
                                openReprint(tx)
                              }}
                              className="text-[10px] bg-[#1B9387] border border-[#1B9387] text-white font-extrabold uppercase tracking-widest px-3 py-1.5 rounded shadow-sm hover:bg-[#28958B] transition cursor-pointer"
                            >
                              Form 2307
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 text-right">
              <button
                onClick={() => setShowAllHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#B0DCDA]">
            <div className="bg-[#1B9387] p-5 text-center text-white">
              <h2 className="text-xl font-black uppercase tracking-widest">Confirm Rent Payout</h2>
              <p className="text-sm font-medium mt-1 text-[#E9FAFA]">
                Review withholding tax details before posting.
              </p>
            </div>
            <div className="p-6 space-y-4 text-sm font-medium text-gray-600">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Landlord:</span>{' '}
                <span className="font-bold text-gray-800">{selectedPayee?.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Source of Funds:</span>{' '}
                <span className="font-bold text-gray-800 truncate max-w-[200px] text-right">
                  {cashAccounts.find((a) => a.code === sourceAccount)?.name}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>{refLabel}:</span>{' '}
                <span className="font-mono font-bold text-gray-800">
                  {refPrefix}
                  {refSequence.padStart(3, '0')}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>ATC Code:</span>{' '}
                <span className="font-bold text-gray-800">{selectedATC.code}</span>
              </div>

              <div className="bg-[#FBF8F8] p-4 rounded-lg mt-4 border border-gray-200 font-mono">
                <div className="flex justify-between mb-1">
                  <span>Debit: A/P (Gross Rent)</span> <span>{formatCurrency(grossAmount)}</span>
                </div>
                <div className="flex justify-between mb-1 text-orange-500">
                  <span>Credit: EWT Payable</span> <span>{formatCurrency(ewtAmount)}</span>
                </div>
                <div className="border-t border-gray-300 my-2" />
                <div className="flex justify-between text-lg font-black text-[#1B9387]">
                  <span className="font-sans uppercase tracking-widest">Net Payout:</span>{' '}
                  <span>{formatCurrency(netAmount)}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-md font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeSubmit}
                className="px-5 py-2.5 rounded-md font-black uppercase tracking-wider text-white bg-[#1B9387] hover:bg-[#28958B] shadow-md transition cursor-pointer"
              >
                Confirm & Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2307 CERTIFICATE MODAL */}
      {generated2307 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
          <div className="bg-white text-black p-8 rounded-lg shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end items-center space-x-4 mb-4 border-b pb-4">
              {exportMsg && (
                <span
                  className={`text-xs font-bold mr-auto ${
                    exportMsg.type === 'success' ? 'text-[#1B9387]' : 'text-red-600'
                  }`}
                >
                  {exportMsg.type === 'success' ? '✅ ' : '⚠️ '}
                  {exportMsg.msg}
                </span>
              )}
              <button
                onClick={() => {
                  setGenerated2307(null)
                  setExportMsg(null)
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-black font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="px-4 py-2 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-300 text-white rounded text-sm font-bold transition shadow cursor-pointer"
              >
                {exporting ? 'Exporting...' : '📄 Export PDF'}
              </button>
            </div>
            <div className="border-4 border-black p-4">
              {/* certificate body stays exactly as it is now */}
              <div className="text-center border-b-2 border-black pb-4 mb-4">
                <h1 className="font-bold text-xl uppercase">
                  Certificate of Creditable Tax Withheld at Source
                </h1>
                <p className="font-bold text-sm">(BIR Form No. 2307 Equivalent)</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4 mb-4 text-sm">
                <div>
                  <p className="font-bold text-xs uppercase text-gray-600">
                    Payee (Landlord / Lessor):
                  </p>
                  <p className="font-bold">{generated2307.payee?.name}</p>
                  <p>TIN: {generated2307.payee?.tin || 'Not Provided'}</p>
                </div>
                <div>
                  <p className="font-bold text-xs uppercase text-gray-600">Payor (Tenant):</p>
                  <p className="font-bold">SMARTGUYS CLINIC INC.</p>
                  <p>Date: {generated2307.date.toLocaleDateString()}</p>
                </div>
              </div>
              <table className="w-full text-sm text-left border-collapse border border-black mb-12">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-black p-2">Income Payment</th>
                    <th className="border border-black p-2 text-center">ATC</th>
                    <th className="border border-black p-2 text-right">Gross Rent</th>
                    <th className="border border-black p-2 text-right">
                      Tax Withheld (
                      {generated2307.gross > 0
                        ? Math.round((generated2307.tax / generated2307.gross) * 100)
                        : 0}
                      %)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-2">{generated2307.atc.desc}</td>
                    <td className="border border-black p-2 text-center font-bold">
                      {generated2307.atc.code}
                    </td>
                    <td className="border border-black p-2 text-right font-mono">
                      ₱{' '}
                      {generated2307.gross.toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </td>
                    <td className="border border-black p-2 text-right font-mono font-bold">
                      ₱{' '}
                      {generated2307.tax.toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
