import * as React from 'react'
import { useState } from 'react'

export function PayrollHistoryTab({
  payrollHistory
}: {
  payrollHistory: any[]
}) {
  const [histSearch, setHistSearch] = useState('')
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const handleExportSingle = async (payslipId: string) => {
    try {
      setExportingId(payslipId)
      const api = (window as any).api || (window as any).electronAPI
      await api.exportPayslipPDF(payslipId)
    } catch (err) {
      console.error(err)
    } finally {
      setExportingId(null)
    }
  }

  const handleExportBatch = async (runId: string) => {
    try {
      setExportingId(runId)
      const api = (window as any).api || (window as any).electronAPI
      await api.exportBatchPayslipsPDF(runId)
    } catch (err) {
      console.error(err)
    } finally {
      setExportingId(null)
    }
  }

  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const searchLower = histSearch.toLowerCase().trim()

  const filteredHistory = payrollHistory.filter((run) => {
    if (!searchLower) return true
    const matchRun =
      (run.referenceNo && run.referenceNo.toLowerCase().includes(searchLower)) ||
      (run.description && run.description.toLowerCase().includes(searchLower))
    if (matchRun) return true

    if (run.payslips && Array.isArray(run.payslips)) {
      return run.payslips.some((p: any) => {
        const fullName = `${p.employee?.first_name || ''} ${p.employee?.last_name || ''}`.toLowerCase()
        return fullName.includes(searchLower)
      })
    }
    return false
  })

  return (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 bg-[#FBF8F8] print:hidden">
      <div className="p-6 border-b border-[#B0DCDA] flex justify-between items-center bg-white shrink-0">
        <input
          type="text"
          placeholder="Search voucher, memo, or employee name..."
          value={histSearch}
          onChange={(e) => setHistSearch(e.target.value)}
          className="w-96 bg-gray-50 border border-gray-300 rounded-md p-2.5 text-sm outline-none focus:border-[#1B9387] transition"
        />
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {filteredHistory.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <span className="block text-4xl mb-3">🕰️</span>
            <span className="italic font-medium">
              No payroll history found matching your criteria.
            </span>
          </div>
        ) : (
          filteredHistory.map((run) => {
            const isEmptyRun = run.payslips.length === 0
            const matchesEmployee = Boolean(searchLower) && run.payslips?.some((p: any) => `${p.employee?.first_name || ''} ${p.employee?.last_name || ''}`.toLowerCase().includes(searchLower))
            const isExpanded = expandedHistoryId === run.id || matchesEmployee
            const displayedPayslips = searchLower
              ? (run.payslips || []).filter((p: any) => {
                  const fullName = `${p.employee?.first_name || ''} ${p.employee?.last_name || ''}`.toLowerCase()
                  return fullName.includes(searchLower) || (run.referenceNo && run.referenceNo.toLowerCase().includes(searchLower)) || (run.description && run.description.toLowerCase().includes(searchLower))
                })
              : (run.payslips || [])

            return (
              <div
                key={run.id || run.referenceNo}
                className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'border-[#1B9387] ring-1 ring-[#1B9387]' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div
                  onClick={() => setExpandedHistoryId(isExpanded ? null : run.id)}
                  className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50/50"
                >
                  <div className="flex items-center space-x-6 w-1/2">
                    <span className="font-extrabold font-mono text-gray-800 text-lg w-20">
                      {run.referenceNo}
                    </span>
                    <span className="text-gray-500 font-medium text-sm tabular-nums w-24">
                      {new Date(run.date).toLocaleDateString()}
                    </span>
                    <span className="text-gray-800 font-bold text-sm truncate">
                      {run.description}
                    </span>
                  </div>
                  <div className="flex items-center space-x-8">
                    <span className="text-sm font-bold text-gray-500">
                      {run.payslips.length} Employees
                    </span>
                    <span className="text-lg font-black text-gray-800 font-mono tabular-nums min-w-[120px] text-right">
                      {formatCurrency(
                        run.payslips.reduce((sum: number, p: any) => sum + p.net_pay, 0)
                      )}
                    </span>

                    {isEmptyRun ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm w-20 text-center">
                        Draft
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm w-20 text-center">
                        Posted
                      </span>
                    )}

                    <span className="text-gray-400 w-4 text-center">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50/80 border-t border-gray-200 p-5 animate-in slide-in-from-top-2">
                    {isEmptyRun ? (
                      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-500 italic">
                          This is an empty draft. No payslips generated.
                        </p>
                        <button className="text-xs font-bold text-red-500 hover:bg-red-50 px-4 py-2 border border-red-200 rounded transition">
                          Delete Draft
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-end mb-4">
                          <button
                            onClick={() => handleExportBatch(run.id)}
                            disabled={exportingId === run.id}
                            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-xs font-bold rounded shadow-sm disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
                          >
                            {exportingId === run.id ? 'Exporting...' : '📄 Batch Export PDF'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedPayslips.map((payslip: any) => (
                          <div
                            key={payslip.id}
                            className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex justify-between items-center hover:border-[#1B9387] transition group"
                          >
                            <div>
                              <p className="font-extrabold text-gray-800">
                                {payslip.employee.first_name} {payslip.employee.last_name}
                              </p>
                              <p className="text-xs text-gray-500 font-medium mt-1">
                                Net:{' '}
                                <span className="font-bold text-[#1B9387] font-mono tabular-nums">
                                  {formatCurrency(payslip.net_pay)}
                                </span>
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedPayslip(payslip)}
                              className="px-4 py-2 bg-[#1B9387] hover:bg-[#15796f] text-white text-xs font-black uppercase tracking-wider rounded-lg transition cursor-pointer shadow-sm active:scale-95"
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* PRINTABLE PAYSLIP MODAL */}
      {selectedPayslip && (() => {
        const emp = selectedPayslip.employee || {}
        const monthlySalary = emp.monthly_salary ? Number(emp.monthly_salary) : 0
        const semiMonthlyRate = monthlySalary > 0 ? monthlySalary / 2 : 0
        const dailyRate = monthlySalary > 0 ? monthlySalary / 26 : 0
        const hourlyRate = dailyRate > 0 ? dailyRate / 8 : 0

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:bg-white print:p-0 print:static print:block print:inset-auto">
            <div className="bg-white border border-gray-300 rounded-2xl shadow-2xl p-8 w-full max-w-2xl my-auto animate-in zoom-in-95 duration-200 print:w-full print:border-none print:shadow-none print:p-0">
              
              {/* CLINIC BRANDED HEADER */}
              <div className="flex items-start justify-between pb-4 border-b-2 border-[#1B9387] mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏥</span>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                      SMARTGUYS CLINIC &amp; COMMUNITY HEALTHCARE
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Official Employee Compensation &amp; Payroll Voucher
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-[#E9FAFA] border border-[#B0DCDA] text-[#1B9387] font-black text-xs rounded-md uppercase tracking-wider font-mono">
                    {selectedPayslip.reference_no}
                  </span>
                  <p className="text-[11px] text-gray-400 mt-1 font-mono">
                    Pay Date: {new Date(selectedPayslip.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* EMPLOYEE METADATA GRID */}
              <div className="bg-[#F8FBFA] border border-gray-200 rounded-xl p-4 mb-6 text-xs text-gray-700">
                {/* ROW 1: PRIMARY PROFILE */}
                <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-200/80">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      Employee Name
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {emp.first_name} {emp.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      Position / Designation
                    </span>
                    <span className="text-sm font-extrabold text-[#1B9387]">
                      {emp.position || 'Staff'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      Employee ID
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-800">
                      {emp.id ? `EMP-${String(emp.id).padStart(4, '0')}` : '—'}
                    </span>
                  </div>
                </div>

                {/* ROW 2: STATUTORY IDS */}
                <div className="grid grid-cols-4 gap-3 py-3 border-b border-gray-200/80 text-[11px]">
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">TIN</span>
                    <span className="font-mono font-bold text-gray-800">{emp.tin || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">SSS No.</span>
                    <span className="font-mono font-bold text-gray-800">{emp.sss_no || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">PhilHealth No.</span>
                    <span className="font-mono font-bold text-gray-800">{emp.philhealth_no || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">Pag-IBIG / HDMF</span>
                    <span className="font-mono font-bold text-gray-800">{emp.pagibig_no || '—'}</span>
                  </div>
                </div>

                {/* ROW 3: COMPENSATION BASIS */}
                <div className="grid grid-cols-4 gap-3 pt-3 text-[11px]">
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">Monthly Rate</span>
                    <span className="font-mono font-black text-gray-800">{formatCurrency(monthlySalary)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">Semi-Monthly Base</span>
                    <span className="font-mono font-black text-gray-800">{formatCurrency(semiMonthlyRate)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">Daily Rate (26d)</span>
                    <span className="font-mono font-bold text-gray-700">{formatCurrency(dailyRate)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-gray-400 block">Hourly Rate (8h)</span>
                    <span className="font-mono font-bold text-gray-700">{formatCurrency(hourlyRate)}</span>
                  </div>
                </div>
              </div>

              {/* EARNINGS VS DEDUCTIONS SECTION */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* EARNINGS */}
                <div className="border border-blue-100 rounded-xl p-4 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-blue-200">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                        Earnings &amp; Additions
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                        Credit
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Basic Semi-Monthly Pay</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.base_pay)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Overtime Pay (DOLE)</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.overtime)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Night Differential</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.night_diff)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Other Allowances / Adj.</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.other_earnings)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 mt-4 border-t-2 border-blue-200 text-xs font-black text-blue-900 bg-blue-50/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                    <span className="tracking-wide">GROSS EARNINGS</span>
                    <span className="font-mono text-sm tabular-nums text-blue-700">
                      {formatCurrency(selectedPayslip.gross_pay)}
                    </span>
                  </div>
                </div>

                {/* DEDUCTIONS */}
                <div className="border border-orange-100 rounded-xl p-4 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-orange-200">
                      <span className="text-xs font-black uppercase tracking-wider text-orange-700">
                        Itemized Deductions
                      </span>
                      <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold">
                        Debit
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">SSS Contribution (EE)</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.sss)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">PhilHealth (EE)</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.philhealth)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Pag-IBIG / HDMF (EE)</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.pagibig)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Cash Advance / Vale</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.cash_advance)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Professional License Fee</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.license_fee)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-600">Other Demerits / Deductions</span>
                        <span className="font-mono font-bold text-gray-900 tabular-nums">
                          {formatCurrency(selectedPayslip.other_deductions)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 text-red-600 font-bold">
                        <span>BIR Withholding Tax</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(selectedPayslip.tax_withheld)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 mt-4 border-t-2 border-orange-200 text-xs font-black text-orange-900 bg-orange-50/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                    <span className="tracking-wide">TOTAL DEDUCTIONS</span>
                    <span className="font-mono text-sm tabular-nums text-orange-700">
                      {formatCurrency(
                        selectedPayslip.total_deductions + selectedPayslip.tax_withheld
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* NET TAKE HOME PAY BANNER */}
              <div className="bg-gradient-to-r from-[#E9FAFA] to-[#d6f4f2] border-2 border-[#1B9387] rounded-xl p-5 mb-6 flex justify-between items-center shadow-sm">
                <div>
                  <span className="text-xs font-black text-[#1B9387] uppercase tracking-wider block">
                    Net Take-Home Pay
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Credited to Employee Payroll Account
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black font-mono text-[#1B9387] tabular-nums tracking-tight">
                    {formatCurrency(selectedPayslip.net_pay)}
                  </span>
                </div>
              </div>

              {/* SIGNATURE & ACKNOWLEDGMENT BLOCK */}
              <div className="grid grid-cols-2 gap-8 pt-4 pb-2 border-t border-gray-200 text-xs text-gray-600">
                <div className="flex flex-col justify-end">
                  <div className="border-b border-gray-400 w-full mb-1"></div>
                  <span className="font-bold text-gray-700 text-center uppercase text-[10px] tracking-wider block">
                    Certified Correct By (HR / Payroll Officer)
                  </span>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="border-b border-gray-400 w-full mb-1"></div>
                  <span className="font-bold text-gray-700 text-center uppercase text-[10px] tracking-wider block">
                    Received &amp; Acknowledged By Employee
                  </span>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 print:hidden">
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => handleExportSingle(selectedPayslip.id)}
                  disabled={exportingId === selectedPayslip.id}
                  className="px-6 py-2.5 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-400 disabled:opacity-50 text-white rounded-lg text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <span>{exportingId === selectedPayslip.id ? 'Exporting PDF...' : 'Export High-Res PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
