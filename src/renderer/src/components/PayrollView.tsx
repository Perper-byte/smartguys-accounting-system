import * as React from 'react'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { PayrollDirectoryTab } from './payroll/PayrollDirectoryTab'
import { PayrollHistoryTab } from './payroll/PayrollHistoryTab'
import { PayrollGridTab } from './payroll/PayrollGridTab'
import { PayrollSettingsTab } from './payroll/PayrollSettingsTab'
import { DtrImportTab } from './payroll/DtrImportTab'

export function PayrollView({ userId }: { userId: string }) {
  const [view, setView] = useState<'GRID' | 'SETTINGS' | 'IMPORT' | 'HISTORY' | 'DIRECTORY'>('GRID')
  const [employees, setEmployees] = useState<any[]>([])
  const [payrollHistory, setPayrollHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [dtrAppliedUpdates, setDtrAppliedUpdates] = useState<any[] | null>(null)

  // Run Payroll States
  const [payrollItems, setPayrollItems] = useState<any[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [refSequence, setRefSequence] = useState('')
  const [description, setDescription] = useState('')
  const [showDetailed, setShowDetailed] = useState(false)

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const data = await api.getEmployees()
      setEmployees(data || [])

      const activeEmployees = (data || []).filter((emp: any) => emp.is_active !== false)

      const initialItems = activeEmployees.map((emp: any) => {
        const base = emp.monthly_salary ? Number(emp.monthly_salary) / 2 : 0
        return {
          id: emp.id,
          name: `${emp.first_name} ${emp.last_name}`,
          hasIncompleteIds: !emp.tin || !emp.sss_no,
          basePay: base,
          overtime: 0,
          nightDiff: 0,
          otherEarnings: 0,
          gross: base,
          sss: 0,
          philhealth: 0,
          pagibig: 0,
          cashAdvance: 0,
          licenseFee: 0,
          otherDeductions: 0,
          deductions: 0,
          tax: 0,
          net: base
        }
      })
      setPayrollItems(initialItems)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNextSeq = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      const nextSeq = await api.getNextSequence('PY-')
      setRefSequence(nextSeq)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchHistory = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api.getPayrollHistory) {
        const history = await api.getPayrollHistory()
        const uniqueHistory = Array.from(
          new Map((history || []).map((item: any) => [item.referenceNo, item])).values()
        )
        uniqueHistory.sort(
          (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setPayrollHistory(uniqueHistory)
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchEmployees()
    fetchNextSeq()
  }, [])

  useEffect(() => {
    if (view === 'DIRECTORY') fetchEmployees()
    if (view === 'HISTORY') fetchHistory()
  }, [view])

  // --- ID Formatting Masks (Philippines) ---
  const formatTIN = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 12)
    return num.replace(
      /(\d{3})(\d{1,3})?(\d{1,3})?(\d{1,3})?/,
      (m, p1, p2, p3, p4) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '') + (p4 ? `-${p4}` : '')
    )
  }
  const formatSSS = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 10)
    return num.replace(
      /(\d{2})(\d{1,7})?(\d{1})?/,
      (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '')
    )
  }
  const formatHDMF = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 12)
    return num.replace(
      /(\d{4})(\d{1,4})?(\d{1,4})?/,
      (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '')
    )
  }
  const formatPHIC = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 12)
    return num.replace(
      /(\d{2})(\d{1,9})?(\d{1})?/,
      (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '')
    )
  }

  const handleUpdateItem = (id: number, field: string, value: number) => {
    setPayrollItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          updated.gross =
            (updated.basePay || 0) +
            (updated.overtime || 0) +
            (updated.nightDiff || 0) +
            (updated.otherEarnings || 0)
          updated.deductions =
            (updated.sss || 0) +
            (updated.philhealth || 0) +
            (updated.pagibig || 0) +
            (updated.cashAdvance || 0) +
            (updated.licenseFee || 0) +
            (updated.otherDeductions || 0)
          updated.net = updated.gross - updated.deductions - (updated.tax || 0)
          return updated
        }
        return item
      })
    )
  }

  const handleImportApply = (updates: any[]) => {
    setDtrAppliedUpdates(updates)
    setView('GRID')
    setStatus({
      type: 'success',
      msg: `DTR timesheet attendance data loaded for ${updates.length} employee(s)!`
    })
  }

  const handleProcessPayroll = async () => {
    setStatus(null)
    if (!refSequence) return setStatus({ type: 'error', msg: 'Sequence number required.' })
    if (payrollItems.length === 0)
      return setStatus({ type: 'error', msg: 'No active employees to pay.' })

    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
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
        fetchEmployees()
        setTimeout(() => setStatus(null), 5000)
      } else setStatus({ type: 'error', msg: 'Database Error: ' + response.error })
    } catch (error) {
      setStatus({ type: 'error', msg: 'System Error.' })
    } finally {
      setLoading(false)
    }
  }

  // --- UI Helpers ---
  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // UX: Dim Zeros Helper
  const CellMoney = ({
    val,
    colorClass = 'text-gray-800',
    isBold = true
  }: {
    val: number
    colorClass?: string
    isBold?: boolean
  }) => (
    <span
      className={`tabular-nums block w-full text-right ${isBold ? 'font-bold' : 'font-medium'} ${val === 0 ? 'text-gray-300' : colorClass}`}
    >
      {val === 0
        ? '0.00'
        : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )

  // UX: Dim Zeros in Input Field
  const renderInput = (
    id: number,
    value: number,
    field: string,
    defaultTextColor: string,
    focusBg: string
  ) => (
    <td className="p-0 border-r border-gray-200 bg-white group-hover:bg-transparent transition-colors">
      <input
        type="number"
        min="0"
        step="0.01"
        value={value === 0 ? '' : value}
        placeholder="0.00"
        onChange={(e) => handleUpdateItem(id, field, Number(e.target.value))}
        className={`w-full h-full min-h-[48px] min-w-[90px] bg-transparent hover:bg-gray-100/50 px-3 text-right font-mono tabular-nums outline-none focus:${focusBg} border-2 border-transparent focus:border-gray-300 transition-colors ${value === 0 ? 'text-gray-300 font-medium' : `font-bold ${defaultTextColor}`}`}
      />
    </td>
  )

  const totalGross = payrollItems.reduce((sum, item) => sum + item.gross, 0)
  const totalDeductions = payrollItems.reduce((sum, item) => sum + item.deductions, 0)
  const totalTax = payrollItems.reduce((sum, item) => sum + item.tax, 0)
  const totalNet = payrollItems.reduce((sum, item) => sum + item.net, 0)

  return (
    <div className="w-full h-full flex items-center justify-center p-2 lg:p-4 bg-gray-50/30">
      <div className="w-full max-w-[1900px] h-full flex flex-col font-sans text-gray-800 bg-white shadow-sm border border-transparent rounded-xl overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-end mb-2 p-6 pb-4 border-b border-[#B0DCDA] shrink-0 print:hidden">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">
              Human Resources & Payroll
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Manage staff directory and process batch salary disbursements.
            </p>
          </div>
          <div className="flex bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner gap-1">
            <button
              onClick={() => {
                setView('GRID')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'GRID' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              Payroll Grid
            </button>
            <button
              onClick={() => {
                setView('SETTINGS')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'SETTINGS' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              DOLE Settings
            </button>
            <button
              onClick={() => {
                setView('IMPORT')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'IMPORT' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              DTR Import
            </button>
            <button
              onClick={() => {
                setView('HISTORY')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'HISTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              History
            </button>
            <button
              onClick={() => {
                setView('DIRECTORY')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'DIRECTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              Directory
            </button>
          </div>
        </div>

        {status && (
          <div
            className={`mx-6 mb-4 p-4 rounded-md text-sm font-bold shadow-sm border shrink-0 print:hidden flex items-center justify-between animate-in fade-in ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}
          >
            <span>
              {status.type === 'success' ? '✅ ' : '⚠️ '}
              {status.msg}
            </span>
            <button
              onClick={() => setStatus(null)}
              className="opacity-50 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* RUN PAYROLL TAB: CLINIC EXCEL SPREADSHEET */}
        {/* ========================================== */}
        {/* Keep PayrollGridTab mounted in DOM so working hours and inputs are NEVER wiped when switching tabs */}
        <div className={view === 'GRID' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <PayrollGridTab
            employees={employees}
            userId={userId}
            setStatus={setStatus}
            dtrUpdates={dtrAppliedUpdates || undefined}
            onClearDtr={() => setDtrAppliedUpdates(null)}
          />
        </div>

        {/* SETTINGS TAB */}
        {view === 'SETTINGS' && <PayrollSettingsTab />}

        {/* IMPORT TAB */}
        {view === 'IMPORT' && <DtrImportTab employees={employees} onApply={handleImportApply} />}

        {/* HISTORY TAB */}
        {view === 'HISTORY' && <PayrollHistoryTab payrollHistory={payrollHistory} />}

        {/* DIRECTORY TAB (Overhauled UI)     */}
        {/* ========================================== */}
        {view === 'DIRECTORY' && (
          <PayrollDirectoryTab
            employees={employees}
            fetchEmployees={fetchEmployees}
            setStatus={setStatus}
          />
        )}

              </div>
    </div>
  )
}
