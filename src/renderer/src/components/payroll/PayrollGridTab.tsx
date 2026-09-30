import * as React from 'react'
import { useState, useEffect, useRef } from 'react'

export function PayrollGridTab({
  employees,
  userId,
  setStatus
}: {
  employees: any[]
  userId: string
  setStatus: (status: { type: 'success' | 'error'; msg: string } | null) => void
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [refSequence, setRefSequence] = useState('')
  const [description, setDescription] = useState('Salary for August 15-30')
  const [showDetailed, setShowDetailed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Map employeeId -> input values
  const [inputs, setInputs] = useState<Record<number, any>>({})
  // Map employeeId -> calculated result
  const [results, setResults] = useState<Record<number, any>>({})

  const fetchNextSeq = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      const nextSeq = await api.getNextSequence('PY-')
      setRefSequence(nextSeq)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchNextSeq()
  }, [])

  // Initialize inputs when employees load
  useEffect(() => {
    const active = employees.filter((e) => e.is_active !== false)
    const newInputs = { ...inputs }
    let changed = false
    active.forEach((emp) => {
      if (!newInputs[emp.id]) {
        newInputs[emp.id] = {
          monthlySalary: Number(emp.monthly_salary) || 0,
          demerits: { late_minutes: 0, undertime_hours: 0, undertime_minutes: 0, absence_days: 0 },
          hours: {}
        }
        changed = true
      }
    })
    if (changed) setInputs(newInputs)
  }, [employees])

  // Debounced calculation
  const timeoutRef = useRef<any>(null)

  useEffect(() => {
    const active = employees.filter((e) => e.is_active !== false)
    if (active.length === 0 || Object.keys(inputs).length === 0) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      try {
        const payload = active.map(emp => ({
          id: emp.id,
          monthlySalary: inputs[emp.id]?.monthlySalary || 0,
          hours: inputs[emp.id]?.hours || {},
          demerits: inputs[emp.id]?.demerits || { late_minutes: 0, undertime_hours: 0, undertime_minutes: 0, absence_days: 0 }
        }))

        const api = (window as any).api || (window as any).electronAPI
        const calcResults = await api.batchCalculatePayroll(payload)
        
        const newResults: Record<number, any> = {}
        calcResults.forEach((res: any) => {
          newResults[res.employee_id] = res
        })
        setResults(newResults)
      } catch (err) {
        console.error('Failed to batch calculate', err)
      }
    }, 500)

    return () => clearTimeout(timeoutRef.current)
  }, [inputs, employees])

  const handleProcessPayroll = async () => {
    setStatus(null)
    if (!refSequence) return setStatus({ type: 'error', msg: 'Sequence number required.' })
    const active = employees.filter((e) => e.is_active !== false)
    if (active.length === 0)
      return setStatus({ type: 'error', msg: 'No active employees to pay.' })

    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      
      // format payroll items based on Phase 2 processPayroll schema
      const payrollItems = active.map(emp => {
        const res = results[emp.id] || {}
        return {
          id: emp.id,
          basePay: res.base_pay || 0,
          overtime: res.overtime || 0,
          nightDiff: res.night_diff || 0,
          otherEarnings: res.other_earnings || 0,
          gross: res.gross_pay || 0,
          sss: res.sss || 0,
          philhealth: res.philhealth || 0,
          pagibig: res.pagibig || 0,
          cashAdvance: res.cash_advance || 0,
          licenseFee: res.license_fee || 0,
          otherDeductions: res.other_deductions || 0,
          tax: res.tax_withheld || 0,
          net: res.net_pay || 0,
          processedLoans: res.processedLoans || []
        }
      })

      const payload = {
        date,
        referenceNo: `PY-${refSequence.padStart(3, '0')}`,
        description,
        userId,
        employees: payrollItems
      }
      
      const response = await api.processPayroll(payload)
      if (response.success) {
        setStatus({
          type: 'success',
          msg: `Payroll ${payload.referenceNo} processed successfully!`
        })
        fetchNextSeq()
        setTimeout(() => setStatus(null), 5000)
      } else setStatus({ type: 'error', msg: 'Database Error: ' + response.error })
    } catch (error) {
      setStatus({ type: 'error', msg: 'System Error.' })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number = 0) =>
    `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const CellMoney = ({ val = 0, colorClass = 'text-gray-800', isBold = true }: any) => (
    <span className={`tabular-nums block w-full text-right ${isBold ? 'font-bold' : 'font-medium'} ${val === 0 ? 'text-gray-300' : colorClass}`}>
      {val === 0 ? '0.00' : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )

  const activeEmployees = employees.filter(e => e.is_active !== false)
  const totalGross = activeEmployees.reduce((sum, e) => sum + (results[e.id]?.gross_pay || 0), 0)
  const totalDeductions = activeEmployees.reduce((sum, e) => sum + ((results[e.id]?.total_deductions || 0) + (results[e.id]?.tax_withheld || 0)), 0)
  const totalNet = activeEmployees.reduce((sum, e) => sum + (results[e.id]?.net_pay || 0), 0)

  const handleDemeritChange = (empId: number, field: string, val: number) => {
    setInputs(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        demerits: {
          ...prev[empId]?.demerits,
          [field]: val
        }
      }
    }))
  }

  const handleHourChange = (empId: number, field: string, val: number) => {
    setInputs(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        hours: {
          ...prev[empId]?.hours,
          [field]: val
        }
      }
    }))
  }

  const renderInput = (
    val: number,
    onChange: (e: any) => void,
    defaultTextColor: string,
    focusBg: string
  ) => (
    <td className="p-0 border-r border-gray-200 bg-white group-hover:bg-transparent transition-colors">
      <input
        type="number"
        min="0"
        step="0.01"
        value={val === 0 ? '' : val}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-full min-h-[48px] min-w-[60px] bg-transparent hover:bg-gray-100/50 px-2 text-right font-mono tabular-nums outline-none focus:${focusBg} border-2 border-transparent focus:border-gray-300 transition-colors ${val === 0 ? 'text-gray-300 font-medium' : `font-bold ${defaultTextColor}`}`}
      />
    </td>
  )

  const categories = [
    { key: 'regular_ot', label: 'Reg OT', color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'regular_night', label: 'ND', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'regular_night_ot', label: 'ND OT', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'rest_day', label: 'RD', color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'rest_day_ot', label: 'RD OT', color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'rest_day_night', label: 'RD ND', color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'rest_day_night_ot', label: 'RD ND OT', color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'special_holiday', label: 'SH', color: 'text-pink-600', bg: 'bg-pink-50' },
    { key: 'special_holiday_ot', label: 'SH OT', color: 'text-pink-600', bg: 'bg-pink-50' },
    { key: 'special_holiday_night', label: 'SH ND', color: 'text-pink-600', bg: 'bg-pink-50' },
    { key: 'special_holiday_night_ot', label: 'SH ND OT', color: 'text-pink-600', bg: 'bg-pink-50' },
    { key: 'special_holiday_rest_day', label: 'SH RD', color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'special_holiday_rest_day_ot', label: 'SH RD OT', color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'special_holiday_rest_day_night', label: 'SH RD ND', color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'special_holiday_rest_day_night_ot', label: 'SH RD ND OT', color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'legal_holiday', label: 'LH', color: 'text-red-600', bg: 'bg-red-50' }
  ]

  return (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 relative print:hidden">
      <div className="px-6 mb-4 mt-4 shrink-0">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
              Payroll Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
              Voucher No.
            </label>
            <div className="flex">
              <span className="bg-gray-50 border border-[#B0DCDA] border-r-0 rounded-l-md px-4 py-3 text-sm font-extrabold text-gray-500 select-none">
                PY-
              </span>
              <input
                type="text"
                required
                value={refSequence}
                onChange={(e) => setRefSequence(e.target.value)}
                placeholder="001"
                className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-3 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none transition"
              />
            </div>
          </div>
          <div className="col-span-2 flex items-end justify-between">
            <div className="flex-1 mr-4">
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                Description / Memo
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDetailed(!showDetailed)}
                className="px-4 py-3 h-[46px] bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold text-gray-600 rounded-md transition shadow-sm cursor-pointer"
              >
                {showDetailed ? '📉 Compact View' : '📈 Full DOLE Categories'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-max border-t border-[#B0DCDA]">
          <thead className="bg-[#FBF8F8] sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <tr className="border-b border-gray-200 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
              <th className="p-2 border-r border-[#B0DCDA] sticky left-0 z-40 bg-[#FBF8F8]">Profile</th>
              <th colSpan={3} className="p-2 border-r border-[#B0DCDA] text-orange-600 bg-orange-50/50">
                Demerits
              </th>
              <th colSpan={showDetailed ? 16 : 1} className="p-2 border-r border-[#B0DCDA] text-blue-600 bg-blue-50/50">
                DOLE Premiums (Hours)
              </th>
              <th colSpan={2} className="p-2 border-r border-[#B0DCDA] text-green-600 bg-green-50/50">
                Allowances & Gross (₱)
              </th>
              <th colSpan={4} className="p-2 border-r border-[#B0DCDA] text-red-500 bg-red-50/50">
                Deductions & Taxes (₱)
              </th>
              <th className="p-2 text-[#1B9387] bg-[#E9FAFA]/50">Payout (₱)</th>
            </tr>
            <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold border-b border-[#B0DCDA]">
              <th className="p-3 border-r border-[#B0DCDA] sticky left-0 z-40 bg-[#FBF8F8] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Employee Name
              </th>
              <th className="p-3 text-center border-r border-gray-200" title="Late Minutes">Late(m)</th>
              <th className="p-3 text-center border-r border-gray-200" title="Undertime Minutes">UT(m)</th>
              <th className="p-3 text-center border-r border-gray-200" title="Absence Days">Abs(d)</th>

              {showDetailed ? (
                categories.map(c => (
                  <th key={c.key} className="p-3 text-center border-r border-gray-200">{c.label}</th>
                ))
              ) : (
                <th className="p-3 text-center border-r border-gray-200 text-gray-400 italic">Total Premium Hours (Hidden)</th>
              )}

              <th className="p-3 text-right border-r border-gray-200">Allowances</th>
              <th className="p-3 text-right border-r border-[#B0DCDA] text-green-600 bg-green-50/50">Total Gross</th>

              <th className="p-3 text-right border-r border-gray-200">Statutory</th>
              <th className="p-3 text-right border-r border-gray-200">Loans</th>
              <th className="p-3 text-right border-r border-gray-200">Other Ded.</th>
              <th className="p-3 text-right border-r border-[#B0DCDA] text-red-500 bg-red-50/50">Tax W/H</th>

              <th className="p-3 text-right text-[#1B9387] bg-[#E9FAFA]/50 pr-6">Net Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-gray-50/30">
            {activeEmployees.length === 0 ? (
              <tr>
                <td colSpan={25} className="p-12 text-center text-gray-400 italic">
                  No active employees found.
                </td>
              </tr>
            ) : (
              activeEmployees.map((emp) => {
                const res = results[emp.id] || {}
                const inp = inputs[emp.id] || { demerits: {}, hours: {} }

                return (
                  <tr key={emp.id} className="hover:bg-[#E9FAFA]/30 transition-colors group">
                    <td className="p-3 font-bold text-gray-800 border-r border-[#B0DCDA] sticky left-0 z-10 bg-white group-hover:bg-[#FBF8F8] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex items-center justify-between">
                      <div className="flex flex-col">
                        <span>{emp.first_name} {emp.last_name}</span>
                        <span className="text-[10px] font-normal text-gray-400">Base: {formatCurrency(emp.monthly_salary/2)}</span>
                      </div>
                    </td>

                    {renderInput(inp.demerits.late_minutes || 0, (v) => handleDemeritChange(emp.id, 'late_minutes', v), 'text-orange-600', 'bg-orange-50/50')}
                    {renderInput(inp.demerits.undertime_minutes || 0, (v) => handleDemeritChange(emp.id, 'undertime_minutes', v), 'text-orange-600', 'bg-orange-50/50')}
                    {renderInput(inp.demerits.absence_days || 0, (v) => handleDemeritChange(emp.id, 'absence_days', v), 'text-orange-600', 'bg-orange-50/50')}

                    {showDetailed ? (
                      categories.map(c => (
                        renderInput(inp.hours[c.key] || 0, (v) => handleHourChange(emp.id, c.key, v), c.color, c.bg)
                      ))
                    ) : (
                      <td className="p-3 text-center border-r border-gray-200 text-gray-400 bg-gray-50 italic">
                        {Object.values(inp.hours).reduce((a: any, b: any) => a + (b || 0), 0) > 0 ? 'Has premiums' : '-'}
                      </td>
                    )}

                    <td className="p-3 pr-4 border-r border-gray-200 bg-white">
                      <CellMoney val={(res.taxable_allowances || 0) + (res.non_taxable_allowances || 0)} />
                    </td>
                    <td className="p-3 pr-4 border-r border-[#B0DCDA] bg-green-50/30">
                      <CellMoney val={res.gross_pay || 0} colorClass="text-green-600" />
                    </td>

                    <td className="p-3 pr-4 border-r border-gray-200 bg-white">
                      <CellMoney val={(res.sss || 0) + (res.philhealth || 0) + (res.pagibig || 0)} colorClass="text-orange-500" isBold={false} />
                    </td>
                    <td className="p-3 pr-4 border-r border-gray-200 bg-white">
                      <CellMoney val={(res.cash_advance || 0) + (res.loans_amount || 0)} colorClass="text-orange-500" isBold={false} />
                    </td>
                    <td className="p-3 pr-4 border-r border-gray-200 bg-white">
                      <CellMoney val={(res.license_fee || 0) + (res.other_deductions || 0)} colorClass="text-orange-500" isBold={false} />
                    </td>
                    <td className="p-3 pr-4 border-r border-[#B0DCDA] bg-red-50/30">
                      <CellMoney val={res.tax_withheld || 0} colorClass="text-red-500" />
                    </td>
                    <td className="p-3 pr-6 text-right bg-[#FBF8F8]/50 border-r border-transparent">
                      <CellMoney val={res.net_pay || 0} colorClass="text-[#1B9387]" />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 bg-[#FBF8F8] border-t border-[#B0DCDA] p-5 px-6 flex justify-between items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-40 shrink-0">
        <div className="grid grid-cols-4 gap-8 text-sm w-2/3">
          <div>
            <p className="text-gray-500 uppercase text-[10px] font-extrabold tracking-widest">Total Gross</p>
            <p className="font-mono text-gray-800 font-bold text-lg mt-1 tabular-nums">{formatCurrency(totalGross)}</p>
          </div>
          <div>
            <p className="text-orange-500 uppercase text-[10px] font-extrabold tracking-widest">Total Deductions</p>
            <p className="font-mono text-orange-500 font-bold text-lg mt-1 tabular-nums">{formatCurrency(totalDeductions)}</p>
          </div>
          <div>
            <p className="text-red-500 uppercase text-[10px] font-extrabold tracking-widest">Total Tax W/H</p>
            <p className="font-mono text-red-500 font-bold text-lg mt-1 tabular-nums">{formatCurrency(totalTax)}</p>
          </div>
          <div>
            <p className="text-[#1B9387] uppercase text-[10px] font-extrabold tracking-widest">Total Net Payout</p>
            <p className="font-mono text-[#1B9387] font-black text-2xl mt-0.5 tabular-nums">{formatCurrency(totalNet)}</p>
          </div>
        </div>
        <button
          onClick={handleProcessPayroll}
          disabled={loading || activeEmployees.length === 0}
          className="px-10 py-4 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-bold transition shadow-md tracking-wide cursor-pointer uppercase text-sm flex items-center gap-2"
        >
          {loading ? <><span className="animate-spin text-lg">↻</span> Processing...</> : 'Post Payroll'}
        </button>
      </div>
    </div>
  )
}
