// src/renderer/src/components/FinancialStatementsView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react'

export interface FinancialStatementsViewProps {
  onNavigate?: (view: string, props?: any) => void
}

export const FinancialStatementsView: React.FC<FinancialStatementsViewProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [statementType, setStatementType] = useState<'trial' | 'income' | 'balance' | 'cash-flow'>(
    'trial'
  )
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 🔥 FLOATING TOAST STATE
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true)
      setError(null)
      try {
        const api = (window as any).electronAPI || (window as any).api
        let result
        if (statementType === 'trial')
          result = await api.getTrialBalance(selectedYear, selectedMonth)
        else if (statementType === 'income')
          result = await api.getIncomeStatement(selectedYear, selectedMonth)
        else if (statementType === 'balance')
          result = await api.getBalanceSheet(selectedYear, selectedMonth)
        else if (statementType === 'cash-flow')
          result = await api.getCashFlowStatement(selectedYear, selectedMonth)

        setData(result)
      } catch (e: any) {
        console.error(e)
        setError(e.message || 'Failed to load report data.')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [statementType, selectedYear, selectedMonth])

  const formatCurrency = (val: number | null | undefined, isAbnormal: boolean = false) => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return '—'
    const formattedAmount = Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return isAbnormal || val < 0 ? `(₱ ${formattedAmount})` : `₱ ${formattedAmount}`
  }

  const formatCurrencyWithoutSymbol = (
    val: number | null | undefined,
    isAbnormal: boolean = false
  ) => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return '—'
    const formattedAmount = Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return isAbnormal || val < 0 ? `(${formattedAmount})` : formattedAmount
  }

  const handleExportExcel = async () => {
    try {
      const api = (window as any).electronAPI || (window as any).api
      const result = await api.exportTrialBalanceExcel(selectedYear, selectedMonth)
      if (result.success)
        showToast(`Report exported successfully to:\n${result.filePath}`, 'success')
      else if (result.error) showToast(`Export Failed: ${result.error}`, 'error')
    } catch (err: any) {
      showToast(`Export Error: ${err.message || 'Failed to generate Excel.'}`, 'error')
    }
  }

  const handleExportPDF = async () => {
    if (!data) return
    try {
      document.body.classList.add('is-printing')
      // Give the browser a moment to apply print styles before triggering the capture
      await new Promise((resolve) => setTimeout(resolve, 150))

      const api = (window as any).electronAPI || (window as any).api
      const filename = `${statementType.toUpperCase()}_Statement_${selectedYear}_${selectedMonth}.pdf`
      const result = await api.exportPDF(filename)

      if (result && result.success) {
        showToast(`Report saved successfully to:\n${result.filePath}`, 'success')
      } else if (result && result.error) {
        showToast(`Export Failed: ${result.error}`, 'error')
      }
    } catch (err: any) {
      showToast(`Export Error: ${err.message || 'Failed to generate PDF.'}`, 'error')
    } finally {
      document.body.classList.remove('is-printing')
    }
  }

  const getMonthName = (monthNum: number) => {
    return new Date(2000, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' })
  }

  const getLastDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate()
  }

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  const getAccountType = (code: string) => {
    if (!code) return 'Unknown'
    const firstDigit = code.toString().charAt(0)
    if (firstDigit === '1') return 'Asset'
    if (firstDigit === '2') return 'Liability'
    if (firstDigit === '3') return 'Equity'
    if (firstDigit === '4') return 'Revenue'
    if (firstDigit === '5') return 'Expense'
    return 'Unknown'
  }

  const isAbnormalBalance = (code: string, debit: number, credit: number) => {
    const type = getAccountType(code)
    if ((type === 'Asset' || type === 'Expense') && credit > 0 && debit === 0) return true
    if (
      (type === 'Liability' || type === 'Equity' || type === 'Revenue') &&
      debit > 0 &&
      credit === 0
    )
      return true
    return false
  }

  const groupedLines = data?.lines?.reduce(
    (acc: any, line: any) => {
      const type = getAccountType(line.accountCode)
      if (!acc[type]) acc[type] = []
      acc[type].push(line)
      return acc
    },
    {} as Record<string, any[]>
  )

  const accountOrder = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
  const asOfDateStr = `As of ${getMonthName(selectedMonth)} ${getLastDayOfMonth(selectedYear, selectedMonth)}, ${selectedYear}`
  const forMonthStr = `For the month ended ${getMonthName(selectedMonth)} ${getLastDayOfMonth(selectedYear, selectedMonth)}, ${selectedYear}`

  return (
    <div
      id="statement-card"
      className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm min-h-[550px] relative"
    >
      {/* 🚀 FLOATING TOAST PROVIDER */}
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

      {/* HEADER & CONTROLS */}
      <div
        id="fs-controls"
        className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 border-b border-[#B0DCDA] pb-6 print:hidden"
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">
            Monthly Financial Statements
          </h2>

          {/* TAB NAVIGATION */}
          <div
            id="fs-tabs"
            className="flex flex-wrap gap-2 bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner w-fit"
            role="tablist"
          >
            {(['trial', 'income', 'balance', 'cash-flow'] as const).map((type) => (
              <button
                key={type}
                role="tab"
                aria-selected={statementType === type}
                onClick={() => setStatementType(type)}
                className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${
                  statementType === type
                    ? 'bg-[#1B9387] text-white shadow-md'
                    : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'
                }`}
              >
                {type === 'trial'
                  ? 'Trial Balance'
                  : type === 'income'
                    ? 'Income Statement'
                    : type === 'balance'
                      ? 'Balance Sheet'
                      : 'Cash Flow'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
          {/* MONTH / YEAR PICKER */}
          <div className="flex items-center bg-[#FBF8F8] border border-[#B0DCDA] rounded-md shadow-sm h-10">
            <button
              onClick={handlePrevMonth}
              className="px-3 h-full hover:bg-[#E9FAFA] text-gray-600 transition rounded-l-md border-r border-[#B0DCDA]"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 text-sm font-bold text-gray-800 w-44 text-center select-none">
              {getMonthName(selectedMonth)} {selectedYear}
            </div>
            <button
              onClick={handleNextMonth}
              className="px-3 h-full hover:bg-[#E9FAFA] text-gray-600 transition rounded-r-md border-l border-[#B0DCDA]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* EXPORTS */}
          <div className="flex space-x-2">
            <button
              id="export-pdf-btn"
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2 h-10 cursor-pointer"
            >
              <FileText size={16} /> <span>Export PDF</span>
            </button>
            <div className="relative group">
              <button
                id="export-excel-btn"
                onClick={statementType === 'trial' ? handleExportExcel : undefined}
                disabled={statementType !== 'trial'}
                className={`px-4 py-2 bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-bold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center space-x-2 h-10 ${statementType !== 'trial' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#B0DCDA]/50 cursor-pointer'}`}
              >
                <FileSpreadsheet size={16} /> <span>Export Excel</span>
              </button>
              {statementType !== 'trial' && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                  Excel export is available for the Trial Balance
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`relative min-h-[400px] transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
      >
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center z-20 print:hidden">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B9387]"></div>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
            <AlertTriangle size={48} className="text-red-700 mb-4 opacity-80" />
            <p className="text-red-700 font-bold mb-4">{error}</p>
            <button
              onClick={() => setStatementType(statementType)}
              className="px-6 py-2 bg-[#1B9387] text-white font-bold rounded-md shadow hover:bg-[#157A70] transition cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        ) : (
          data && (
            <div className="animate-in fade-in duration-300">
              {/* =========================================
                            A. TRIAL BALANCE
                        ========================================= */}
              {statementType === 'trial' && (
                <div className="space-y-6 bg-white max-w-6xl mx-auto">
                  <div className="text-center pb-4 border-b-2 border-gray-800">
                    <h2 className="text-2xl font-extrabold text-gray-800">
                      SmartGuys Community Healthcare Inc.
                    </h2>
                    <h3 className="text-lg font-bold text-gray-600 mt-1">Trial Balance</h3>
                    <p className="text-sm text-gray-500 mt-1 italic">{asOfDateStr}</p>
                    <p className="text-xs text-gray-400 mt-1">Amounts in PHP</p>
                  </div>

                  {/* Trial Balance Top Summary */}
                  {(() => {
                    const isBalanced =
                      Math.abs((data.totalDebits || 0) - (data.totalCredits || 0)) < 0.01
                    const difference = Math.abs((data.totalDebits || 0) - (data.totalCredits || 0))
                    return (
                      <div className="text-sm font-medium text-gray-600 bg-[#FBF8F8] p-3 rounded-lg border border-[#B0DCDA] flex flex-col sm:flex-row items-center justify-between shadow-sm">
                        <div className="flex space-x-6 mb-2 sm:mb-0">
                          <span>
                            Total Debits:{' '}
                            <span className="font-bold text-gray-800 font-mono tabular-nums">
                              ₱ {formatCurrencyWithoutSymbol(data.totalDebits)}
                            </span>
                          </span>
                          <span>
                            Total Credits:{' '}
                            <span className="font-bold text-gray-800 font-mono tabular-nums">
                              ₱ {formatCurrencyWithoutSymbol(data.totalCredits)}
                            </span>
                          </span>
                        </div>
                        <div>
                          {isBalanced ? (
                            <span className="text-[#1B9387] font-bold flex items-center gap-1.5 bg-[#E9FAFA] px-2.5 py-1 rounded-md border border-[#B0DCDA]">
                              ✓ Balanced
                            </span>
                          ) : (
                            <span className="text-red-700 font-bold flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-md border border-red-200">
                              <AlertTriangle size={16} /> Difference: ₱{' '}
                              {formatCurrencyWithoutSymbol(difference)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="border border-[#B0DCDA] rounded-xl bg-white shadow-sm">
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="p-3.5 pl-5 text-left font-extrabold border-b border-[#B0DCDA] first:rounded-tl-xl w-32">
                            Account
                          </th>
                          <th className="p-3.5 text-left font-extrabold border-b border-[#B0DCDA]">
                            Account Name
                          </th>
                          <th className="p-3.5 text-right font-extrabold border-b border-l border-[#B0DCDA] w-48">
                            Debit
                          </th>
                          <th className="p-3.5 pr-5 text-right font-extrabold border-b border-[#B0DCDA] last:rounded-tr-xl w-48">
                            Credit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {data.lines?.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-gray-500 italic">
                              No activity recorded prior to this period.
                            </td>
                          </tr>
                        )}

                        {accountOrder.map((groupName) => {
                          const groupLines = groupedLines?.[groupName]
                          if (!groupLines || groupLines.length === 0) return null

                          const groupDebitTotal = groupLines.reduce(
                            (sum: number, l: any) => sum + (l.debit || 0),
                            0
                          )
                          const groupCreditTotal = groupLines.reduce(
                            (sum: number, l: any) => sum + (l.credit || 0),
                            0
                          )

                          return (
                            <React.Fragment key={groupName}>
                              <tr>
                                <td
                                  colSpan={4}
                                  className="p-2 pl-5 font-extrabold text-[#1B9387] bg-white uppercase tracking-wider text-[10px] border-b border-gray-100 pt-4"
                                >
                                  {groupName}s
                                </td>
                              </tr>
                              {groupLines.map((line: any) => {
                                const abnormal = isAbnormalBalance(
                                  line.accountCode,
                                  line.debit || 0,
                                  line.credit || 0
                                )
                                return (
                                  <tr
                                    key={line.accountCode}
                                    onClick={() =>
                                      onNavigate &&
                                      onNavigate('general-ledger', {
                                        accountCode: line.accountCode,
                                        month: selectedMonth,
                                        year: selectedYear
                                      })
                                    }
                                    className={`border-b border-gray-50 transition group ${onNavigate ? 'cursor-pointer hover:bg-[#E9FAFA]/80' : 'hover:bg-[#E9FAFA]/40'} even:bg-[#FBF8F8] odd:bg-white`}
                                    title={onNavigate ? 'Click to view ledger details' : ''}
                                  >
                                    <td className="p-3.5 pl-5 text-gray-800 font-mono font-bold">
                                      {line.accountCode}
                                    </td>
                                    <td className="p-3.5 text-gray-800 font-medium group-hover:text-[#1B9387] transition-colors">
                                      {line.accountName}
                                      {abnormal && (
                                        <span
                                          className="ml-3 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 align-text-bottom"
                                          title={`Unusual balance for a ${groupName} account`}
                                        >
                                          <AlertTriangle size={10} className="inline mr-1" />{' '}
                                          Unusual
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3.5 text-right font-mono font-medium text-gray-800 tabular-nums border-l border-gray-100">
                                      {line.debit > 0
                                        ? formatCurrencyWithoutSymbol(line.debit)
                                        : '—'}
                                    </td>
                                    <td className="p-3.5 pr-5 text-right font-mono font-medium text-gray-800 tabular-nums">
                                      {line.credit > 0
                                        ? formatCurrencyWithoutSymbol(line.credit)
                                        : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-white border-b-2 border-gray-200">
                                <td
                                  colSpan={2}
                                  className="p-2 pl-5 text-right text-[10px] font-extrabold text-gray-400 uppercase tracking-wider"
                                >
                                  Total {groupName}s
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-gray-600 text-xs tabular-nums border-l border-gray-100">
                                  {groupDebitTotal > 0
                                    ? formatCurrencyWithoutSymbol(groupDebitTotal)
                                    : '—'}
                                </td>
                                <td className="p-2 pr-5 text-right font-mono font-bold text-gray-600 text-xs tabular-nums">
                                  {groupCreditTotal > 0
                                    ? formatCurrencyWithoutSymbol(groupCreditTotal)
                                    : '—'}
                                </td>
                              </tr>
                            </React.Fragment>
                          )
                        })}

                        <tr className="bg-[#E9FAFA] border-t-2 border-[#B0DCDA]">
                          <td
                            colSpan={2}
                            className="p-4 pl-5 text-left font-extrabold text-gray-800 uppercase tracking-wider last:rounded-bl-xl"
                          >
                            Grand Total
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-[#1B9387] tabular-nums border-l border-[#B0DCDA]">
                            ₱ {formatCurrencyWithoutSymbol(data.totalDebits)}
                          </td>
                          <td className="p-4 pr-5 text-right font-mono font-bold text-[#1B9387] tabular-nums last:rounded-br-xl">
                            ₱ {formatCurrencyWithoutSymbol(data.totalCredits)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* =========================================
                            B. INCOME STATEMENT
                        ========================================= */}
              {statementType === 'income' && (
                <div className="space-y-8 bg-white max-w-3xl mx-auto">
                  <div className="text-center pb-4 border-b-2 border-gray-800">
                    <h2 className="text-2xl font-extrabold text-gray-800">
                      SmartGuys Community Healthcare Inc.
                    </h2>
                    <h3 className="text-lg font-bold text-gray-600 mt-1">Income Statement</h3>
                    <p className="text-sm text-gray-500 mt-1 italic">{forMonthStr}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Revenues
                    </h3>
                    {data.revenue?.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 pl-8 italic">
                        No revenue recorded this month.
                      </p>
                    )}
                    {data.revenue?.map((rev: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700 font-medium">{rev.name}</span>
                        <span className="font-mono text-gray-800 tabular-nums">
                          {formatCurrency(rev.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">Total Revenue</span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.totalRevenue)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Operating Expenses
                    </h3>
                    {data.expenses?.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 pl-8 italic">
                        No operating expenses recorded this month.
                      </p>
                    )}
                    {data.expenses?.map((exp: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700 font-medium">{exp.name}</span>
                        <span className="font-mono text-gray-800 tabular-nums">
                          {formatCurrency(exp.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">
                        Total Operating Expenses
                      </span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.totalExpenses)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-5 bg-[#E9FAFA] border-t-2 border-b-4 border-[#B0DCDA] rounded-md shadow-sm">
                    <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider">
                      Net Income (Loss)
                    </span>
                    <span
                      className={`text-xl font-bold font-mono tabular-nums ${data.netIncome >= 0 ? 'text-[#1B9387]' : 'text-red-700'}`}
                    >
                      {formatCurrency(data.netIncome, data.netIncome < 0)}
                    </span>
                  </div>
                </div>
              )}

              {/* =========================================
                            C. BALANCE SHEET
                        ========================================= */}
              {statementType === 'balance' && (
                <div className="space-y-8 bg-white max-w-3xl mx-auto">
                  <div className="text-center pb-4 border-b-2 border-gray-800">
                    <h2 className="text-2xl font-extrabold text-gray-800">
                      SmartGuys Community Healthcare Inc.
                    </h2>
                    <h3 className="text-lg font-bold text-gray-600 mt-1">Balance Sheet</h3>
                    <p className="text-sm text-gray-500 mt-1 italic">{asOfDateStr}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Assets
                    </h3>
                    {data.assets?.map((asset: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700 font-medium">{asset.name}</span>
                        <span
                          className={`font-mono tabular-nums ${asset.amount < 0 ? 'text-red-700 font-bold' : 'text-gray-800'}`}
                        >
                          {formatCurrency(asset.amount, asset.amount < 0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">Total Assets</span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.totalAssets)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Liabilities
                    </h3>
                    {data.liabilities?.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 pl-8 italic">
                        No liabilities recorded.
                      </p>
                    )}
                    {data.liabilities?.map((lia: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700 font-medium">{lia.name}</span>
                        <span className="font-mono text-gray-800 tabular-nums">
                          {formatCurrency(lia.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">
                        Total Liabilities
                      </span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.totalLiabilities)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Equity
                    </h3>
                    {data.equity?.map((eq: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700 font-medium">{eq.name}</span>
                        <span className="font-mono text-gray-800 tabular-nums">
                          {formatCurrency(eq.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm py-2 px-4 pl-8 text-gray-500 italic border-t border-gray-100 mt-2 pt-2 transition">
                      <span>Accumulated Net Income / Loss</span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatCurrency(data.netIncome, data.netIncome < 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-2 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">Total Equity</span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.totalEquity + data.netIncome)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex justify-between items-center p-5 border-t-2 border-b-4 shadow-sm rounded-md ${data.isEquationBalanced ? 'bg-[#E9FAFA] border-[#B0DCDA]' : 'bg-red-50 border-red-200'}`}
                  >
                    <div>
                      <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider block">
                        Total Liabilities & Equity
                      </span>
                      {!data.isEquationBalanced && (
                        <span className="text-xs text-red-700 font-bold uppercase mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} /> Equation out of balance
                        </span>
                      )}
                    </div>
                    <span className="text-xl font-bold font-mono text-gray-800 tabular-nums">
                      {formatCurrency(data.totalLiabilitiesAndEquity)}
                    </span>
                  </div>
                </div>
              )}

              {/* =========================================
                            D. CASH FLOW STATEMENT
                        ========================================= */}
              {statementType === 'cash-flow' && (
                <div className="space-y-8 bg-white max-w-3xl mx-auto">
                  <div className="text-center pb-4 border-b-2 border-gray-800">
                    <h2 className="text-2xl font-extrabold text-gray-800">
                      SmartGuys Community Healthcare Inc.
                    </h2>
                    <h3 className="text-lg font-bold text-gray-600 mt-1">
                      Statement of Cash Flows
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 italic">{forMonthStr}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Cash Flows from Operating Activities
                    </h3>
                    {data.operating?.details.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 pl-8 italic">
                        No operating activities this month.
                      </p>
                    )}
                    {data.operating?.details.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700">{item.description}</span>
                        <span
                          className={`font-mono tabular-nums ${item.amount < 0 ? 'text-red-700 font-medium' : 'text-gray-800'}`}
                        >
                          {formatCurrency(item.amount, item.amount < 0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-3 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">
                        Net Cash from Operating Activities
                      </span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.operating?.net, data.operating?.net < 0)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Cash Flows from Investing Activities
                    </h3>
                    {data.investing?.details.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 pl-8 italic">
                        No investing activities this month.
                      </p>
                    )}
                    {data.investing?.details.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700">{item.description}</span>
                        <span
                          className={`font-mono tabular-nums ${item.amount < 0 ? 'text-red-700 font-medium' : 'text-gray-800'}`}
                        >
                          {formatCurrency(item.amount, item.amount < 0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-3 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">
                        Net Cash from Investing Activities
                      </span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.investing?.net, data.investing?.net < 0)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1B9387] border-b border-[#B0DCDA] pb-2 mb-3">
                      Cash Flows from Financing Activities
                    </h3>
                    {data.financing?.details.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 pl-8 italic">
                        No financing activities this month.
                      </p>
                    )}
                    {data.financing?.details.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 px-4 pl-8 hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700">{item.description}</span>
                        <span
                          className={`font-mono tabular-nums ${item.amount < 0 ? 'text-red-700 font-medium' : 'text-gray-800'}`}
                        >
                          {formatCurrency(item.amount, item.amount < 0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-extrabold pt-3 px-4 mt-3 border-t border-[#B0DCDA]">
                      <span className="text-gray-800 uppercase tracking-wide">
                        Net Cash from Financing Activities
                      </span>
                      <span className="font-mono text-gray-800 tabular-nums">
                        {formatCurrency(data.financing?.net, data.financing?.net < 0)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex justify-between items-center p-5 border-t-2 border-b-4 shadow-sm mt-8 rounded-md ${data.netIncreaseInCash < 0 ? 'bg-red-50 border-red-200' : 'bg-[#E9FAFA] border-[#B0DCDA]'}`}
                  >
                    <span className="text-base font-extrabold text-gray-800 uppercase tracking-wider">
                      Net Increase (Decrease) in Cash
                    </span>
                    <span
                      className={`text-xl font-bold font-mono tabular-nums ${data.netIncreaseInCash < 0 ? 'text-red-700' : 'text-[#1B9387]'}`}
                    >
                      {formatCurrency(data.netIncreaseInCash, data.netIncreaseInCash < 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
