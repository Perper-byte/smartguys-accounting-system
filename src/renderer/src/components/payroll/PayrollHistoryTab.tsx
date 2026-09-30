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

  const filteredHistory = payrollHistory.filter(
    (run) =>
      run.referenceNo.toLowerCase().includes(histSearch.toLowerCase()) ||
      run.description.toLowerCase().includes(histSearch.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 bg-[#FBF8F8] print:hidden">
      <div className="p-6 border-b border-[#B0DCDA] flex justify-between items-center bg-white shrink-0">
        <input
          type="text"
          placeholder="Search voucher or memo..."
          value={histSearch}
          onChange={(e) => setHistSearch(e.target.value)}
          className="w-80 bg-gray-50 border border-gray-300 rounded-md p-2.5 text-sm outline-none focus:border-[#1B9387] transition"
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
            const isExpanded = expandedHistoryId === run.id
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
                        {run.payslips.map((payslip: any) => (
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
                              className="px-4 py-2 bg-[#E9FAFA] text-[#1B9387] group-hover:bg-[#1B9387] group-hover:text-white border border-[#B0DCDA] group-hover:border-[#1B9387] text-[10px] font-extrabold uppercase tracking-wider rounded transition cursor-pointer shadow-sm"
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
      {selectedPayslip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm print:bg-white print:static print:block print:inset-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-10 w-[600px] print:w-full print:border-none print:shadow-none print:p-0">
            <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                SMARTGUYS CLINIC
              </h2>
              <h3 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mt-1">
                Employee Payslip
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-700 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">
                  Employee
                </span>
                <span className="text-base font-extrabold text-gray-800">
                  {selectedPayslip.employee.first_name} {selectedPayslip.employee.last_name}
                </span>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">
                  Position
                </span>
                <span className="text-gray-800 font-bold">
                  {selectedPayslip.employee.position}
                </span>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">
                  Payroll Period
                </span>
                <span className="font-mono text-gray-800 font-bold">
                  {new Date(selectedPayslip.date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">
                  Reference No.
                </span>
                <span className="font-mono text-gray-800 font-bold">
                  {selectedPayslip.reference_no}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2 border-b border-blue-200 pb-1">
                  Earnings
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Pay</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.base_pay)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overtime</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.overtime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Night Diff</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.night_diff)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Other Earn.</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.other_earnings)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 text-sm font-black text-blue-600">
                  <span>GROSS PAY</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(selectedPayslip.gross_pay)}
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-2 border-b border-orange-200 pb-1">
                  Deductions
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">SSS</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.sss)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PhilHealth</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.philhealth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pag-IBIG</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.pagibig)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash Adv.</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.cash_advance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">License Fee</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.license_fee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Other Ded.</span>
                    <span className="font-mono text-gray-800 font-bold tabular-nums">
                      {formatCurrency(selectedPayslip.other_deductions)}
                    </span>
                  </div>
                  <div className="flex justify-between text-red-500 font-bold">
                    <span className="uppercase text-xs tracking-wider">Tax W/H</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedPayslip.tax_withheld)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 text-sm font-black text-orange-600">
                  <span>TOTAL DEDUCT</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(
                      selectedPayslip.total_deductions + selectedPayslip.tax_withheld
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg p-5 flex justify-between items-center shadow-sm">
              <span className="text-sm font-extrabold text-[#1B9387] uppercase tracking-wider">
                Net Take Home Pay
              </span>
              <span className="text-2xl font-black font-mono text-[#1B9387] tabular-nums">
                {formatCurrency(selectedPayslip.net_pay)}
              </span>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100 print:hidden">
              <button
                onClick={() => setSelectedPayslip(null)}
                className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleExportSingle(selectedPayslip.id)}
                disabled={exportingId === selectedPayslip.id}
                className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-400 disabled:opacity-50 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm flex items-center gap-2"
              >
                <span>🖨️</span> <span>{exportingId === selectedPayslip.id ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
