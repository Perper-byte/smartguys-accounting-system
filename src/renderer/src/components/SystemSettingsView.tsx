// src/renderer/src/components/SystemSettingsView.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  CalendarClock,
  KeyRound,
  FileCheck,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Save,
  Unlock,
  Lock
} from 'lucide-react'

interface SystemSettingsViewProps {
  userId: string
}

export function SystemSettingsView({ userId }: SystemSettingsViewProps) {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [periods, setPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Configuration settings
  const [yearType, setYearType] = useState<'CALENDAR' | 'FISCAL'>('CALENDAR')
  const [originalYearType, setOriginalYearType] = useState<'CALENDAR' | 'FISCAL'>('CALENDAR')
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(1)
  const [originalFiscalYearStartMonth, setOriginalFiscalYearStartMonth] = useState<number>(1)

  const [autoCloseEnabled, setAutoCloseEnabled] = useState<boolean>(false)
  const [originalAutoCloseEnabled, setOriginalAutoCloseEnabled] = useState<boolean>(false)
  const [autoCloseFrequency, setAutoCloseFrequency] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [originalAutoCloseFrequency, setOriginalAutoCloseFrequency] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [autoLockDay, setAutoLockDay] = useState<number | ''>('')
  const [originalAutoLockDay, setOriginalAutoLockDay] = useState<number | ''>('')
  const [overridePin, setOverridePin] = useState('')
  const [hasExistingPin, setHasExistingPin] = useState(false)
  const [lockDate, setLockDate] = useState('')

  // Modals
  const [closeModalPeriod, setCloseModalPeriod] = useState<any | null>(null)
  const [preCloseValidation, setPreCloseValidation] = useState<any | null>(null)
  const [validatingPreClose, setValidatingPreClose] = useState<boolean>(false)
  const [forceUnmatchedBank, setForceUnmatchedBank] = useState<boolean>(false)
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
      if (lockRes) {
        const yType =
          lockRes.yearType ||
          (lockRes.fiscalYearStartMonth && lockRes.fiscalYearStartMonth !== 1
            ? 'FISCAL'
            : 'CALENDAR')
        setYearType(yType)
        setOriginalYearType(yType)

        if (lockRes.fiscalYearStartMonth) {
          setFiscalYearStartMonth(lockRes.fiscalYearStartMonth)
          setOriginalFiscalYearStartMonth(lockRes.fiscalYearStartMonth)
        }

        const isAutoEnabled = !!lockRes.autoCloseEnabled
        setAutoCloseEnabled(isAutoEnabled)
        setOriginalAutoCloseEnabled(isAutoEnabled)

        const freq = lockRes.autoCloseFrequency || 'MONTHLY'
        setAutoCloseFrequency(freq)
        setOriginalAutoCloseFrequency(freq)

        if (lockRes.autoLockDay !== undefined) {
          setAutoLockDay(lockRes.autoLockDay || '')
          setOriginalAutoLockDay(lockRes.autoLockDay || '')
        }
        if (lockRes.hasOverridePin) {
          setHasExistingPin(true)
        }
        if (lockRes.lockDate) {
          setLockDate(lockRes.lockDate.split('T')[0])
        } else {
          setLockDate('')
        }
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendar()
  }, [year])

  const handleSaveYearType = async (typeToSave: 'CALENDAR' | 'FISCAL', monthToSave?: number) => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const startMonth = typeToSave === 'CALENDAR' ? 1 : (monthToSave ?? fiscalYearStartMonth ?? 1)
      const result = await api.setLockDate({
        yearType: typeToSave,
        fiscalYearStartMonth: startMonth
      })
      if (result.success) {
        setYearType(typeToSave)
        setOriginalYearType(typeToSave)
        setFiscalYearStartMonth(startMonth)
        setOriginalFiscalYearStartMonth(startMonth)
        setStatus({
          type: 'success',
          msg:
            typeToSave === 'CALENDAR'
              ? 'Updated to Calendar Year (Jan 1 – Dec 31)!'
              : `Updated to Fiscal Year starting in ${new Date(0, startMonth - 1).toLocaleString('en-US', { month: 'long' })}!`
        })
        fetchCalendar()
      } else {
        setStatus({ type: 'error', msg: result.error || 'Failed to update year cycle.' })
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAutoClose = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const dayVal = autoCloseEnabled ? (autoLockDay === '' ? 5 : Number(autoLockDay)) : null
      const result = await api.setLockDate({
        autoCloseEnabled,
        autoCloseFrequency,
        autoLockDay: dayVal
      })
      if (result.success) {
        setOriginalAutoCloseEnabled(autoCloseEnabled)
        setOriginalAutoCloseFrequency(autoCloseFrequency)
        setOriginalAutoLockDay(dayVal || '')
        setStatus({
          type: 'success',
          msg: autoCloseEnabled
            ? `Automated closing enabled (${autoCloseFrequency === 'MONTHLY' ? 'Every Month' : 'One Year'}, ${dayVal} days grace period)!`
            : 'Automated closing disabled (Manual close only).'
        })
        fetchCalendar()
      } else {
        setStatus({ type: 'error', msg: result.error || 'Failed to update automated closing.' })
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSavePin = async () => {
    if (!overridePin.trim()) return
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const result = await api.setLockDate({ overridePin: overridePin.trim() })
      if (result.success) {
        setHasExistingPin(true)
        setOverridePin('')
        setStatus({ type: 'success', msg: 'Manager Override PIN updated successfully!' })
        if (api.logAction) {
          await api.logAction('SYSTEM', 'SECURITY', 'Updated Manager Override PIN')
        }
      } else {
        setStatus({ type: 'error', msg: result.error || 'Failed to update PIN.' })
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveLock = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const result = await api.setLockDate({ lockDate: null })
      if (result.success) {
        setLockDate('')
        setStatus({ type: 'success', msg: 'Global lock date removed.' })
        fetchCalendar()
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!closeModalPeriod) {
      setPreCloseValidation(null)
      setForceUnmatchedBank(false)
      return
    }
    const checkValidation = async () => {
      setValidatingPreClose(true)
      try {
        const api = (window as any).api || (window as any).electronAPI
        if (api?.validatePreClose) {
          const res = await api.validatePreClose(year, closeModalPeriod.periodNumber)
          if (res?.success) {
            setPreCloseValidation(res.validation)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setValidatingPreClose(false)
      }
    }
    checkValidation()
  }, [closeModalPeriod, year])

  const handleClosePeriod = async () => {
    if (!closeModalPeriod) return
    try {
      const api = (window as any).api || (window as any).electronAPI
      const res = await api.closePeriod(year, closeModalPeriod.periodNumber, userId, {
        forceUnmatchedBank
      })
      if (res.success) {
        setStatus({
          type: 'success',
          msg: `Period ${closeModalPeriod.periodName} closed successfully via 3999 Income Summary.`
        })
        fetchCalendar()
      } else {
        setStatus({ type: 'error', msg: res.error || 'Failed to close period.' })
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
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
        setStatus({ type: 'success', msg: `Period ${reopenModalPeriod.periodName} reopened successfully.` })
        setManagerPin('')
        fetchCalendar()
      } else {
        setStatus({ type: 'error', msg: res.error || 'Failed to reopen period. Incorrect PIN?' })
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message })
    } finally {
      setReopenModalPeriod(null)
      setManagerPin('')
    }
  }

  return (
    <div className="w-full min-h-[calc(100vh-64px)] p-6 md:p-10 bg-[#f9fafb] animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-[#B0DCDA] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2.5">
              <CalendarClock className="text-[#1B9387]" size={26} />
              Accounting Calendar &amp; Books Closing
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Manage fiscal periods, automated closing grace periods, and manager override PIN.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lockDate && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm">
                <Lock size={14} className="text-red-500" />
                <span>Locked as of {new Date(lockDate).toLocaleDateString()}</span>
                <button
                  onClick={handleRemoveLock}
                  className="text-red-500 hover:text-red-800 font-extrabold uppercase text-[10px] underline ml-1 cursor-pointer"
                  title="Remove lock date"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
              >
                {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                  <option key={y} value={y}>
                    FY {y}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchCalendar}
                title="Refresh calendar"
                className="p-2.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-gray-600 transition cursor-pointer shadow-sm"
              >
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>
        </div>

        {status && (
          <div
            className={`p-4 rounded-xl text-sm font-bold flex items-center gap-3 shadow-sm border ${
              status.type === 'success'
                ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}
          >
            {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {status.msg}
          </div>
        )}

        {/* Configuration Row: Fiscal Start Month, Auto-Lock Grace Period, Manager Override PIN */}
        <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Accounting Cycle: Calendar Year vs Fiscal Year */}
            <div className="bg-gray-50/70 border border-gray-200/80 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">
                    Accounting Cycle
                  </label>
                  {/* Interchangeable Segmented Toggle */}
                  <div className="inline-flex rounded-lg bg-gray-200/80 p-0.5 border border-gray-300">
                    <button
                      type="button"
                      onClick={() => {
                        setYearType('CALENDAR')
                        setFiscalYearStartMonth(1)
                      }}
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition cursor-pointer ${
                        yearType === 'CALENDAR'
                          ? 'bg-[#1B9387] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => setYearType('FISCAL')}
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition cursor-pointer ${
                        yearType === 'FISCAL'
                          ? 'bg-[#1B9387] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Fiscal
                    </button>
                  </div>
                </div>

                {yearType === 'CALENDAR' ? (
                  <div className="bg-white border border-gray-300 rounded-lg p-2.5 text-xs font-bold text-gray-700 shadow-sm flex items-center justify-between">
                    <span>January – December</span>
                    <span className="text-[10px] uppercase font-black text-[#1B9387] bg-[#E9FAFA] px-2 py-0.5 rounded-full border border-[#B0DCDA]">
                      Standard
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={fiscalYearStartMonth}
                      onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Starts {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-200/60">
                <p className="text-[11px] text-gray-400 font-medium">
                  {yearType === 'CALENDAR'
                    ? 'Fixed Jan 1 – Dec 31 calendar year.'
                    : `Fiscal year starts ${new Date(0, fiscalYearStartMonth - 1).toLocaleString('en-US', { month: 'long' })} 1.`}
                </p>
                {(yearType !== originalYearType || (yearType === 'FISCAL' && fiscalYearStartMonth !== originalFiscalYearStartMonth)) && (
                  <button
                    onClick={() => handleSaveYearType(yearType, fiscalYearStartMonth)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                    title="Apply year cycle"
                  >
                    <Save size={13} /> Save
                  </button>
                )}
              </div>
            </div>

            {/* 2. Automated Period Closing (Togglable: Monthly vs Annual) */}
            <div className="bg-gray-50/70 border border-gray-200/80 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarClock size={13} className="text-[#1B9387]" />
                    Automate Closing
                  </label>
                  {/* ON / OFF Toggle Pill */}
                  <button
                    type="button"
                    onClick={() => setAutoCloseEnabled(!autoCloseEnabled)}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border transition cursor-pointer ${
                      autoCloseEnabled
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-gray-200 text-gray-600 border-gray-300'
                    }`}
                  >
                    {autoCloseEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {autoCloseEnabled ? (
                  <div className="space-y-2">
                    {/* Frequency: Every Month vs One Year */}
                    <div className="grid grid-cols-2 gap-1.5 bg-gray-200/80 p-0.5 rounded-lg border border-gray-300">
                      <button
                        type="button"
                        onClick={() => setAutoCloseFrequency('MONTHLY')}
                        className={`py-1 text-[10px] font-extrabold rounded-md transition cursor-pointer text-center ${
                          autoCloseFrequency === 'MONTHLY'
                            ? 'bg-[#1B9387] text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Every Month
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoCloseFrequency('YEARLY')}
                        className={`py-1 text-[10px] font-extrabold rounded-md transition cursor-pointer text-center ${
                          autoCloseFrequency === 'YEARLY'
                            ? 'bg-[#1B9387] text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        One Year
                      </button>
                    </div>

                    {/* Grace Period Selection */}
                    <select
                      value={autoLockDay || (autoCloseFrequency === 'MONTHLY' ? 5 : 5)}
                      onChange={(e) => setAutoLockDay(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm cursor-pointer"
                    >
                      {autoCloseFrequency === 'MONTHLY' ? (
                        <>
                          <option value={1}>Lock on 1st of next month (Immediate)</option>
                          <option value={3}>Lock on 3rd (3 days grace period)</option>
                          <option value={5}>Lock on 5th (5 days grace period)</option>
                          <option value={7}>Lock on 7th (7 days grace period)</option>
                          <option value={10}>Lock on 10th (10 days grace period)</option>
                          <option value={15}>Lock on 15th (15 days grace period)</option>
                        </>
                      ) : (
                        <>
                          <option value={1}>Immediately upon year end</option>
                          <option value={5}>5 days after year end</option>
                          <option value={10}>10 days after year end</option>
                          <option value={15}>15 days after year end</option>
                          <option value={30}>30 days after year end</option>
                        </>
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-300 rounded-lg p-2.5 text-xs font-medium text-gray-500 shadow-sm italic">
                    Disabled (Manual Close Only)
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-200/60">
                <p className="text-[11px] text-gray-400 font-medium">
                  {!autoCloseEnabled
                    ? 'Periods are closed and locked manually.'
                    : autoCloseFrequency === 'MONTHLY'
                    ? 'Locks prior month automatically.'
                    : 'Locks prior year automatically.'}
                </p>
                {(autoCloseEnabled !== originalAutoCloseEnabled ||
                  autoCloseFrequency !== originalAutoCloseFrequency ||
                  (autoCloseEnabled && autoLockDay !== originalAutoLockDay)) && (
                  <button
                    onClick={handleSaveAutoClose}
                    disabled={loading}
                    className="px-3 py-1.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                    title="Save automated closing settings"
                  >
                    <Save size={13} /> Save
                  </button>
                )}
              </div>
            </div>

            {/* 3. Manager Override PIN */}
            <div className="bg-gray-50/70 border border-gray-200/80 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={13} className="text-[#1B9387]" />
                  Manager Override PIN
                </label>
                {hasExistingPin && (
                  <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                    PIN Active
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={overridePin}
                  onChange={(e) => setOverridePin(e.target.value)}
                  placeholder={hasExistingPin ? '•••• (Set new PIN)' : 'Enter 4 to 6 digit PIN'}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm"
                />
                {overridePin.trim().length > 0 && (
                  <button
                    onClick={handleSavePin}
                    disabled={loading}
                    className="px-3.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                    title="Save PIN"
                  >
                    <Save size={15} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">
                Required to reopen closed periods or override locks.
              </p>
            </div>
          </div>
        </div>

        {/* 12-Month Period Cards Grid */}
        <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-extrabold text-gray-800">Accounting Periods (FY {year})</h3>
            <span className="text-xs text-gray-400 font-bold">12 Periods</span>
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
        </div>

        {/* Close Books Modal */}
        {closeModalPeriod && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-extrabold text-gray-900">
                  Close Books: {closeModalPeriod.periodName || closeModalPeriod.name}
                </h3>
                {closeModalPeriod.periodNumber === 12 && (
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-full border border-blue-200">
                    Annual Fiscal Close
                  </span>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-xs font-bold mb-4 flex gap-2">
                <AlertTriangle size={18} className="shrink-0 text-yellow-600" />
                <p>
                  Closing will route all nominal accounts through clearing account <strong>3999 (Income Summary)</strong>,
                  transfer net earnings to <strong>3010 (Owner&apos;s Capital)</strong>, and lock this period against modifications.
                  {closeModalPeriod.periodNumber === 12 && ' Includes annual reset of 3020 (Owner&apos;s Drawings) into Capital.'}
                </p>
              </div>

              {/* PRE-CLOSING COMPLIANCE CHECKLIST */}
              {validatingPreClose && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 italic mb-4 animate-pulse">
                  Running pre-closing compliance checks (Bank Reconciliation &amp; Ledger Balance)...
                </div>
              )}

              {!validatingPreClose && preCloseValidation && (
                <div className="mb-4 space-y-2">
                  {preCloseValidation.errors?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-bold">
                      <p className="font-extrabold uppercase mb-1">⛔ Pre-Close Blockers Found:</p>
                      <ul className="list-disc list-inside space-y-0.5 font-normal">
                        {preCloseValidation.errors.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preCloseValidation.warnings?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs">
                      <p className="font-extrabold uppercase mb-1">⚠️ Pre-Close Warnings:</p>
                      <ul className="list-disc list-inside space-y-0.5 font-medium mb-2">
                        {preCloseValidation.warnings.map((warn: string, idx: number) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                      <label className="flex items-center gap-2 pt-1 border-t border-amber-200 font-bold cursor-pointer text-amber-900">
                        <input
                          type="checkbox"
                          checked={forceUnmatchedBank}
                          onChange={(e) => setForceUnmatchedBank(e.target.checked)}
                          className="rounded border-amber-400 text-[#1B9387] focus:ring-0"
                        />
                        <span>Override unmatched bank transactions and proceed with closing</span>
                      </label>
                    </div>
                  )}

                  {preCloseValidation.canClose && (!preCloseValidation.warnings || preCloseValidation.warnings.length === 0) && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <span>✓</span> Pre-close compliance checks passed: Bank reconciled &amp; General Ledger balanced.
                    </div>
                  )}
                </div>
              )}
              
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
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Clearing Account</span>
                  <span className="font-mono">3999 Income Summary</span>
                </div>
                <div className="flex justify-between text-base font-extrabold mt-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-800">Net Transfer to 3010 Capital</span>
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
                  disabled={
                    validatingPreClose ||
                    (preCloseValidation &&
                      (!preCloseValidation.canClose ||
                        (preCloseValidation.unmatchedBankCount > 0 && !forceUnmatchedBank)))
                  }
                  className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] !text-white rounded-md text-sm font-bold uppercase flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}
