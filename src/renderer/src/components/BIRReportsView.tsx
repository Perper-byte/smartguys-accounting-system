import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Printer,
  Download,
  AlertTriangle,
  FileText,
  Inbox,
  CheckCircle2,
  RefreshCcw
} from 'lucide-react'

export const BIRReportsView: React.FC = () => {
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const currentMonth = new Date().getMonth() + 1

  const [year, setYear] = useState<number>(currentYear)
  const [quarter, setQuarter] = useState<number>(currentQuarter) // 0 = Annual
  const [month, setMonth] = useState<number>(currentMonth)

  const [taxData, setTaxData] = useState<any>(null)
  const [reliefData, setReliefData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const [view, setView] = useState<'2550Q' | '0619E' | '1601EQ' | 'relief'>('2550Q')

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchTaxData = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const api = (window as any).electronAPI || (window as any).api

      // 1. Monthly EWT (0619-E)
      if (view === '0619E') {
        if (!api?.generate0619E) throw new Error('Missing backend API for 0619-E.')
        const data = await api.generate0619E(year, month)
        if (data?.error) throw new Error(data.error)
        setTaxData(data)
        setReliefData(null)
      }
      // 2. Quarterly EWT (1601-EQ / 1604-E)
      else if (view === '1601EQ') {
        if (!api?.generate1601EQ) throw new Error('Missing backend API for 1601-EQ.')
        const data = await api.generate1601EQ(year, quarter)
        if (data?.error) throw new Error(data.error)
        setTaxData(data)
        setReliefData(null)
      }
      // 3. Quarterly VAT & RELIEF (2550Q)
      else {
        if (!api?.generate2550Q || !api?.generateRelief) {
          throw new Error('Tax service is unavailable.')
        }
        const [data2550, dataRelief] = await Promise.all([
          api.generate2550Q(year, quarter),
          api.generateRelief(year, quarter)
        ])

        if (data2550?.error || dataRelief?.error)
          throw new Error(data2550?.error || dataRelief?.error)
        setTaxData(data2550)
        setReliefData(dataRelief)
      }
    } catch (err: any) {
      console.error(err)
      setTaxData(null)
      setReliefData(null)
      setErrorMessage(err?.message || 'Unable to retrieve the tax report for this period.')
    } finally {
      setLoading(false)
    }
  }

  // Refetch data when year, quarter, month, or view changes
  useEffect(() => {
    fetchTaxData()
  }, [year, quarter, month, view])

  const formatCurrency = (val: number | null | undefined) => {
    if (!val || val === 0) return null
    return `₱ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatCurrencyNoSymbol = (val: number | null | undefined) => {
    if (!val || val === 0) return null
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleExportPDF = async () => {
    if (loading || errorMessage)
      return showToast('Cannot export while loading or in error state.', 'error')

    try {
      document.body.classList.add('is-printing')
      // Give the browser a moment to apply print styles before triggering the capture
      await new Promise((resolve) => setTimeout(resolve, 150))

      const api = (window as any).electronAPI || (window as any).api
      if (api && api.exportPDF) {
        let periodLabel =
          view === '0619E' ? `Month_${month}` : quarter === 0 ? 'Annual' : `Q${quarter}`
        const filename = `BIR_Form_${view}_${year}_${periodLabel}.pdf`

        const result = await api.exportPDF(filename)

        if (result && result.success) {
          showToast(`Report saved successfully to:\n${result.filePath}`, 'success')
        } else if (result && result.error) {
          showToast(`Export Failed: ${result.error}`, 'error')
        }
      } else {
        window.print() // Fallback if running in web mode
      }
    } catch (err: any) {
      showToast(`Export Error: ${err.message || 'Failed to generate PDF.'}`, 'error')
    } finally {
      document.body.classList.remove('is-printing')
    }
  }

  const handleDownloadSLSP = () => {
    if (!reliefData || reliefData.annexB_Purchases.length === 0) {
      return showToast('No vatable purchases data available to download.', 'error')
    }
    const lines = reliefData.annexB_Purchases.map((p: any) => {
      const tinClean = p.tin.replace(/-/g, '').padEnd(9, '0').substring(0, 9)
      return `P,${tinClean},0000,"${p.supplierName}","","",${p.grossAmount.toFixed(2)},${p.tax.toFixed(2)},0.00,0.00,0.00`
    })

    const fileName =
      quarter === 0 ? `SLSP_Annual_${year}_Purchases.dat` : `SLSP_Q${quarter}_${year}_Purchases.dat`
    triggerDownload(lines.join('\n'), fileName)
    showToast(`Successfully exported ${fileName}`, 'success')
  }

  const handleDownloadQAP = () => {
    if (!taxData || !taxData.qapList || taxData.qapList.length === 0) {
      return showToast('No EWT data available to download.', 'error')
    }
    const lines = taxData.qapList.map((p: any) => {
      const tinClean = p.tin.replace(/-/g, '').padEnd(9, '0').substring(0, 9)
      return `D1,${tinClean},0000,"${p.payeeName}","${p.atc}",${p.grossAmount.toFixed(2)},${p.taxWithheld.toFixed(2)}`
    })

    const fileName =
      quarter === 0 ? `QAP_1604E_Annual_${year}.dat` : `QAP_1601EQ_Q${quarter}_${year}.dat`
    triggerDownload(lines.join('\n'), fileName)
    showToast(`Successfully exported ${fileName}`, 'success')
  }

  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getMonthName = (m: number) =>
    new Date(0, m - 1).toLocaleString('default', { month: 'long' })

  return (
    <div className="w-full h-full flex flex-col p-4 lg:p-6 bg-gray-50/50 relative print:p-0 print:bg-white print:block min-h-0">
      {/* TOAST ALERTS */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 p-4 rounded-md shadow-lg text-white z-50 flex items-center space-x-3 animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-[#1B9387]' : toast.type === 'error' ? 'bg-red-700' : 'bg-gray-800'}`}
        >
          {toast.type === 'error' && <AlertTriangle size={20} />}
          {toast.type === 'success' && <CheckCircle2 size={20} />}
          <span className="whitespace-pre-line text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="w-full h-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex flex-col overflow-hidden font-sans text-gray-800 print:shadow-none print:border-none print:overflow-visible">
        {/* HEADER & CONTROLS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-5 p-6 border-b border-[#B0DCDA] shrink-0 bg-white z-10 print:hidden">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide flex items-center gap-2">
                <FileText size={24} className="text-[#1B9387]" /> BIR Tax Compliance
              </h2>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                EOPT-Ready Tax Summaries and DAT Generators
              </p>
            </div>

            {/* UNIFIED TABS */}
            <div className="flex flex-wrap bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner w-fit">
              <button
                onClick={() => setView('2550Q')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === '2550Q' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
              >
                Form 2550Q (VAT)
              </button>
              <button
                onClick={() => setView('0619E')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === '0619E' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
              >
                Form 0619-E (Monthly EWT)
              </button>
              <button
                onClick={() => setView('1601EQ')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === '1601EQ' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
              >
                {quarter === 0 ? 'Form 1604-E (Annual)' : 'Form 1601-EQ (Quarterly)'}
              </button>
              <button
                onClick={() => setView('relief')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'relief' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
              >
                RELIEF / SLSP Generator
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 h-10 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Period
              </label>
              {view === '0619E' ? (
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-40 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 h-10 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none cursor-pointer shadow-sm transition"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {getMonthName(m)}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                  className="w-44 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2 h-10 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none cursor-pointer shadow-sm transition"
                >
                  <option value={1}>Q1 (Jan-Mar)</option>
                  <option value={2}>Q2 (Apr-Jun)</option>
                  <option value={3}>Q3 (Jul-Sep)</option>
                  <option value={4}>Q4 (Oct-Dec)</option>
                  <option value={0}>Annual (Full Year)</option>
                </select>
              )}
            </div>
            <button
              onClick={handleExportPDF}
              className="px-5 py-2 h-10 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition flex items-center space-x-2 shadow-sm cursor-pointer"
            >
              <FileText size={16} /> <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-hidden p-6 bg-gray-50/40 relative print:p-0 print:bg-white print:overflow-visible flex flex-col min-h-0">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center bg-gray-50/80 backdrop-blur-sm print:hidden">
              <div className="h-10 w-10 rounded-full border-4 border-[#E9FAFA] border-t-[#1B9387] animate-spin" />
              <p className="mt-4 font-bold text-gray-800">Preparing tax report…</p>
              <p className="mt-1 text-sm text-gray-500 font-medium">
                Crunching transactions for this period.
              </p>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="h-full flex flex-col justify-center items-center text-center animate-in fade-in">
              <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-8 shadow-sm">
                <AlertTriangle size={40} className="text-red-600 mx-auto mb-4 opacity-80" />
                <p className="font-extrabold text-red-700 uppercase tracking-wider text-sm">
                  Could not load report
                </p>
                <p className="mt-2 text-sm text-red-600 font-medium">{errorMessage}</p>
                <button
                  onClick={fetchTaxData}
                  className="mt-6 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-100 px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center justify-center space-x-2 w-full"
                >
                  <RefreshCcw size={14} /> <span>Try again</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 1. FORM 2550Q (VAT) VIEW */}
          {/* ============================================================ */}
          {!loading && !errorMessage && taxData && view === '2550Q' && (
            <div className="h-full flex flex-col gap-6 overflow-y-auto animate-in fade-in duration-300">
              <div className="bg-white border border-gray-200 rounded-xl p-6 lg:p-8 shadow-sm shrink-0 print:border-none print:shadow-none print:p-0">
                <h3 className="text-lg font-extrabold text-gray-800 mb-6 border-b border-gray-100 pb-4">
                  Part IV - Details of VAT Computation
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-10">
                  <div className="space-y-4 text-sm">
                    <h4 className="text-[10px] font-extrabold uppercase text-[#1B9387] tracking-widest mb-4">
                      Total Sales & Output Tax
                    </h4>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Item 31A: Vatable Sales</span>
                      <span className="font-mono font-bold text-gray-800 tabular-nums">
                        {formatCurrency(taxData.vatableSales) || (
                          <span className="text-gray-300">-</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#E9FAFA]/60 p-3 rounded-lg border border-[#B0DCDA]">
                      <span className="text-[#1B9387] font-extrabold">
                        Item 31B: Output Tax (12%)
                      </span>
                      <span className="font-mono text-[#1B9387] font-black tabular-nums">
                        {formatCurrency(taxData.outputVat) || (
                          <span className="text-[#1B9387]/30">-</span>
                        )}
                      </span>
                    </div>
                    <div className="pt-4 mt-4 border-t border-gray-100"></div>
                    <div className="flex justify-between items-start">
                      <span className="text-gray-600 font-medium">
                        Item 33: VAT-Exempt Sales <br />
                        <span className="text-[10px] text-gray-400 font-normal uppercase tracking-wider">
                          (Consults, Labs, SC/PWD)
                        </span>
                      </span>
                      <span className="font-mono font-bold text-gray-800 tabular-nums">
                        {formatCurrency(taxData.exemptSales) || (
                          <span className="text-gray-300">-</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 text-sm">
                    <h4 className="text-[10px] font-extrabold uppercase text-orange-600 tracking-widest mb-4">
                      Allowable Input Tax
                    </h4>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">
                        Item 44A: Domestic Purchases
                      </span>
                      <span className="font-mono font-bold text-gray-800 tabular-nums">
                        {formatCurrency(taxData.vatablePurchases) || (
                          <span className="text-gray-300">-</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-orange-50/60 p-3 rounded-lg border border-orange-200">
                      <span className="text-orange-600 font-extrabold">
                        Item 44B: Input Tax (12%)
                      </span>
                      <span className="font-mono text-orange-600 font-black tabular-nums">
                        {formatCurrency(taxData.inputVat) || (
                          <span className="text-orange-300">-</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="text-[10px] font-extrabold uppercase text-orange-600 tracking-widest mb-4">
                    Tax Credits & Payments
                  </h4>
                  <div className="flex justify-between items-center bg-orange-50/60 p-3 rounded-lg border border-orange-200 w-full lg:w-1/2 lg:pr-10">
                    <span className="text-orange-600 font-extrabold leading-tight">
                      Item 16: Creditable VAT Withheld <br />
                      <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">
                        (From HMOs - Form 2307)
                      </span>
                    </span>
                    <span className="font-mono text-orange-600 font-black tabular-nums">
                      {formatCurrency(taxData.creditableVatWithheld) || (
                        <span className="text-orange-300">-</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`border rounded-xl p-6 lg:p-8 flex flex-col md:flex-row justify-between items-center shadow-sm shrink-0 print:border-none print:shadow-none print:p-0 print:mt-8 gap-4 ${taxData.netVatPayable <= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
              >
                <div>
                  <h3
                    className={`text-xl font-black uppercase tracking-wider ${taxData.netVatPayable <= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    Item 15: Net VAT {taxData.netVatPayable <= 0 ? 'Overpayment' : 'Payable'}
                  </h3>
                  <p
                    className={`text-sm mt-1 font-bold ${taxData.netVatPayable <= 0 ? 'text-emerald-600/80' : 'text-red-600/80'}`}
                  >
                    Output VAT less (Input VAT + CWT Credits) for{' '}
                    {quarter === 0 ? `the Year ${year}` : `Q${quarter} ${year}`}
                  </p>
                </div>
                <span
                  className={`text-4xl font-black font-mono tabular-nums ${taxData.netVatPayable <= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {formatCurrency(taxData.netVatPayable) || (
                    <span className="opacity-30">₱ 0.00</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. FORM 0619-E VIEW (MONTHLY EWT) */}
          {/* ============================================================ */}
          {!loading && !errorMessage && taxData && view === '0619E' && (
            <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
              {/* Summary Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-800 mb-1">Form 0619-E Summary</h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Monthly remittance of creditable income taxes withheld for {getMonthName(month)}{' '}
                    {year}.
                  </p>
                </div>
                <div className="bg-[#E9FAFA]/60 border border-[#B0DCDA] rounded-xl p-5 flex flex-col items-end min-w-[300px]">
                  <h3 className="text-sm font-black text-[#1B9387] uppercase tracking-wider mb-1">
                    Total Taxes Withheld
                  </h3>
                  <span className="text-3xl font-black font-mono text-[#1B9387] tabular-nums">
                    {formatCurrency(taxData.ewtWithheld) || (
                      <span className="opacity-30">₱ 0.00</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Stretched Table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm min-h-0">
                <div className="bg-[#FBF8F8] border-b border-gray-200 p-5 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide">
                      Withholding Tax Breakdown
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      Transactions subjected to EWT this month.
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <tr>
                        <th className="p-4 pl-6 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-32">
                          Date
                        </th>
                        <th className="p-4 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                          Payee (Doctor/Landlord)
                        </th>
                        <th className="p-4 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          TIN
                        </th>
                        <th className="p-4 text-center text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-24">
                          ATC
                        </th>
                        <th className="p-4 text-right text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          Gross Payout
                        </th>
                        <th className="p-4 pr-6 text-right text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          Tax Withheld
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {!taxData.qapList || taxData.qapList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-20 text-center text-gray-400 bg-gray-50/30">
                            <Inbox size={48} className="mx-auto mb-4 opacity-30" />
                            <span className="italic font-medium text-sm">
                              No withholding taxes recorded this month.
                            </span>
                          </td>
                        </tr>
                      ) : (
                        taxData.qapList.map((p: any, i: number) => {
                          const grossStr = formatCurrencyNoSymbol(p.grossAmount)
                          const taxStr = formatCurrencyNoSymbol(p.taxWithheld)
                          return (
                            <tr
                              key={i}
                              className="hover:bg-gray-50 transition-colors even:bg-gray-50/30"
                            >
                              <td className="p-4 pl-6 text-gray-500 font-medium">
                                {new Date(p.date).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-gray-800 font-extrabold">{p.payeeName}</td>
                              <td className="p-4 text-gray-500 font-mono font-bold">{p.tin}</td>
                              <td className="p-4 text-center">
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded border border-blue-100">
                                  {p.atc}
                                </span>
                              </td>
                              <td className="p-4 text-right text-gray-800 font-mono font-bold tabular-nums">
                                {grossStr || <span className="text-gray-300">-</span>}
                              </td>
                              <td className="p-4 pr-6 text-right text-[#1B9387] font-black font-mono tabular-nums">
                                {taxStr || <span className="text-[#1B9387]/30">-</span>}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. FORM 1601-EQ / 1604-E VIEW + ALPHALIST (QAP) */}
          {/* ============================================================ */}
          {!loading && !errorMessage && taxData && view === '1601EQ' && (
            <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
              {/* Summary Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-800 mb-1">
                    {quarter === 0
                      ? 'Form 1604-E Summary (Annual)'
                      : 'Form 1601-EQ Summary (Quarterly)'}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Taxes withheld from Doctor Professional Fees and Rent (ATC WI010 / WI100).
                  </p>
                </div>
                <div className="bg-[#E9FAFA]/60 border border-[#B0DCDA] rounded-xl p-5 flex flex-col items-end min-w-[300px]">
                  <h3 className="text-sm font-black text-[#1B9387] uppercase tracking-wider mb-1">
                    Total Taxes Withheld
                  </h3>
                  <span className="text-3xl font-black font-mono text-[#1B9387] tabular-nums">
                    {formatCurrency(taxData.ewtWithheld) || (
                      <span className="opacity-30">₱ 0.00</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Stretched Table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm min-h-0">
                <div className="bg-[#FBF8F8] border-b border-gray-200 p-5 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide">
                      QAP: Alphalist of Payees
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      Required electronic attachment for {quarter === 0 ? '1604-E' : '1601-EQ'}.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadQAP}
                    disabled={!taxData.qapList || taxData.qapList.length === 0}
                    className="bg-[#1B9387] hover:bg-[#157A70] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-md transition flex items-center space-x-2 shadow-sm cursor-pointer"
                  >
                    <Download size={16} /> <span>Download .DAT</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <tr>
                        <th className="p-4 pl-6 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-32">
                          Date
                        </th>
                        <th className="p-4 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                          Payee (Doctor/Landlord)
                        </th>
                        <th className="p-4 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          TIN
                        </th>
                        <th className="p-4 text-center text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-24">
                          ATC
                        </th>
                        <th className="p-4 text-right text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          Gross Payout
                        </th>
                        <th className="p-4 pr-6 text-right text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          Tax Withheld
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {!taxData.qapList || taxData.qapList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-20 text-center text-gray-400 bg-gray-50/30">
                            <Inbox size={48} className="mx-auto mb-4 opacity-30" />
                            <span className="italic font-medium text-sm">
                              No withholding taxes recorded this period.
                            </span>
                          </td>
                        </tr>
                      ) : (
                        taxData.qapList.map((p: any, i: number) => {
                          const grossStr = formatCurrencyNoSymbol(p.grossAmount)
                          const taxStr = formatCurrencyNoSymbol(p.taxWithheld)
                          return (
                            <tr
                              key={i}
                              className="hover:bg-gray-50 transition-colors even:bg-gray-50/30"
                            >
                              <td className="p-4 pl-6 text-gray-500 font-medium">
                                {new Date(p.date).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-gray-800 font-extrabold">{p.payeeName}</td>
                              <td className="p-4 text-gray-500 font-mono font-bold">{p.tin}</td>
                              <td className="p-4 text-center">
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded border border-blue-100">
                                  {p.atc}
                                </span>
                              </td>
                              <td className="p-4 text-right text-gray-800 font-mono font-bold tabular-nums">
                                {grossStr || <span className="text-gray-300">-</span>}
                              </td>
                              <td className="p-4 pr-6 text-right text-[#1B9387] font-black font-mono tabular-nums">
                                {taxStr || <span className="text-[#1B9387]/30">-</span>}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. RELIEF / SLSP DAT FILE GENERATOR */}
          {/* ============================================================ */}
          {!loading && !errorMessage && reliefData && view === 'relief' && (
            <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
              {/* Stretched Table Area */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm min-h-0">
                <div className="bg-[#FBF8F8] border-b border-gray-200 p-5 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide">
                      Annex B: Summary List of Purchases
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      Required electronic attachment for Form 2550Q.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadSLSP}
                    disabled={reliefData.annexB_Purchases.length === 0}
                    className="bg-[#1B9387] hover:bg-[#157A70] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-md transition flex items-center space-x-2 shadow-sm cursor-pointer"
                  >
                    <Download size={16} /> <span>Download .DAT</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-white">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <tr>
                        <th className="p-4 pl-6 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-32">
                          Date
                        </th>
                        <th className="p-4 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                          Payee/Supplier
                        </th>
                        <th className="p-4 text-left text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          TIN
                        </th>
                        <th className="p-4 text-right text-[10px] text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          Gross
                        </th>
                        <th className="p-4 pr-6 text-right text-[10px] text-orange-600 font-extrabold uppercase tracking-wider border-b border-gray-200 w-40">
                          Input Tax (12%)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reliefData.annexB_Purchases.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-20 text-center text-gray-400 bg-gray-50/30">
                            <Inbox size={48} className="mx-auto mb-4 opacity-30" />
                            <span className="italic font-medium text-sm">
                              No vatable purchases recorded with Payee TINs this period.
                            </span>
                          </td>
                        </tr>
                      ) : (
                        reliefData.annexB_Purchases.map((p: any, i: number) => {
                          const grossStr = formatCurrencyNoSymbol(p.grossAmount)
                          const taxStr = formatCurrencyNoSymbol(p.tax)
                          return (
                            <tr
                              key={i}
                              className="hover:bg-gray-50 transition-colors even:bg-gray-50/30"
                            >
                              <td className="p-4 pl-6 text-gray-500 font-medium">
                                {new Date(p.date).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-gray-800 font-extrabold">{p.supplierName}</td>
                              <td className="p-4 text-gray-500 font-mono font-bold">{p.tin}</td>
                              <td className="p-4 text-right text-gray-800 font-mono font-bold tabular-nums">
                                {grossStr || <span className="text-gray-300">-</span>}
                              </td>
                              <td className="p-4 pr-6 text-right text-orange-600 font-black font-mono tabular-nums">
                                {taxStr || <span className="text-orange-300">-</span>}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
