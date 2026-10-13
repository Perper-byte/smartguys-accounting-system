// src/renderer/src/components/BIRReportsView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  FileText,
  Printer,
  Download,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Users,
  ShieldCheck
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { ReliefGeneratorEngine } from '../../../shared/relief-engine'

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

  const [view, setView] = useState<'2550Q' | '0619E' | '1601EQ' | '1601C' | 'relief'>('2550Q')

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
      // 2. Monthly Compensation Tax (1601-C)
      else if (view === '1601C') {
        if (!api?.generate1601C) throw new Error('Missing backend API for 1601-C.')
        const data = await api.generate1601C(year, month)
        if (data?.error) throw new Error(data.error)
        setTaxData(data)
        setReliefData(null)
      }
      // 3. Quarterly EWT (1601-EQ / 1604-E)
      else if (view === '1601EQ') {
        if (!api?.generate1601EQ) throw new Error('Missing backend API for 1601-EQ.')
        const data = await api.generate1601EQ(year, quarter)
        if (data?.error) throw new Error(data.error)
        setTaxData(data)
        setReliefData(null)
      }
      // 4. Quarterly VAT & RELIEF (2550Q)
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
    if (val === null || val === undefined || val === 0) return null
    return `₱ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const [reliefTab, setReliefTab] = useState<'sales' | 'purchases'>('sales')

  const handleExportPDF = () => {
    window.print()
  }

  // Helper to sanitize TIN for BIR format: strictly 9 digits, no hyphens
  const sanitizeTin = (tinStr?: string): string => {
    const raw = (tinStr || '').replace(/\D/g, '')
    return (raw.padEnd(9, '0')).substring(0, 9)
  }

  // Official BIR RELIEF DAT Generator for Sales (SLSS - Annex A)
  const handleDownloadSLSS = () => {
    if (!reliefData || !reliefData.annexA_Sales || reliefData.annexA_Sales.length === 0) {
      return alert('No Sales data available for BIR RELIEF.')
    }

    if (reliefData.salesDatFile && reliefData.salesFileName) {
      return triggerDownload(reliefData.salesDatFile, reliefData.salesFileName)
    }

    const h = reliefData.header || {
      tin: '748392019',
      branchCode: '0000',
      registeredName: 'SMARTGUYS COMMUNITY HEALTHCARE INC.',
      streetAddress: 'Katapatan Mutual Homes',
      districtAddress: 'Cabuyao Laguna 4025',
      periodMonth: quarter === 0 ? '12' : String(quarter * 3).padStart(2, '0')
    }

    const periodMM = h.periodMonth || (quarter === 0 ? '12' : String(quarter * 3).padStart(2, '0'))
    const compileResult = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: `${periodMM}/${year}`,
      owner: {
        tin: h.tin,
        branchCode: h.branchCode,
        registeredName: h.registeredName,
        streetAddress: 'Katapatan Mutual Homes',
        districtAddress: 'Cabuyao Laguna 4025',
        rdoCode: '057',
        fiscalYearEndMonth: '12'
      },
      records: reliefData.annexA_Sales
    })

    triggerDownload(compileResult.fileContent, compileResult.fileName)
  }

  // Official BIR RELIEF DAT Generator for Purchases (SLSP - Annex B)
  const handleDownloadSLSP = () => {
    if (!reliefData || !reliefData.annexB_Purchases || reliefData.annexB_Purchases.length === 0) {
      return alert('No Purchases data available for BIR RELIEF.')
    }

    if (reliefData.purchasesDatFile && reliefData.purchasesFileName) {
      return triggerDownload(reliefData.purchasesDatFile, reliefData.purchasesFileName)
    }

    const h = reliefData.header || {
      tin: '748392019',
      branchCode: '0000',
      registeredName: 'SMARTGUYS COMMUNITY HEALTHCARE INC.',
      streetAddress: 'Katapatan Mutual Homes',
      districtAddress: 'Cabuyao Laguna 4025',
      periodMonth: quarter === 0 ? '12' : String(quarter * 3).padStart(2, '0')
    }

    const periodMM = h.periodMonth || (quarter === 0 ? '12' : String(quarter * 3).padStart(2, '0'))
    const compileResult = ReliefGeneratorEngine.compile({
      type: 'P',
      taxableMonth: `${periodMM}/${year}`,
      owner: {
        tin: h.tin,
        branchCode: h.branchCode,
        registeredName: h.registeredName,
        streetAddress: 'Katapatan Mutual Homes',
        districtAddress: 'Cabuyao Laguna 4025',
        rdoCode: '057',
        fiscalYearEndMonth: '12'
      },
      records: reliefData.annexB_Purchases
    })

    triggerDownload(compileResult.fileContent, compileResult.fileName)
  }

  // Excel Export for Sales (SLSS - Annex A)
  const handleExportExcelSLSS = () => {
    if (!reliefData || !reliefData.annexA_Sales || reliefData.annexA_Sales.length === 0) {
      return alert('No Sales data available for Excel export.')
    }

    const rows = reliefData.annexA_Sales.map((s: any) => ({
      'Date': s.date ? new Date(s.date).toISOString().slice(0, 10) : '',
      'Customer / Buyer Name': s.customerName || 'Walk-in Patient',
      'TIN': s.tin || '',
      'Branch Code': s.branchCode || '0000',
      'Address': s.address || '',
      'Gross Sales': Number((s.grossAmount || 0).toFixed(2)),
      'Exempt Sales': Number((s.exemptSales || 0).toFixed(2)),
      'Zero-Rated Sales': Number((s.zeroRatedSales || 0).toFixed(2)),
      'Taxable Sales': Number((s.taxableSales || 0).toFixed(2)),
      'Output VAT (12%)': Number((s.outputTax || 0).toFixed(2))
    }))

    const totals = reliefData.salesTotals || {}
    rows.push({
      'Date': 'TOTAL',
      'Customer / Buyer Name': `${reliefData.annexA_Sales.length} Transactions`,
      'TIN': '',
      'Branch Code': '',
      'Address': '',
      'Gross Sales': Number((totals.totalGross || 0).toFixed(2)),
      'Exempt Sales': Number((totals.totalExempt || 0).toFixed(2)),
      'Zero-Rated Sales': Number((totals.totalZeroRated || 0).toFixed(2)),
      'Taxable Sales': Number((totals.totalTaxable || 0).toFixed(2)),
      'Output VAT (12%)': Number((totals.totalOutputTax || 0).toFixed(2))
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SLS - Sales')
    const fileName = `BIR_RELIEF_Sales_${year}_${quarter === 0 ? 'Annual' : `Q${quarter}`}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  // Excel Export for Purchases (SLSP - Annex B)
  const handleExportExcelSLSP = () => {
    if (!reliefData || !reliefData.annexB_Purchases || reliefData.annexB_Purchases.length === 0) {
      return alert('No Purchases data available for Excel export.')
    }

    const rows = reliefData.annexB_Purchases.map((p: any) => ({
      'Date': p.date ? new Date(p.date).toISOString().slice(0, 10) : '',
      'Supplier / Vendor Name': p.supplierName || 'Unknown Supplier',
      'TIN': p.tin || '',
      'Branch Code': p.branchCode || '0000',
      'Address': p.address || '',
      'Exempt Purchases': Number((p.exemptPurchases || 0).toFixed(2)),
      'Zero-Rated Purchases': Number((p.zeroRatedPurchases || 0).toFixed(2)),
      'Services Purchases': Number((p.servicesPurchases || 0).toFixed(2)),
      'Capital Goods': Number((p.capitalPurchases || 0).toFixed(2)),
      'Other Goods': Number((p.goodsPurchases || 0).toFixed(2)),
      'Input VAT': Number((p.tax || 0).toFixed(2)),
      'Gross Purchases': Number((p.grossAmount || 0).toFixed(2))
    }))

    const totals = reliefData.purchasesTotals || {}
    rows.push({
      'Date': 'TOTAL',
      'Supplier / Vendor Name': `${reliefData.annexB_Purchases.length} Transactions`,
      'TIN': '',
      'Branch Code': '',
      'Address': '',
      'Exempt Purchases': Number((totals.totalExempt || 0).toFixed(2)),
      'Zero-Rated Purchases': Number((totals.totalZeroRated || 0).toFixed(2)),
      'Services Purchases': Number((totals.totalServices || 0).toFixed(2)),
      'Capital Goods': Number((totals.totalCapital || 0).toFixed(2)),
      'Other Goods': Number((totals.totalGoods || 0).toFixed(2)),
      'Input VAT': Number((totals.totalInputTax || 0).toFixed(2)),
      'Gross Purchases': Number((totals.totalGross || 0).toFixed(2))
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SLP - Purchases')
    const fileName = `BIR_RELIEF_Purchases_${year}_${quarter === 0 ? 'Annual' : `Q${quarter}`}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  // Combined Excel Export for Full RELIEF (both Sales & Purchases)
  const handleExportExcelCombined = () => {
    if (!reliefData) return alert('No RELIEF data available for Excel export.')

    const workbook = XLSX.utils.book_new()
    let hasSheet = false

    if (reliefData.annexA_Sales && reliefData.annexA_Sales.length > 0) {
      const salesRows = reliefData.annexA_Sales.map((s: any) => ({
        'Date': s.date ? new Date(s.date).toISOString().slice(0, 10) : '',
        'Customer / Buyer Name': s.customerName || 'Walk-in Patient',
        'TIN': s.tin || '',
        'Branch Code': s.branchCode || '0000',
        'Address': s.address || '',
        'Gross Sales': Number((s.grossAmount || 0).toFixed(2)),
        'Exempt Sales': Number((s.exemptSales || 0).toFixed(2)),
        'Zero-Rated Sales': Number((s.zeroRatedSales || 0).toFixed(2)),
        'Taxable Sales': Number((s.taxableSales || 0).toFixed(2)),
        'Output VAT (12%)': Number((s.outputTax || 0).toFixed(2))
      }))
      const sTotals = reliefData.salesTotals || {}
      salesRows.push({
        'Date': 'TOTAL',
        'Customer / Buyer Name': `${reliefData.annexA_Sales.length} Transactions`,
        'TIN': '',
        'Branch Code': '',
        'Address': '',
        'Gross Sales': Number((sTotals.totalGross || 0).toFixed(2)),
        'Exempt Sales': Number((sTotals.totalExempt || 0).toFixed(2)),
        'Zero-Rated Sales': Number((sTotals.totalZeroRated || 0).toFixed(2)),
        'Taxable Sales': Number((sTotals.totalTaxable || 0).toFixed(2)),
        'Output VAT (12%)': Number((sTotals.totalOutputTax || 0).toFixed(2))
      })
      const wsSales = XLSX.utils.json_to_sheet(salesRows)
      XLSX.utils.book_append_sheet(workbook, wsSales, 'Summary List of Sales')
      hasSheet = true
    }

    if (reliefData.annexB_Purchases && reliefData.annexB_Purchases.length > 0) {
      const purchasesRows = reliefData.annexB_Purchases.map((p: any) => ({
        'Date': p.date ? new Date(p.date).toISOString().slice(0, 10) : '',
        'Supplier / Vendor Name': p.supplierName || 'Unknown Supplier',
        'TIN': p.tin || '',
        'Branch Code': p.branchCode || '0000',
        'Address': p.address || '',
        'Exempt Purchases': Number((p.exemptPurchases || 0).toFixed(2)),
        'Zero-Rated Purchases': Number((p.zeroRatedPurchases || 0).toFixed(2)),
        'Services Purchases': Number((p.servicesPurchases || 0).toFixed(2)),
        'Capital Goods': Number((p.capitalPurchases || 0).toFixed(2)),
        'Other Goods': Number((p.goodsPurchases || 0).toFixed(2)),
        'Input VAT': Number((p.tax || 0).toFixed(2)),
        'Gross Purchases': Number((p.grossAmount || 0).toFixed(2))
      }))
      const pTotals = reliefData.purchasesTotals || {}
      purchasesRows.push({
        'Date': 'TOTAL',
        'Supplier / Vendor Name': `${reliefData.annexB_Purchases.length} Transactions`,
        'TIN': '',
        'Branch Code': '',
        'Address': '',
        'Exempt Purchases': Number((pTotals.totalExempt || 0).toFixed(2)),
        'Zero-Rated Purchases': Number((pTotals.totalZeroRated || 0).toFixed(2)),
        'Services Purchases': Number((pTotals.totalServices || 0).toFixed(2)),
        'Capital Goods': Number((pTotals.totalCapital || 0).toFixed(2)),
        'Other Goods': Number((pTotals.totalGoods || 0).toFixed(2)),
        'Input VAT': Number((pTotals.totalInputTax || 0).toFixed(2)),
        'Gross Purchases': Number((pTotals.totalGross || 0).toFixed(2))
      })
      const wsPurchases = XLSX.utils.json_to_sheet(purchasesRows)
      XLSX.utils.book_append_sheet(workbook, wsPurchases, 'Summary List of Purchases')
      hasSheet = true
    }

    if (!hasSheet) return alert('No Sales or Purchases data available to export.')

    const fileName = `BIR_RELIEF_Complete_${year}_${quarter === 0 ? 'Annual' : `Q${quarter}`}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  // Generic Excel Export for whatever view is currently active
  const handleExportActiveViewExcel = () => {
    if (view === 'relief') {
      handleExportExcelCombined()
      return
    }

    if (!taxData) return alert('No tax data available for Excel export.')

    const workbook = XLSX.utils.book_new()

    if (view === '2550Q') {
      const summaryRows = [
        { 'Line Item': 'Item 12: Vatable Sales (Net of VAT)', 'Amount (PHP)': taxData.vatableSales || 0 },
        { 'Line Item': 'Item 13: VAT-Exempt Sales', 'Amount (PHP)': taxData.vatExemptSales || 0 },
        { 'Line Item': 'Item 14: Total Gross Sales', 'Amount (PHP)': taxData.grossSales || 0 },
        { 'Line Item': 'Item 15: Output VAT (12%)', 'Amount (PHP)': taxData.outputTax || 0 },
        { 'Line Item': 'Item 16: Domestic Purchases (Capital Goods)', 'Amount (PHP)': 0 },
        { 'Line Item': 'Item 17: Domestic Purchases (Goods other than Capital)', 'Amount (PHP)': taxData.taxablePurchases || 0 },
        { 'Line Item': 'Item 18: Total Input VAT Claimed', 'Amount (PHP)': taxData.inputTax || 0 },
        { 'Line Item': 'Item 19: Creditable Withholding VAT (Form 2307)', 'Amount (PHP)': taxData.creditableVatWithheld || 0 },
        { 'Line Item': 'Item 20: Net VAT Payable / (Overpayment)', 'Amount (PHP)': taxData.netVatPayable || 0 }
      ]
      const ws = XLSX.utils.json_to_sheet(summaryRows)
      XLSX.utils.book_append_sheet(workbook, ws, 'BIR Form 2550Q')
      XLSX.writeFile(workbook, `BIR_Form_2550Q_${year}_${quarter === 0 ? 'Annual' : `Q${quarter}`}.xlsx`)
      return
    }

    if (view === '0619E' || view === '1601EQ') {
      const list = taxData.qapList || []
      const rows = list.map((item: any) => ({
        'Date': item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
        'Payee Name': item.payeeName || '',
        'TIN': item.tin || '',
        'ATC Code': item.atc || '',
        'Nature of Income Payment': item.nature || '',
        'Tax Rate': `${item.rate || 0}%`,
        'Gross Amount': Number((item.grossAmount || 0).toFixed(2)),
        'Tax Withheld': Number((item.taxWithheld || 0).toFixed(2))
      }))
      rows.push({
        'Date': 'TOTAL',
        'Payee Name': `${list.length} Records`,
        'TIN': '',
        'ATC Code': '',
        'Nature of Income Payment': '',
        'Tax Rate': '',
        'Gross Amount': Number((taxData.totalGrossEwt || 0).toFixed(2)),
        'Tax Withheld': Number((taxData.ewtWithheld || 0).toFixed(2))
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      const formName = view === '0619E' ? 'Form 0619-E' : quarter === 0 ? 'Form 1604-E' : 'Form 1601-EQ'
      XLSX.utils.book_append_sheet(workbook, ws, formName)
      XLSX.writeFile(workbook, `BIR_${formName.replace(/\s+/g, '_')}_${year}_${getPeriodLabel().replace(/\s+/g, '_')}.xlsx`)
      return
    }

    if (view === '1601C') {
      const emps = taxData.employees || []
      const rows = emps.map((emp: any) => ({
        'Employee Name': emp.employeeName || '',
        'TIN': emp.tin || '',
        'Gross Compensation': Number((emp.grossCompensation || 0).toFixed(2)),
        'Non-Taxable Compensation': Number((emp.nonTaxableCompensation || 0).toFixed(2)),
        'Taxable Compensation': Number((emp.taxableCompensation || 0).toFixed(2)),
        'Tax Withheld': Number((emp.taxWithheld || 0).toFixed(2))
      }))
      rows.push({
        'Employee Name': 'TOTAL',
        'TIN': `${emps.length} Employees`,
        'Gross Compensation': Number((taxData.totalGrossCompensation || 0).toFixed(2)),
        'Non-Taxable Compensation': Number((taxData.totalNonTaxableCompensation || 0).toFixed(2)),
        'Taxable Compensation': Number((taxData.totalTaxableCompensation || 0).toFixed(2)),
        'Tax Withheld': Number((taxData.totalTaxRequiredWithheld || 0).toFixed(2))
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(workbook, ws, 'Form 1601-C')
      XLSX.writeFile(workbook, `BIR_Form_1601C_${year}_${getMonthName(month)}.xlsx`)
      return
    }
  }

  const handleDownloadQAP = () => {
    if (!taxData || !taxData.qapList || taxData.qapList.length === 0)
      return alert('No EWT data available.')
    const lines = taxData.qapList.map((p: any) => {
      const tinClean = sanitizeTin(p.tin)
      return `D1,${tinClean},0000,"${p.payeeName}","${p.atc}",${(p.grossAmount || 0).toFixed(2)},${(p.taxWithheld || 0).toFixed(2)}`
    })

    const fileName =
      quarter === 0 ? `QAP_1604E_Annual_${year}.dat` : `QAP_1601EQ_Q${quarter}_${year}.dat`
    triggerDownload(lines.join('\r\n'), fileName)
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

  const getPeriodLabel = () => {
    if (view === '0619E' || view === '1601C') {
      return `${getMonthName(month)} ${year}`
    }
    if (quarter === 0) return `Annual ${year} (Full Year)`
    return `Q${quarter} ${year}`
  }

  return (
    <div className="w-full min-h-full flex flex-col p-4 md:p-6 lg:p-8 bg-gray-50/30 font-sans text-gray-800 print:p-0 print:bg-white print:block">
      <div className="w-full max-w-7xl mx-auto bg-white border border-gray-200/80 rounded-2xl p-6 lg:p-8 shadow-xs flex flex-col print:shadow-none print:border-none print:p-0">
        
        {/* PRINT BRANDING HEADER (Visible only when printed) */}
        <div className="hidden print:block mb-6 border-b-2 border-gray-900 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-gray-900">
                SMARTGUYS CLINIC INC.
              </h1>
              <p className="text-xs text-gray-600 font-bold">
                BIR Tax Compliance & Statutory Financial Report
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black font-mono px-3 py-1 bg-gray-100 rounded border border-gray-300">
                {view === '2550Q' && 'BIR FORM 2550Q (QUARTERLY VAT)'}
                {view === '0619E' && 'BIR FORM 0619-E (MONTHLY EWT)'}
                {view === '1601EQ' && (quarter === 0 ? 'BIR FORM 1604-E (ANNUAL EWT)' : 'BIR FORM 1601-EQ (QUARTERLY EWT)')}
                {view === '1601C' && 'BIR FORM 1601-C (COMPENSATION TAX)'}
                {view === 'relief' && 'SLSP ANNEX B (PURCHASES LIST)'}
              </span>
              <p className="text-xs text-gray-500 font-bold mt-1">
                Filing Period: {getPeriodLabel()}
              </p>
            </div>
          </div>
        </div>

        {/* HEADER & CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 border-b border-[#B0DCDA] pb-6 print:hidden shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#E9FAFA] rounded-lg text-[#1B9387]">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                  BIR Tax Compliance
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  EOPT-Ready Tax Summaries, Audit Trails, and Electronic DAT Generators
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 bg-white border border-gray-300 rounded-md p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Period
              </label>
              {view === '0619E' || view === '1601C' ? (
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-40 bg-white border border-gray-300 rounded-md p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none cursor-pointer shadow-sm transition"
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
                  className="w-44 bg-white border border-gray-300 rounded-md p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none cursor-pointer shadow-sm transition"
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
              onClick={handleExportActiveViewExcel}
              className="px-4 py-2 h-[38px] bg-[#107c41] hover:bg-[#0e6b38] text-white text-xs font-bold rounded-md tracking-wider uppercase transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Export current view to Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} /> <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 h-[38px] bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold text-gray-700 rounded-md tracking-wider uppercase transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Print report or export to PDF"
            >
              <Printer size={15} /> <span>Print Form</span>
            </button>
          </div>
        </div>

        {/* UNIFIED TABS */}
        <div className="flex flex-wrap gap-1.5 bg-[#FBF8F8] p-1.5 rounded-xl border border-[#B0DCDA] shadow-inner w-fit mb-6 print:hidden shrink-0">
          <button
            onClick={() => setView('2550Q')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition uppercase tracking-wider cursor-pointer ${
              view === '2550Q'
                ? 'bg-[#1B9387] text-white shadow-xs'
                : 'text-gray-600 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
            }`}
          >
            Form 2550Q (VAT)
          </button>
          <button
            onClick={() => setView('0619E')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition uppercase tracking-wider cursor-pointer ${
              view === '0619E'
                ? 'bg-[#1B9387] text-white shadow-xs'
                : 'text-gray-600 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
            }`}
          >
            Form 0619-E (Monthly EWT)
          </button>
          <button
            onClick={() => setView('1601EQ')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition uppercase tracking-wider cursor-pointer ${
              view === '1601EQ'
                ? 'bg-[#1B9387] text-white shadow-xs'
                : 'text-gray-600 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
            }`}
          >
            {quarter === 0 ? 'Form 1604-E (Annual EWT)' : 'Form 1601-EQ (Quarterly EWT)'}
          </button>
          <button
            onClick={() => setView('1601C')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition uppercase tracking-wider cursor-pointer ${
              view === '1601C'
                ? 'bg-[#1B9387] text-white shadow-xs'
                : 'text-gray-600 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
            }`}
          >
            Form 1601-C (Compensation)
          </button>
          <button
            onClick={() => setView('relief')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition uppercase tracking-wider cursor-pointer ${
              view === 'relief'
                ? 'bg-[#1B9387] text-white shadow-xs'
                : 'text-gray-600 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
            }`}
          >
            RELIEF / SLSP Generator
          </button>
        </div>

        {loading && (
          <div className="py-20 flex flex-col justify-center items-center text-center">
            <div className="h-10 w-10 rounded-full border-4 border-[#E9FAFA] border-t-[#1B9387] animate-spin" />
            <p className="mt-4 font-bold text-gray-800">Preparing tax report…</p>
            <p className="mt-1 text-xs text-gray-500 font-medium">
              Crunching ledger transactions for {getPeriodLabel()}.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="py-16 flex flex-col justify-center items-center text-center">
            <div className="max-w-md rounded-2xl border border-red-200 bg-red-50/70 p-6 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={22} />
              </div>
              <p className="font-extrabold text-red-700 uppercase tracking-wider text-sm">
                Could not load report
              </p>
              <p className="mt-2 text-xs text-red-600 font-medium leading-relaxed">{errorMessage}</p>
              <button
                onClick={fetchTaxData}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
              >
                <RefreshCw size={12} />
                <span>Try again</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 1. FORM 2550Q (VAT) VIEW */}
        {/* ============================================================ */}
        {!loading && taxData && view === '2550Q' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8 shadow-xs print:border-none print:shadow-none print:p-0">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-800">
                    Part IV - Details of VAT Computation
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Official quarterly computation conforming to BIR Form 2550Q specifications.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-md print:hidden">
                  {quarter === 0 ? `Annual ${year}` : `Q${quarter} ${year}`}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Total Sales & Output Tax */}
                <div className="space-y-3.5 text-sm">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 border-b border-gray-100 pb-1.5">
                    Total Sales & Output Tax
                  </h4>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-600 font-medium">Item 31A: Vatable Sales</span>
                    <span className="font-mono font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(taxData.vatableSales) || (
                        <span className="text-gray-300">-</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-[#E9FAFA]/60 p-3 rounded-xl border border-[#B0DCDA]">
                    <span className="text-[#1B9387] font-black text-sm">
                      Item 31B: Output Tax (12%)
                    </span>
                    <span className="font-mono text-[#1B9387] font-black tabular-nums whitespace-nowrap text-base">
                      {formatCurrency(taxData.outputVat) || (
                        <span className="text-[#1B9387]/30">-</span>
                      )}
                    </span>
                  </div>
                  <div className="pt-2"></div>
                  <div className="flex justify-between items-start py-1">
                    <span className="text-gray-600 font-medium">
                      Item 33: VAT-Exempt Sales <br />
                      <span className="text-[10px] text-gray-400 font-normal uppercase tracking-wider">
                        (Consultations, Labs, SC/PWD)
                      </span>
                    </span>
                    <span className="font-mono font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(taxData.exemptSales) || (
                        <span className="text-gray-300">-</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Allowable Input Tax */}
                <div className="space-y-3.5 text-sm">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 border-b border-gray-100 pb-1.5">
                    Allowable Input Tax
                  </h4>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-600 font-medium">Item 44A: Domestic Purchases</span>
                    <span className="font-mono font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(taxData.vatablePurchases) || (
                        <span className="text-gray-300">-</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-orange-50/60 p-3 rounded-xl border border-orange-200">
                    <span className="text-orange-700 font-black text-sm">
                      Item 44B: Input Tax (12%)
                    </span>
                    <span className="font-mono text-orange-700 font-black tabular-nums whitespace-nowrap text-base">
                      {formatCurrency(taxData.inputVat) || (
                        <span className="text-orange-300">-</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tax Credits & Payments */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">
                  Tax Credits & Payments
                </h4>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-orange-50/60 p-3.5 rounded-xl border border-orange-200 max-w-xl">
                  <span className="text-orange-800 font-extrabold text-sm leading-tight mb-2 sm:mb-0">
                    Item 16: Creditable VAT Withheld <br />
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                      (Withholding Agents / HMOs - Form 2307)
                    </span>
                  </span>
                  <span className="font-mono text-orange-800 font-black tabular-nums whitespace-nowrap text-base">
                    {formatCurrency(taxData.creditableVatWithheld) || (
                      <span className="text-orange-300">-</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Net VAT Banner */}
            <div
              className={`border-2 rounded-2xl p-6 lg:p-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm print:border-none print:shadow-none print:p-0 print:mt-6 ${
                taxData.netVatPayable <= 0
                  ? 'bg-emerald-50/80 border-emerald-300'
                  : 'bg-rose-50/80 border-rose-300'
              }`}
            >
              <div>
                <h3
                  className={`text-lg font-black uppercase tracking-wider ${
                    taxData.netVatPayable <= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  Item 15: Net VAT ${taxData.netVatPayable <= 0 ? 'Overpayment' : 'Payable'}
                </h3>
                <p
                  className={`text-xs mt-1 font-bold ${
                    taxData.netVatPayable <= 0 ? 'text-emerald-700/80' : 'text-rose-700/80'
                  }`}
                >
                  Output VAT less (Input VAT + CWT Credits) for ${getPeriodLabel()}
                </p>
              </div>
              <span
                className={`text-3xl lg:text-4xl font-black font-mono tabular-nums whitespace-nowrap ${
                  taxData.netVatPayable <= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
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
        {!loading && taxData && view === '0619E' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-800">
                    Form 0619-E Summary (Monthly)
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Monthly remittance of creditable income taxes withheld (Expanded Withholding Tax) for ${getMonthName(month)} ${year}.
                  </p>
                </div>
                <div className="bg-[#E9FAFA]/80 border border-[#B0DCDA] rounded-xl px-6 py-4 flex items-center justify-between gap-6 w-full sm:w-auto">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1B9387] block">
                      Total Taxes Withheld
                    </span>
                    <span className="text-xs text-gray-500 font-medium">Remit to BIR</span>
                  </div>
                  <span className="text-2xl lg:text-3xl font-black font-mono text-[#1B9387] tabular-nums whitespace-nowrap">
                    {formatCurrency(taxData.ewtWithheld) || <span className="opacity-30">₱ 0.00</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
              <div className="bg-[#FBF8F8] border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                    Withholding Tax Breakdown
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Itemized list of payee payouts subjected to EWT this month.
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                  {taxData.qapList?.length || 0} Transactions
                </span>
              </div>

              <div className="overflow-x-auto max-h-[560px] print:max-h-none print:overflow-visible">
                <table className="w-full text-sm min-w-[760px] border-collapse">
                  <thead className="text-gray-500 text-[10px] font-black uppercase tracking-wider bg-gray-50/90 border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-4 pl-6 text-left w-28 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 text-left min-w-[200px]">Payee (Doctor / Landlord)</th>
                      <th className="py-3 px-4 text-left w-36 whitespace-nowrap">TIN</th>
                      <th className="py-3 px-4 text-center w-24 whitespace-nowrap">ATC</th>
                      <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Gross Payout</th>
                      <th className="py-3 px-4 pr-6 text-right w-36 whitespace-nowrap text-[#1B9387]">Tax Withheld</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!taxData.qapList || taxData.qapList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-gray-400">
                          <span className="block text-4xl mb-2 opacity-40">📂</span>
                          <span className="italic font-medium text-sm">
                            No withholding taxes recorded this month.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      taxData.qapList.map((p: any, i: number) => {
                        const grossStr = formatCurrency(p.grossAmount)
                        const taxStr = formatCurrency(p.taxWithheld)
                        return (
                          <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                            <td className="py-3 px-4 pl-6 text-gray-600 font-medium whitespace-nowrap text-xs">
                              {new Date(p.date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-900 max-w-[240px] truncate" title={p.payeeName}>
                              {p.payeeName}
                            </td>
                            <td className="py-3 px-4 text-gray-600 font-mono font-bold text-xs whitespace-nowrap">
                              {p.tin || '—'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2 py-0.5 text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded">
                                {p.atc}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-800 font-mono font-bold tabular-nums whitespace-nowrap">
                              {grossStr || <span className="text-gray-300">-</span>}
                            </td>
                            <td className="py-3 px-4 pr-6 text-right text-[#1B9387] font-black font-mono tabular-nums whitespace-nowrap">
                              {taxStr || <span className="text-[#1B9387]/30">-</span>}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {taxData.qapList && taxData.qapList.length > 0 && (
                    <tfoot className="bg-gray-50/90 font-black border-t-2 border-gray-200 text-xs">
                      <tr>
                        <td colSpan={4} className="py-3.5 px-4 pl-6 text-gray-700 uppercase tracking-wider">
                          Total For ${getMonthName(month)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.qapList.reduce((s: number, r: any) => s + (Number(r.grossAmount) || 0), 0)) || '₱ 0.00'}
                        </td>
                        <td className="py-3.5 px-4 pr-6 text-right font-mono font-black text-[#1B9387] tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.ewtWithheld) || '₱ 0.00'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. FORM 1601-EQ / 1604-E VIEW + ALPHALIST (QAP) */}
        {/* ============================================================ */}
        {!loading && taxData && view === '1601EQ' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-800">
                    {quarter === 0
                      ? 'Form 1604-E Summary (Annual)'
                      : 'Form 1601-EQ Summary (Quarterly)'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Taxes withheld from Doctor Professional Fees and Rent (ATC WI010 / WI100) for ${getPeriodLabel()}.
                  </p>
                </div>
                <div className="bg-[#E9FAFA]/80 border border-[#B0DCDA] rounded-xl px-6 py-4 flex items-center justify-between gap-6 w-full sm:w-auto">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1B9387] block">
                      Total Taxes Withheld
                    </span>
                    <span className="text-xs text-gray-500 font-medium">EWT Remittance</span>
                  </div>
                  <span className="text-2xl lg:text-3xl font-black font-mono text-[#1B9387] tabular-nums whitespace-nowrap">
                    {formatCurrency(taxData.ewtWithheld) || <span className="opacity-30">₱ 0.00</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
              <div className="bg-[#FBF8F8] border-b border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                    QAP: Alphalist of Payees
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Required electronic attachment for {quarter === 0 ? '1604-E' : '1601-EQ'}.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                    {taxData.qapList?.length || 0} Payees
                  </span>
                  <button
                    onClick={handleDownloadQAP}
                    disabled={!taxData.qapList || taxData.qapList.length === 0}
                    className="bg-[#1B9387] hover:bg-[#28958B] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download size={14} /> <span>Download .DAT</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[560px] print:max-h-none print:overflow-visible">
                <table className="w-full text-sm min-w-[760px] border-collapse">
                  <thead className="text-gray-500 text-[10px] font-black uppercase tracking-wider bg-gray-50/90 border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-4 pl-6 text-left w-28 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 text-left min-w-[200px]">Payee (Doctor / Landlord)</th>
                      <th className="py-3 px-4 text-left w-36 whitespace-nowrap">TIN</th>
                      <th className="py-3 px-4 text-center w-24 whitespace-nowrap">ATC</th>
                      <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Gross Payout</th>
                      <th className="py-3 px-4 pr-6 text-right w-36 whitespace-nowrap text-[#1B9387]">Tax Withheld</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!taxData.qapList || taxData.qapList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-gray-400">
                          <span className="block text-4xl mb-2 opacity-40">📂</span>
                          <span className="italic font-medium text-sm">
                            No withholding taxes recorded this period.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      taxData.qapList.map((p: any, i: number) => {
                        const grossStr = formatCurrency(p.grossAmount)
                        const taxStr = formatCurrency(p.taxWithheld)
                        return (
                          <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                            <td className="py-3 px-4 pl-6 text-gray-600 font-medium whitespace-nowrap text-xs">
                              {new Date(p.date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-900 max-w-[240px] truncate" title={p.payeeName}>
                              {p.payeeName}
                            </td>
                            <td className="py-3 px-4 text-gray-600 font-mono font-bold text-xs whitespace-nowrap">
                              {p.tin || '—'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2 py-0.5 text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded">
                                {p.atc}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-800 font-mono font-bold tabular-nums whitespace-nowrap">
                              {grossStr || <span className="text-gray-300">-</span>}
                            </td>
                            <td className="py-3 px-4 pr-6 text-right text-[#1B9387] font-black font-mono tabular-nums whitespace-nowrap">
                              {taxStr || <span className="text-[#1B9387]/30">-</span>}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {taxData.qapList && taxData.qapList.length > 0 && (
                    <tfoot className="bg-gray-50/90 font-black border-t-2 border-gray-200 text-xs">
                      <tr>
                        <td colSpan={4} className="py-3.5 px-4 pl-6 text-gray-700 uppercase tracking-wider">
                          Total For ${getPeriodLabel()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.qapList.reduce((s: number, r: any) => s + (Number(r.grossAmount) || 0), 0)) || '₱ 0.00'}
                        </td>
                        <td className="py-3.5 px-4 pr-6 text-right font-mono font-black text-[#1B9387] tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.ewtWithheld) || '₱ 0.00'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. FORM 1601-C VIEW (COMPENSATION WITHHOLDING TAX) */}
        {/* ============================================================ */}
        {!loading && taxData && view === '1601C' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Streamlined 4-KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                  Total Gross Compensation
                </span>
                <span className="font-mono text-xl font-black text-gray-900 tabular-nums whitespace-nowrap">
                  {formatCurrency(taxData.totalGrossCompensation) || '₱ 0.00'}
                </span>
                <span className="text-[10px] text-gray-400 font-medium block mt-1">All employee payrolls</span>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                  Non-Taxable (SSS/PH/HDMF)
                </span>
                <span className="font-mono text-xl font-black text-emerald-600 tabular-nums whitespace-nowrap">
                  {formatCurrency(taxData.totalNonTaxableCompensation) || '₱ 0.00'}
                </span>
                <span className="text-[10px] text-emerald-600/80 font-medium block mt-1">Statutory contributions</span>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                  Taxable Compensation
                </span>
                <span className="font-mono text-xl font-black text-blue-600 tabular-nums whitespace-nowrap">
                  {formatCurrency(taxData.totalTaxableCompensation) || '₱ 0.00'}
                </span>
                <span className="text-[10px] text-blue-600/80 font-medium block mt-1">Subject to withholding</span>
              </div>

              <div className="bg-[#E9FAFA]/80 border border-[#B0DCDA] rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-[#1B9387] tracking-wider block mb-1">
                  Total Tax Withheld (Remit)
                </span>
                <span className="font-mono text-xl font-black text-[#1B9387] tabular-nums whitespace-nowrap">
                  {formatCurrency(taxData.totalTaxRequiredWithheld) || '₱ 0.00'}
                </span>
                <span className="text-[10px] text-[#1B9387]/80 font-bold block mt-1">
                  Account 2051 remittance
                </span>
              </div>
            </div>

            {/* Employee Breakdown Table Card */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
              <div className="bg-[#FBF8F8] border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                    Employee Compensation Breakdown
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Itemized payroll compensation and tax withheld per employee for ${getMonthName(month)} ${year}.
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                  {taxData.employeeCount || taxData.employees?.length || 0} Employees
                </span>
              </div>

              <div className="overflow-x-auto max-h-[560px] print:max-h-none print:overflow-visible">
                <table className="w-full text-sm min-w-[880px] border-collapse">
                  <thead className="text-gray-500 text-[10px] font-black uppercase tracking-wider bg-gray-50/90 border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-4 pl-6 text-left w-28 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 text-left min-w-[180px]">Employee Name</th>
                      <th className="py-3 px-4 text-left w-36 whitespace-nowrap">TIN</th>
                      <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Gross Pay</th>
                      <th className="py-3 px-4 text-right w-36 whitespace-nowrap text-emerald-600">Non-Taxable</th>
                      <th className="py-3 px-4 text-right w-36 whitespace-nowrap text-blue-600">Taxable Pay</th>
                      <th className="py-3 px-4 pr-6 text-right w-36 whitespace-nowrap text-[#1B9387]">Tax Withheld</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!taxData.employees || taxData.employees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-gray-400">
                          <span className="block text-4xl mb-2 opacity-40">👥</span>
                          <span className="italic font-medium text-sm">
                            No payroll compensation recorded for this month.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      taxData.employees.map((emp: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 pl-6 text-gray-600 font-medium whitespace-nowrap text-xs">
                            {new Date(emp.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900 max-w-[220px] truncate" title={emp.employeeName}>
                            {emp.employeeName}
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono font-bold text-xs whitespace-nowrap">
                            {emp.tin || '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-800 font-mono font-bold tabular-nums whitespace-nowrap">
                            {formatCurrency(emp.grossCompensation) || '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-mono font-bold tabular-nums whitespace-nowrap">
                            {formatCurrency(emp.nonTaxableContributions) || '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-blue-600 font-mono font-bold tabular-nums whitespace-nowrap">
                            {formatCurrency(emp.taxableCompensation) || '-'}
                          </td>
                          <td className="py-3 px-4 pr-6 text-right text-[#1B9387] font-black font-mono tabular-nums whitespace-nowrap">
                            {formatCurrency(emp.taxWithheld) || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {taxData.employees && taxData.employees.length > 0 && (
                    <tfoot className="bg-gray-50/90 font-black border-t-2 border-gray-200 text-xs">
                      <tr>
                        <td colSpan={3} className="py-3.5 px-4 pl-6 text-gray-700 uppercase tracking-wider">
                          Total For ${getMonthName(month)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.totalGrossCompensation) || '₱ 0.00'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.totalNonTaxableCompensation) || '₱ 0.00'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-blue-600 tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.totalTaxableCompensation) || '₱ 0.00'}
                        </td>
                        <td className="py-3.5 px-4 pr-6 text-right font-mono font-black text-[#1B9387] tabular-nums whitespace-nowrap">
                          {formatCurrency(taxData.totalTaxRequiredWithheld) || '₱ 0.00'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. RELIEF / SLSP & SLSS DAT FILE GENERATOR */}
        {/* ============================================================ */}
        {!loading && reliefData && view === 'relief' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Sub-tab Switcher: Sales (SLSS) vs Purchases (SLSP) */}
            <div className="flex border-b border-gray-200 bg-white rounded-t-2xl p-2 gap-2 shadow-2xs">
              <button
                onClick={() => setReliefTab('sales')}
                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  reliefTab === 'sales'
                    ? 'bg-[#1B9387] text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>Annex A: Sales (SLSS)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  reliefTab === 'sales' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {reliefData.annexA_Sales?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setReliefTab('purchases')}
                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  reliefTab === 'purchases'
                    ? 'bg-[#1B9387] text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>Annex B: Purchases (SLSP)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  reliefTab === 'purchases' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {reliefData.annexB_Purchases?.length || 0}
                </span>
              </button>
            </div>

            {/* ANNEX A: SALES VIEW */}
            {reliefTab === 'sales' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-gray-200 p-6 rounded-2xl shadow-xs">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                      Annex A: Summary List of Sales (SLSS)
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      Compliant BIR RELIEF DAT format (H,S / D,S / C,S) for Form 2550Q ({getPeriodLabel()}).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                      {reliefData.annexA_Sales?.length || 0} Records
                    </span>
                    <button
                      onClick={handleExportExcelSLSS}
                      disabled={!reliefData.annexA_Sales || reliefData.annexA_Sales.length === 0}
                      className="bg-[#107c41] hover:bg-[#0e6b38] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Export Annex A (SLSS) to Excel"
                    >
                      <FileSpreadsheet size={14} /> <span>Export Excel</span>
                    </button>
                    <button
                      onClick={handleDownloadSLSS}
                      disabled={!reliefData.annexA_Sales || reliefData.annexA_Sales.length === 0}
                      className="bg-[#1B9387] hover:bg-[#28958B] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Download size={14} /> <span>Download Sales .DAT</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                  <div className="overflow-x-auto max-h-[560px] print:max-h-none print:overflow-visible">
                    <table className="w-full text-sm min-w-[720px] border-collapse">
                      <thead className="text-gray-500 text-[10px] font-black uppercase tracking-wider bg-gray-50/90 border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="py-3 px-4 pl-6 text-left w-28 whitespace-nowrap">Date</th>
                          <th className="py-3 px-4 text-left min-w-[200px]">Buyer / Patient / HMO</th>
                          <th className="py-3 px-4 text-left w-36 whitespace-nowrap">TIN</th>
                          <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Gross Sales</th>
                          <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Taxable Sales</th>
                          <th className="py-3 px-4 pr-6 text-right w-36 whitespace-nowrap text-teal-600">Output Tax (12%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {!reliefData.annexA_Sales || reliefData.annexA_Sales.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-gray-400">
                              <span className="block text-4xl mb-2 opacity-40">📂</span>
                              <span className="italic font-medium text-sm">
                                No sales transactions recorded for this period.
                              </span>
                            </td>
                          </tr>
                        ) : (
                          reliefData.annexA_Sales.map((s: any, i: number) => {
                            return (
                              <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                                <td className="py-3 px-4 pl-6 text-gray-600 font-medium whitespace-nowrap text-xs">
                                  {new Date(s.date).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 font-bold text-gray-900 max-w-[260px] truncate" title={s.customerName}>
                                  {s.customerName}
                                </td>
                                <td className="py-3 px-4 text-gray-600 font-mono font-bold text-xs whitespace-nowrap">
                                  {s.tin || '—'}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-800 font-mono font-bold tabular-nums whitespace-nowrap">
                                  {formatCurrency(s.grossAmount) || <span className="text-gray-300">-</span>}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-800 font-mono font-bold tabular-nums whitespace-nowrap">
                                  {formatCurrency(s.taxableSales) || <span className="text-gray-300">-</span>}
                                </td>
                                <td className="py-3 px-4 pr-6 text-right text-teal-600 font-black font-mono tabular-nums whitespace-nowrap">
                                  {formatCurrency(s.outputTax) || <span className="text-gray-300">-</span>}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                      {reliefData.annexA_Sales && reliefData.annexA_Sales.length > 0 && (
                        <tfoot className="bg-gray-50/90 font-black border-t-2 border-gray-200 text-xs">
                          <tr>
                            <td colSpan={3} className="py-3.5 px-4 pl-6 text-gray-700 uppercase tracking-wider">
                              Total For {getPeriodLabel()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(reliefData.salesTotals?.totalGross ?? reliefData.annexA_Sales.reduce((sum: number, r: any) => sum + (Number(r.grossAmount) || 0), 0)) || '₱ 0.00'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(reliefData.salesTotals?.totalTaxable ?? reliefData.annexA_Sales.reduce((sum: number, r: any) => sum + (Number(r.taxableSales) || 0), 0)) || '₱ 0.00'}
                            </td>
                            <td className="py-3.5 px-4 pr-6 text-right font-mono font-black text-teal-600 tabular-nums whitespace-nowrap">
                              {formatCurrency(reliefData.salesTotals?.totalOutputTax ?? reliefData.annexA_Sales.reduce((sum: number, r: any) => sum + (Number(r.outputTax) || 0), 0)) || '₱ 0.00'}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ANNEX B: PURCHASES VIEW */}
            {reliefTab === 'purchases' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-gray-200 p-6 rounded-2xl shadow-xs">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                      Annex B: Summary List of Purchases (SLSP)
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      Compliant BIR RELIEF DAT format (H,P / D,P / C,P) for Form 2550Q ({getPeriodLabel()}).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                      {reliefData.annexB_Purchases?.length || 0} Records
                    </span>
                    <button
                      onClick={handleExportExcelSLSP}
                      disabled={!reliefData.annexB_Purchases || reliefData.annexB_Purchases.length === 0}
                      className="bg-[#107c41] hover:bg-[#0e6b38] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Export Annex B (SLSP) to Excel"
                    >
                      <FileSpreadsheet size={14} /> <span>Export Excel</span>
                    </button>
                    <button
                      onClick={handleDownloadSLSP}
                      disabled={!reliefData.annexB_Purchases || reliefData.annexB_Purchases.length === 0}
                      className="bg-[#1B9387] hover:bg-[#28958B] disabled:opacity-50 disabled:bg-gray-400 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Download size={14} /> <span>Download Purchases .DAT</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                  <div className="overflow-x-auto max-h-[560px] print:max-h-none print:overflow-visible">
                    <table className="w-full text-sm min-w-[720px] border-collapse">
                      <thead className="text-gray-500 text-[10px] font-black uppercase tracking-wider bg-gray-50/90 border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="py-3 px-4 pl-6 text-left w-28 whitespace-nowrap">Date</th>
                          <th className="py-3 px-4 text-left min-w-[200px]">Payee / Supplier</th>
                          <th className="py-3 px-4 text-left w-36 whitespace-nowrap">TIN</th>
                          <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Gross Purchases</th>
                          <th className="py-3 px-4 pr-6 text-right w-36 whitespace-nowrap text-orange-600">Input Tax (12%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {!reliefData.annexB_Purchases || reliefData.annexB_Purchases.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-16 text-center text-gray-400">
                              <span className="block text-4xl mb-2 opacity-40">📂</span>
                              <span className="italic font-medium text-sm">
                                No vatable purchases recorded with Payee TINs this period.
                              </span>
                            </td>
                          </tr>
                        ) : (
                          reliefData.annexB_Purchases.map((p: any, i: number) => {
                            const grossStr = formatCurrency(p.grossAmount)
                            const taxStr = formatCurrency(p.tax)
                            return (
                              <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                                <td className="py-3 px-4 pl-6 text-gray-600 font-medium whitespace-nowrap text-xs">
                                  {new Date(p.date).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 font-bold text-gray-900 max-w-[260px] truncate" title={p.supplierName}>
                                  {p.supplierName}
                                </td>
                                <td className="py-3 px-4 text-gray-600 font-mono font-bold text-xs whitespace-nowrap">
                                  {p.tin || '—'}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-800 font-mono font-bold tabular-nums whitespace-nowrap">
                                  {grossStr || <span className="text-gray-300">-</span>}
                                </td>
                                <td className="py-3 px-4 pr-6 text-right text-orange-600 font-black font-mono tabular-nums whitespace-nowrap">
                                  {taxStr || <span className="text-orange-300">-</span>}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                      {reliefData.annexB_Purchases && reliefData.annexB_Purchases.length > 0 && (
                        <tfoot className="bg-gray-50/90 font-black border-t-2 border-gray-200 text-xs">
                          <tr>
                            <td colSpan={3} className="py-3.5 px-4 pl-6 text-gray-700 uppercase tracking-wider">
                              Total For {getPeriodLabel()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(reliefData.purchasesTotals?.totalGross ?? reliefData.annexB_Purchases.reduce((s: number, r: any) => s + (Number(r.grossAmount) || 0), 0)) || '₱ 0.00'}
                            </td>
                            <td className="py-3.5 px-4 pr-6 text-right font-mono font-black text-orange-600 tabular-nums whitespace-nowrap">
                              {formatCurrency(reliefData.purchasesTotals?.totalInputTax ?? reliefData.annexB_Purchases.reduce((s: number, r: any) => s + (Number(r.tax) || 0), 0)) || '₱ 0.00'}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
