// src/renderer/src/components/SystemSettingsView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Save,
  CalendarClock,
  KeyRound,
  FileCheck,
  RefreshCcw
} from 'lucide-react'

interface SystemSettingsViewProps {
  userId: string
}

export function SystemSettingsView({ userId }: SystemSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'calendar'>('security')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  return (
    <div className="w-full min-h-[calc(100vh-64px)] p-6 md:p-10 bg-[#f9fafb] animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 border-b border-[#B0DCDA] pb-0 flex gap-8">
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-4 text-xl font-extrabold tracking-wide ${activeTab === 'security' ? 'text-gray-800 border-b-4 border-[#1B9387]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Security Settings
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-4 text-xl font-extrabold tracking-wide ${activeTab === 'calendar' ? 'text-gray-800 border-b-4 border-[#1B9387]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Accounting Calendar & Books Closing
          </button>
        </div>

        {status && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-center gap-3 shadow-sm border ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-600 border-red-200'}`}
          >
            {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {status.msg}
          </div>
        )}

        {activeTab === 'security' ? (
          <SecurityTab setGlobalStatus={setStatus} />
        ) : (
          <AccountingCalendarTab userId={userId} setGlobalStatus={setStatus} />
        )}
      </div>
    </div>
  )
}

function SecurityTab({ setGlobalStatus }: { setGlobalStatus: (s: any) => void }) {
  const [lockDate, setLockDate] = useState('')
  const [originalDate, setOriginalDate] = useState('')
  const [autoLockDay, setAutoLockDay] = useState<number | ''>('')
  const [originalAutoLockDay, setOriginalAutoLockDay] = useState<number | ''>('')
  const [overridePin, setOverridePin] = useState('')
  const [hasExistingPin, setHasExistingPin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const res = await api.getLockDate()
        if (res?.lockDate) {
          const localDate = res.lockDate.split('T')[0]
          setLockDate(localDate)
          setOriginalDate(localDate)
        }
        if (res?.autoLockDay) {
          setAutoLockDay(res.autoLockDay)
          setOriginalAutoLockDay(res.autoLockDay)
        }
        if (res?.hasOverridePin) setHasExistingPin(true)
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setGlobalStatus(null)
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const payload = {
        lockDate: lockDate || null,
        autoLockDay: autoLockDay ? Number(autoLockDay) : null,
        overridePin: overridePin || null
      }
      const result = await api.setLockDate(payload)
      if (result.success) {
        setOriginalDate(lockDate)
        setOriginalAutoLockDay(autoLockDay)
        if (overridePin) setHasExistingPin(true)
        else if (overridePin === '') setHasExistingPin(false)
        setOverridePin('')
        setGlobalStatus({ type: 'success', msg: 'System security settings updated successfully!' })
        if (api.logAction) {
          await api.logAction('SYSTEM', 'SECURITY', `Updated Accounting Lock Settings`)
        }
      }
    } catch (error: any) {
      setGlobalStatus({ type: 'error', msg: error.message || 'Failed to update settings.' })
    } finally {
      setLoading(false)
    }
  }

  const isDirty =
    lockDate !== originalDate || autoLockDay !== originalAutoLockDay || overridePin.length > 0

  return (
    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row mb-6">
      <div
        className={`w-full md:w-1/3 p-8 flex flex-col items-center justify-center text-center transition-colors ${lockDate ? 'bg-red-50' : 'bg-emerald-50'}`}
      >
        {lockDate ? (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Lock size={28} />
            </div>
            <h3 className="text-red-700 font-extrabold uppercase tracking-widest text-sm mb-1">
              Period Locked
            </h3>
            <p className="text-xs font-bold text-red-500/70">
              As of {new Date(lockDate).toLocaleDateString()}
            </p>
            {hasExistingPin && (
              <span className="mt-4 bg-white/50 text-red-600 border border-red-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                <KeyRound size={12} /> PIN Active
              </span>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Unlock size={28} />
            </div>
            <h3 className="text-emerald-700 font-extrabold uppercase tracking-widest text-sm mb-1">
              Unlocked
            </h3>
            <p className="text-xs font-bold text-emerald-500/70">All dates open</p>
          </>
        )}
      </div>

      <div className="w-full md:w-2/3 p-8">
        <h3 className="text-lg font-extrabold text-gray-800 mb-2">Month-End Accounting Lock</h3>
        <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
          Set a date below to prevent anyone from adding, editing, or voiding transactions on or
          before that date. This ensures your reconciled data and filed taxes are never accidentally
          modified.
        </p>

        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl">
            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
              Current Global Lock Date
            </label>
            <div className="flex gap-3">
              <input
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                className="w-full max-w-xs bg-white border border-gray-300 rounded-md p-3 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm"
              />
              {lockDate && (
                <button
                  onClick={() => setLockDate('')}
                  className="px-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md uppercase tracking-wider transition cursor-pointer border border-transparent"
                >
                  Remove Lock
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#E9FAFA]/50 border border-[#B0DCDA] p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock size={16} className="text-[#1B9387]" />
              <label className="block text-[10px] font-extrabold text-[#1B9387] uppercase tracking-wider">
                Automate Closing (Grace Period)
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Automatically lock the previous month after this many days have passed in the new month.
            </p>

            <div className="flex items-center gap-3">
              <select
                value={autoLockDay}
                onChange={(e) => setAutoLockDay(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full max-w-xs bg-white border border-[#B0DCDA] rounded-md p-3 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none cursor-pointer shadow-sm"
              >
                <option value="">Disabled (Manual Lock Only)</option>
                <option value={3}>Lock on the 3rd of the month</option>
                <option value={5}>Lock on the 5th of the month</option>
                <option value={7}>Lock on the 7th of the month</option>
                <option value={10}>Lock on the 10th of the month</option>
              </select>
            </div>
          </div>

          <div className="bg-red-50/50 border border-red-200 p-5 rounded-xl">
            <label className="block text-[10px] font-extrabold text-red-600 uppercase tracking-wider mb-2">
              Manager Override PIN
            </label>
            <p className="text-xs text-red-500/80 mb-3 font-medium">
              Required to backdate Adjusting Entries or Void transactions in a locked period. Leave
              blank to retain current PIN.
            </p>
            <input
              type="password"
              value={overridePin}
              onChange={(e) => setOverridePin(e.target.value)}
              placeholder={hasExistingPin ? '•••• (PIN is set)' : 'Enter 4 to 6 digit PIN'}
              className="w-full max-w-xs bg-white border border-red-200 rounded-md p-3 text-sm font-mono font-bold text-gray-800 focus:border-red-500 outline-none shadow-sm"
            />
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
            <button
              disabled={!isDirty || loading}
              onClick={handleSave}
              className="px-8 py-3 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} /> Save Security Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountingCalendarTab({
  userId,
  setGlobalStatus
}: {
  userId: string
  setGlobalStatus: (s: any) => void
}) {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [periods, setPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(1)
  const [originalFiscalYearStartMonth, setOriginalFiscalYearStartMonth] = useState<number>(1)

  // Modals
  const [closeModalPeriod, setCloseModalPeriod] = useState<any | null>(null)
  const [reopenModalPeriod, setReopenModalPeriod] = useState<any | null>(null)
  const [managerPin, setManagerPin] = useState('')

  const fetchCalendar = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const [calendarRes, lockRes] = await Promise.all([
        api.getCalendar(year),
        api.getLockDate()
      ])
      setPeriods(calendarRes || [])
      if (lockRes?.fiscalYearStartMonth) {
        setFiscalYearStartMonth(lockRes.fiscalYearStartMonth)
        setOriginalFiscalYearStartMonth(lockRes.fiscalYearStartMonth)
      }
    } catch (error: any) {
      setGlobalStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveStartMonth = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const result = await api.setLockDate({ fiscalYearStartMonth })
      if (result.success) {
        setOriginalFiscalYearStartMonth(fiscalYearStartMonth)
        setGlobalStatus({ type: 'success', msg: 'Fiscal year setting updated successfully!' })
        fetchCalendar()
      }
    } catch (error: any) {
      setGlobalStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendar()
  }, [year])

  const handleClosePeriod = async () => {
    if (!closeModalPeriod) return
    try {
      const api = (window as any).api || (window as any).electronAPI
      const res = await api.closePeriod(year, closeModalPeriod.periodNumber, userId)
      if (res.success) {
        setGlobalStatus({ type: 'success', msg: `Period ${closeModalPeriod.periodName} closed successfully.` })
        fetchCalendar()
      } else {
        setGlobalStatus({ type: 'error', msg: res.error || 'Failed to close period.' })
      }
    } catch (error: any) {
      setGlobalStatus({ type: 'error', msg: error.message })
    } finally {
      setCloseModalPeriod(null)
    }
  }

  const handleReopenPeriod = async () => {
    if (!reopenModalPeriod || !managerPin) return
    try {
      const api = (window as any).api || (window as any).electronAPI
      const res = await api.reopenPeriod(year, reopenModalPeriod.periodNumber, userId, managerPin)
      if (res.success) {
        setGlobalStatus({ type: 'success', msg: `Period ${reopenModalPeriod.periodName} reopened successfully.` })
        setManagerPin('')
        fetchCalendar()
      } else {
        setGlobalStatus({ type: 'error', msg: res.error || 'Failed to reopen period. Incorrect PIN?' })
      }
    } catch (error: any) {
      setGlobalStatus({ type: 'error', msg: error.message })
    } finally {
      setReopenModalPeriod(null)
      setManagerPin('')
    }
  }

  return (
    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-extrabold text-gray-800">Fiscal Year</h3>
          <p className="text-sm text-gray-500 font-medium">Manage monthly books closing and view period summaries.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Start Month</label>
            <select
              value={fiscalYearStartMonth}
              onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-md p-2 font-bold text-gray-800 focus:border-[#1B9387] outline-none text-sm"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          {fiscalYearStartMonth !== originalFiscalYearStartMonth && (
            <button
              onClick={handleSaveStartMonth}
              className="mt-4 p-2 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md transition text-sm font-bold"
            >
              <Save size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md p-2 font-bold text-gray-800 focus:border-[#1B9387] outline-none"
          >
            {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={fetchCalendar}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition"
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 font-bold">Loading calendar...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {periods.map((period) => (
            <div
              key={period.periodNumber}
              className={`border rounded-xl p-4 flex flex-col justify-between ${
                period.status === 'CLOSED'
                  ? 'bg-slate-50 border-slate-200'
                  : period.status === 'LOCKED'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-white border-emerald-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-extrabold text-gray-800 text-base">{period.periodName || period.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                      period.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-700'
                        : period.status === 'LOCKED'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {period.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-bold mb-3">
                  {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                </p>

                <div className="space-y-1 mb-4 border-t pt-2 border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Revenue:</span>
                    <span className="font-bold text-emerald-600">
                      ₱{(period.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Expenses:</span>
                    <span className="font-bold text-red-600">
                      ₱{(period.totalExpenses ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold mt-1 pt-1 border-t border-gray-100">
                    <span className="text-gray-700">Net Income:</span>
                    <span className={(period.netIncome ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      ₱{(period.netIncome ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {period.status === 'OPEN' || period.status === 'LOCKED' ? (
                  <button
                    onClick={() => setCloseModalPeriod(period)}
                    className="w-full py-2.5 bg-[#1B9387] hover:bg-[#28958B] !text-white rounded-md text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2 transition cursor-pointer shadow-sm"
                    style={{ color: '#ffffff' }}
                  >
                    <FileCheck size={15} className="!text-white" /> Close Books
                  </button>
                ) : (
                  <div>
                    {period.closingJournalId && (
                      <p className="text-[10px] text-center text-gray-500 mb-2 truncate">
                        Voucher: {period.closingJournalId}
                      </p>
                    )}
                    <button
                      onClick={() => setReopenModalPeriod(period)}
                      className="w-full py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-md text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2 transition cursor-pointer"
                    >
                      <Unlock size={14} /> Reopen Period
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Close Books Modal */}
      {closeModalPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Close Books: {closeModalPeriod.periodName || closeModalPeriod.name}</h3>
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm font-bold mb-4 flex gap-2">
              <AlertTriangle size={18} className="shrink-0 text-yellow-600" />
              <p>
                Closing this period will post a closing journal entry zeroing temporary accounts to Retained Earnings
                and lock this period from further transactions.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 font-medium">Total Revenue</span>
                <span className="font-bold text-emerald-600">
                  ₱{(closeModalPeriod.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 font-medium">Total Expenses</span>
                <span className="font-bold text-red-600">
                  ₱{(closeModalPeriod.totalExpenses ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-800">Net Income to Transfer</span>
                <span className={(closeModalPeriod.netIncome ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  ₱{(closeModalPeriod.netIncome ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCloseModalPeriod(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClosePeriod}
                className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] !text-white rounded-md text-sm font-bold uppercase flex items-center gap-2 cursor-pointer shadow-sm"
                style={{ color: '#ffffff' }}
              >
                <FileCheck size={16} className="!text-white" /> Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Period Modal (Requires Manager PIN) */}
      {reopenModalPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-xl font-extrabold text-red-600 mb-2">Reopen Period</h3>
            <p className="text-sm text-gray-600 font-medium mb-4">
              Reopening <strong>{reopenModalPeriod.periodName || reopenModalPeriod.name}</strong> will void the closing entry and allow new transactions.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Manager Override PIN
              </label>
              <input
                type="password"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-lg text-center font-mono tracking-widest text-lg outline-none focus:border-red-500"
                placeholder="••••"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setReopenModalPeriod(null)
                  setManagerPin('')
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenPeriod}
                disabled={!managerPin}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md text-sm font-bold uppercase"
              >
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
