import React, { useState, useEffect } from 'react'
import {
  ALL_DOLE_RATES,
  CLINIC_STANDARD_RATES,
  ALL_RATE_KEYS,
  getActiveDoleRateKeys,
  saveActiveDoleRateKeys,
  getDoleMultipliers,
  saveDoleMultipliers
} from '../../utils/dole-rates'
import { Check, CheckSquare, Square, RotateCcw, Sparkles } from 'lucide-react'

export function PayrollSettingsTab() {
  const [activeKeys, setActiveKeys] = useState<string[]>(getActiveDoleRateKeys())
  const [multipliers, setMultipliers] = useState<Record<string, number>>(getDoleMultipliers())
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api?.getPayrollSettings) {
        const data = await api.getPayrollSettings()
        if (data && Object.keys(data).length > 0) {
          // Merge any remote settings if they match
          setMultipliers((prev) => ({ ...prev, ...data }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings from backend', error)
    }
  }

  const handleToggleKey = (key: string) => {
    setActiveKeys((prev) => {
      if (prev.includes(key)) {
        if (key === 'reg') return prev // Keep REG base enabled
        return prev.filter((k) => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  const handleMultiplierChange = (key: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      setMultipliers((prev) => ({ ...prev, [key]: num }))
    } else if (value === '') {
      setMultipliers((prev) => ({ ...prev, [key]: 0 }))
    }
  }

  const applyPreset = (preset: 'standard' | 'all' | 'basic') => {
    if (preset === 'standard') {
      setActiveKeys(CLINIC_STANDARD_RATES)
      setStatus({ type: 'success', msg: 'Loaded "Clinic Standard" preset.' })
    } else if (preset === 'all') {
      setActiveKeys(ALL_RATE_KEYS)
      setStatus({ type: 'success', msg: 'Selected all 16 DOLE rates.' })
    } else if (preset === 'basic') {
      setActiveKeys(['reg', 'ot'])
      setStatus({ type: 'success', msg: 'Selected Basic (Regular + OT) only.' })
    }
    setTimeout(() => setStatus(null), 3000)
  }

  const handleSave = async () => {
    setLoading(true)
    setStatus(null)
    try {
      // 1. Save active rate keys to localStorage and emit event
      saveActiveDoleRateKeys(activeKeys)

      // 2. Save multipliers to localStorage and emit event
      saveDoleMultipliers(multipliers)

      // 3. Attempt DB persistence in background
      const api = (window as any).api || (window as any).electronAPI
      if (api?.updatePayrollSettings) {
        try {
          await api.updatePayrollSettings(multipliers)
        } catch (dbErr) {
          console.warn('Backend updatePayrollSettings notice:', dbErr)
        }
      }

      setStatus({
        type: 'success',
        msg: `DOLE settings updated! ${activeKeys.length} active rate(s) will be visible in the Payroll Grid and Excel exports.`
      })
    } catch (error) {
      setStatus({ type: 'error', msg: 'Failed to save settings.' })
    } finally {
      setLoading(false)
    }
  }

  // Group the rates for clean visual hierarchy
  const groups: { id: string; label: string; bg: string }[] = [
    { id: 'REGULAR', label: 'Regular Day Rates', bg: 'border-blue-200' },
    { id: 'SUNDAY', label: 'Sunday / Rest Day Rates', bg: 'border-purple-200' },
    { id: 'LEGAL', label: 'Legal Holiday Rates (200%)', bg: 'border-emerald-200' },
    { id: 'SPECIAL', label: 'Special Holiday Rates (130%)', bg: 'border-amber-200' }
  ]

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto print:hidden p-8">
      <div className="max-w-5xl mx-auto w-full">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">
              DOLE Rates & Payroll Multipliers
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Configure which overtime & holiday rates are applicable to your clinic. Unchecked
              rates will be hidden from the Payroll Grid and Excel sheets.
            </p>
          </div>

          {/* QUICK PRESETS */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('standard')}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#E9FAFA] hover:bg-[#d6f4f2] text-[#1B9387] border border-[#B0DCDA] rounded-md text-xs font-black transition cursor-pointer"
              title="Apply Clinic Standard (REG, OT, ND, ND OT, Rest Day, Holidays)"
            >
              <Sparkles size={12} />
              <span>Clinic Standard</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md text-xs font-bold transition cursor-pointer"
            >
              <CheckSquare size={12} />
              <span>Select All</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('basic')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md text-xs font-bold transition cursor-pointer"
            >
              <Square size={12} />
              <span>Basic Only</span>
            </button>
          </div>
        </div>

        {status && (
          <div
            className={`mb-6 p-4 rounded-md text-sm font-bold border shadow-sm animate-in fade-in ${
              status.type === 'success'
                ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]'
                : 'bg-red-50 text-red-500 border-red-200'
            }`}
          >
            {status.type === 'success' ? '✅ ' : '⚠️ '} {status.msg}
          </div>
        )}

        {/* ACTIVE RATES COUNTER BANNER */}
        <div className="mb-6 px-4 py-3 bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl flex items-center justify-between text-xs font-medium text-gray-600">
          <div>
            Showing <strong className="text-[#1B9387] font-black">{activeKeys.length}</strong> of{' '}
            <strong>{ALL_DOLE_RATES.length}</strong> DOLE rate categories on the Payroll Grid.
          </div>
          <div className="text-[11px] text-gray-400">
            Check the boxes below to include or exclude specific rate columns.
          </div>
        </div>

        {/* RATE GROUPS */}
        <div className="space-y-6">
          {groups.map((group) => {
            const groupRates = ALL_DOLE_RATES.filter((r) => r.group === group.id)
            const activeInGroup = groupRates.filter((r) => activeKeys.includes(r.key)).length

            return (
              <div
                key={group.id}
                className={`bg-white rounded-xl border ${group.bg} shadow-sm overflow-hidden`}
              >
                {/* GROUP TITLE BAR */}
                <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-gray-800 tracking-wide">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                      {activeInGroup} / {groupRates.length} active
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const keysInGroup = groupRates.map((r) => r.key)
                      const allActive = keysInGroup.every((k) => activeKeys.includes(k))
                      if (allActive) {
                        // Deactivate group (except 'reg')
                        setActiveKeys((prev) =>
                          prev.filter((k) => !keysInGroup.includes(k) || k === 'reg')
                        )
                      } else {
                        // Activate all in group
                        setActiveKeys((prev) => Array.from(new Set([...prev, ...keysInGroup])))
                      }
                    }}
                    className="text-xs font-bold text-[#1B9387] hover:underline cursor-pointer"
                  >
                    {activeInGroup === groupRates.length ? 'Deselect Group' : 'Select All in Group'}
                  </button>
                </div>

                {/* RATE ITEMS GRID */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupRates.map((rate) => {
                    const isActive = activeKeys.includes(rate.key)
                    const currentValue = multipliers[rate.key] ?? rate.defaultMultiplier
                    const isDifferent = currentValue !== rate.defaultMultiplier

                    return (
                      <div
                        key={rate.key}
                        onClick={() => handleToggleKey(rate.key)}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                          isActive
                            ? 'bg-white border-[#1B9387]/40 ring-1 ring-[#1B9387]/20 shadow-sm'
                            : 'bg-gray-50/60 border-gray-200 opacity-60 hover:opacity-85'
                        }`}
                      >
                        {/* TOGGLE CHECKBOX & INFO */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isActive}
                            disabled={rate.key === 'reg'}
                            onChange={() => handleToggleKey(rate.key)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1B9387] focus:ring-[#1B9387] cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  isActive
                                    ? 'bg-[#E9FAFA] text-[#1B9387]'
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                {rate.shortLabel}
                              </span>
                              <span
                                className={`text-xs font-bold truncate ${
                                  isActive ? 'text-gray-800' : 'text-gray-500'
                                }`}
                              >
                                {rate.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                              {rate.description}
                            </p>
                          </div>
                        </div>

                        {/* MULTIPLIER INPUT */}
                        <div
                          className="flex flex-col items-end shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative w-24">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              disabled={!isActive}
                              value={currentValue === 0 ? '' : currentValue}
                              onChange={(e) => handleMultiplierChange(rate.key, e.target.value)}
                              className={`w-full bg-white border text-right pr-6 py-1 px-2 text-xs font-mono font-bold rounded outline-none transition ${
                                isDifferent
                                  ? 'border-orange-300 focus:border-orange-500'
                                  : 'border-gray-300 focus:border-[#1B9387]'
                              } disabled:bg-gray-100 disabled:text-gray-400`}
                              placeholder={rate.defaultMultiplier.toString()}
                            />
                            <span className="absolute right-2 top-1 text-gray-400 font-mono text-xs pointer-events-none">
                              x
                            </span>
                          </div>
                          {isDifferent && (
                            <span
                              className="text-[9px] text-orange-600 font-bold uppercase mt-0.5 tracking-tight"
                              title={`Standard DOLE: ${rate.defaultMultiplier}`}
                            >
                              Standard: {rate.defaultMultiplier}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* BOTTOM SAVE BAR */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Changes will take effect immediately across all active payroll sessions and exported
            files.
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-3 bg-[#1B9387] hover:bg-[#15796f] disabled:bg-gray-300 text-white rounded-lg font-black transition shadow-md tracking-wider uppercase text-xs flex items-center gap-2 cursor-pointer"
          >
            <Check size={16} />
            <span>{loading ? 'Saving Settings...' : 'Save & Apply DOLE Rates'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
