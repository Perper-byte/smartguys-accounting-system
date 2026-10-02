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
import {
  getPhilHealthConfig,
  savePhilHealthConfig,
  getPagIbigConfig,
  savePagIbigConfig,
  PhilHealthConfig,
  PagIbigConfig,
  WithholdingTaxBracket,
  getWithholdingTaxBrackets,
  saveWithholdingTaxBrackets,
  resetWithholdingTaxBrackets,
  DEFAULT_SEMI_MONTHLY_TAX_BRACKETS,
  calculateTRAINWithholdingTax,
  formatTaxBracketDescription,
  formatTaxBracketRangeLabel,
  StatutoryEnabledConfig,
  getStatutoryEnabledConfig,
  saveStatutoryEnabledConfig
} from '../../utils/statutory-rates'
import { SSSBracketTableModal } from './SSSBracketTableModal'
import { Check, CheckSquare, Square, RotateCcw, Sparkles, Sliders, Shield, Table, HelpCircle, Calculator, Percent, ToggleLeft, ToggleRight, Power } from 'lucide-react'

export function PayrollSettingsTab() {
  const [activeTab, setActiveTab] = useState<'dole' | 'statutory'>('dole')
  const [activeKeys, setActiveKeys] = useState<string[]>(getActiveDoleRateKeys())
  const [multipliers, setMultipliers] = useState<Record<string, number>>(getDoleMultipliers())
  const [philhealthConfig, setPhilhealthConfig] = useState<PhilHealthConfig>(getPhilHealthConfig())
  const [pagibigConfig, setPagibigConfig] = useState<PagIbigConfig>(getPagIbigConfig())
  const [statutoryEnabled, setStatutoryEnabled] = useState<StatutoryEnabledConfig>(getStatutoryEnabledConfig())
  const [monthlyTaxBrackets, setMonthlyTaxBrackets] = useState<WithholdingTaxBracket[]>(
    getWithholdingTaxBrackets('MONTHLY')
  )
  const [semiMonthlyTaxBrackets, setSemiMonthlyTaxBrackets] = useState<WithholdingTaxBracket[]>(
    getWithholdingTaxBrackets('SEMI_MONTHLY')
  )
  const [taxPeriodMode, setTaxPeriodMode] = useState<'MONTHLY' | 'SEMI_MONTHLY'>('MONTHLY')
  const [taxTestIncome, setTaxTestIncome] = useState<number>(25000)
  const [showSSSModal, setShowSSSModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const toggleStatutory = (key: keyof StatutoryEnabledConfig) => {
    setStatutoryEnabled((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const activeTaxBrackets = taxPeriodMode === 'MONTHLY' ? monthlyTaxBrackets : semiMonthlyTaxBrackets

  const handleUpdateBracketField = (
    id: number,
    field: 'minIncome' | 'maxIncome' | 'ratePercentage' | 'baseTax' | 'excessOver',
    val: number | null
  ) => {
    const updateList = (prev: WithholdingTaxBracket[]) =>
      prev.map((b) => {
        if (b.id !== id) return b
        const updated = { ...b, [field]: val }

        if (field === 'ratePercentage') {
          updated.rate = (val || 0) / 100
        }

        // Auto-recalculate range label if income floors/ceilings change
        if (field === 'minIncome' || field === 'maxIncome') {
          updated.rangeLabel = formatTaxBracketRangeLabel(updated.minIncome, updated.maxIncome)
        }

        // Auto-recalculate formula description
        updated.description = formatTaxBracketDescription(
          updated.baseTax,
          updated.ratePercentage,
          updated.excessOver
        )

        return updated
      })

    if (taxPeriodMode === 'MONTHLY') {
      setMonthlyTaxBrackets(updateList)
    } else {
      setSemiMonthlyTaxBrackets(updateList)
    }
  }

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

      // 3. Save statutory rates configs
      saveStatutoryEnabledConfig(statutoryEnabled)
      savePhilHealthConfig(philhealthConfig)
      savePagIbigConfig(pagibigConfig)
      saveWithholdingTaxBrackets(monthlyTaxBrackets, 'MONTHLY')
      saveWithholdingTaxBrackets(semiMonthlyTaxBrackets, 'SEMI_MONTHLY')

      // 4. Attempt DB persistence in background
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
        msg: `Settings saved successfully! Rates and configurations updated for all payroll computations.`
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
        {/* TOP LEVEL NAVIGATION TABS */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('dole')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-black rounded-lg transition cursor-pointer ${
              activeTab === 'dole'
                ? 'bg-[#1B9387] text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Sliders size={16} />
            <span>DOLE Overtime Multipliers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('statutory')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-black rounded-lg transition cursor-pointer ${
              activeTab === 'statutory'
                ? 'bg-[#1B9387] text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Shield size={16} />
            <span>2026 Statutory Rates (SSS / PhilHealth / Pag-IBIG)</span>
          </button>
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

        {/* TAB 1: DOLE OVERTIME MULTIPLIERS */}
        {activeTab === 'dole' && (
          <>
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

          </>
        )}

        {/* TAB 2: 2026 STATUTORY CONTRIBUTION RATES */}
        {activeTab === 'statutory' && (
          <div className="space-y-6">
            {/* SSS 2026 CONTRIBUTION CARD */}
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-blue-900 tracking-wide uppercase">
                      SSS Contribution Matrix (Employee Share Focus)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
                      5.0% Employee Rate
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Employee share deducted from compensation. Covers regular Social Security (5%) and Mandatory Provident Fund / WISP (5% above ₱20,250 MSC).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStatutory('sss')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border shadow-xs ${
                      statutoryEnabled.sss
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-300'
                    }`}
                  >
                    <Power className={`w-3.5 h-3.5 ${statutoryEnabled.sss ? 'text-white' : 'text-gray-400'}`} />
                    <span>{statutoryEnabled.sss ? 'SSS Active' : 'SSS Disabled'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSSSModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Table size={14} />
                    <span>Open & Edit 61-Bracket Matrix Modal</span>
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-blue-50/20">
                <div className="p-4 bg-white rounded-lg border border-blue-100 shadow-xs">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Regular Social Security (EE Max)
                  </span>
                  <div className="text-xl font-black text-gray-800 mt-1">
                    ₱1,000.00
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    5% of Regular MSC cap (₱5,000 to ₱20,000 MSC).
                  </p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-blue-100 shadow-xs">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Mandatory Prov. Fund (MPF / WISP EE Max)
                  </span>
                  <div className="text-xl font-black text-gray-800 mt-1">
                    ₱750.00
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    5% on salary credit above ₱20,250 up to ₱35,000 MSC.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-blue-100 shadow-xs">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Total Maximum EE SSS Deduction
                  </span>
                  <div className="text-xl font-black text-blue-800 mt-1">
                    ₱1,750.00 / month
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Maximum possible employee monthly SSS deduction.
                  </p>
                </div>
              </div>
            </div>

            {/* PHILHEALTH & PAG-IBIG CONFIG GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PHILHEALTH 2026 */}
              <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-emerald-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-900 tracking-wide uppercase">
                          PhilHealth Rates (2026)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                          {philhealthConfig.rate}% Premium
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Split equally 50/50 ({philhealthConfig.employeeSharePercentage}% EE / {philhealthConfig.employerSharePercentage}% ER).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStatutory('philhealth')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border shadow-xs ${
                        statutoryEnabled.philhealth
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-300'
                      }`}
                    >
                      <Power className={`w-3.5 h-3.5 ${statutoryEnabled.philhealth ? 'text-white' : 'text-gray-400'}`} />
                      <span>{statutoryEnabled.philhealth ? 'Active' : 'Disabled'}</span>
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                        Total Contribution Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={philhealthConfig.rate}
                        onChange={(e) =>
                          setPhilhealthConfig({
                            ...philhealthConfig,
                            rate: parseFloat(e.target.value) || 0
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none"
                      />
                      <span className="text-[11px] text-gray-400 mt-0.5 block">
                        Official 2026 statutory rate is 5.0%.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                          Salary Floor (₱)
                        </label>
                        <input
                          type="number"
                          step="500"
                          min="0"
                          value={philhealthConfig.minSalary}
                          onChange={(e) =>
                            setPhilhealthConfig({
                              ...philhealthConfig,
                              minSalary: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none"
                        />
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Min Monthly: ₱{(philhealthConfig.minSalary * (philhealthConfig.rate / 100)).toFixed(2)} (₱{(philhealthConfig.minSalary * (philhealthConfig.rate / 100) / 2).toFixed(2)} EE)
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                          Salary Ceiling (₱)
                        </label>
                        <input
                          type="number"
                          step="5000"
                          min="0"
                          value={philhealthConfig.maxSalary}
                          onChange={(e) =>
                            setPhilhealthConfig({
                              ...philhealthConfig,
                              maxSalary: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none"
                        />
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Max Monthly: ₱{(philhealthConfig.maxSalary * (philhealthConfig.rate / 100)).toFixed(2)} (₱{(philhealthConfig.maxSalary * (philhealthConfig.rate / 100) / 2).toFixed(2)} EE)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50/50 px-6 py-3 border-t border-emerald-100 text-[11px] text-emerald-800 font-medium">
                  💡 Computations follow DOLE &amp; PhilHealth Circular No. 2020-0005 guidelines.
                </div>
              </div>

              {/* PAG-IBIG (HDMF) 2026 */}
              <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-900 tracking-wide uppercase">
                          Pag-IBIG / HDMF Rates (EE &amp; ER Share)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                          {pagibigConfig.employeeRateAbove1500}% EE / {pagibigConfig.employerRate ?? 2.0}% ER
                        </span>
                      </div>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Maximum Fund Salary (MFS) capped at ₱{(pagibigConfig?.maxMonthlyCompensation ?? 10000).toLocaleString()} (₱{pagibigConfig?.maxContribution ?? 200} max EE / ₱{pagibigConfig?.maxContribution ?? 200} max ER).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStatutory('pagibig')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border shadow-xs ${
                        statutoryEnabled.pagibig
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-300'
                      }`}
                    >
                      <Power className={`w-3.5 h-3.5 ${statutoryEnabled.pagibig ? 'text-white' : 'text-gray-400'}`} />
                      <span>{statutoryEnabled.pagibig ? 'Active' : 'Disabled'}</span>
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                          EE Rate (&le; ₱1,500)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={pagibigConfig.employeeRateBelow1500}
                            onChange={(e) =>
                              setPagibigConfig({
                                ...pagibigConfig,
                                employeeRateBelow1500: parseFloat(e.target.value) || 0
                              })
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none pr-8"
                          />
                          <span className="absolute right-3 top-3 text-gray-400 font-bold text-xs">%</span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">1.0% standard</span>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                          EE Rate (&gt; ₱1,500)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={pagibigConfig.employeeRateAbove1500}
                            onChange={(e) =>
                              setPagibigConfig({
                                ...pagibigConfig,
                                employeeRateAbove1500: parseFloat(e.target.value) || 0
                              })
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none pr-8"
                          />
                          <span className="absolute right-3 top-3 text-gray-400 font-bold text-xs">%</span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">2.0% standard</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                          Employer (ER) Rate (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={pagibigConfig.employerRate ?? 2.0}
                            onChange={(e) =>
                              setPagibigConfig({
                                ...pagibigConfig,
                                employerRate: parseFloat(e.target.value) || 0
                              })
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none pr-8"
                          />
                          <span className="absolute right-3 top-3 text-gray-400 font-bold text-xs">%</span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">2.0% standard</span>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                          Max Monthly EE / ER Cap (₱)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="10"
                            min="0"
                            value={pagibigConfig.maxContribution}
                            onChange={(e) =>
                              setPagibigConfig({
                                ...pagibigConfig,
                                maxContribution: parseFloat(e.target.value) || 0
                              })
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none"
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Standard ₱200.00 each for EE and ER.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/50 px-6 py-3 border-t border-amber-100 text-[11px] text-amber-800 font-medium">
                  💡 Reflects HDMF Circular No. 460 mandating ₱200 standard monthly contribution.
                </div>
              </div>
            </div>

            {/* BIR TRAIN LAW WITHHOLDING TAX CARD */}
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-blue-900 tracking-wide uppercase">
                      BIR Withholding Tax on Compensation (TRAIN Law)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
                      Effective Jan 1, 2023 – 2026+
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Official revised withholding tax table under Republic Act No. 10963.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStatutory('withholdingTax')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border shadow-xs ${
                      statutoryEnabled.withholdingTax
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-300'
                    }`}
                  >
                    <Power className={`w-3.5 h-3.5 ${statutoryEnabled.withholdingTax ? 'text-white' : 'text-gray-400'}`} />
                    <span>{statutoryEnabled.withholdingTax ? 'Tax Active' : 'Tax Disabled'}</span>
                  </button>

                  <div className="bg-white border border-blue-200 p-0.5 rounded-lg flex text-xs font-bold shadow-sm">
                    <button
                      type="button"
                      onClick={() => setTaxPeriodMode('MONTHLY')}
                      className={`px-3 py-1 rounded-md transition ${
                        taxPeriodMode === 'MONTHLY'
                          ? 'bg-[#1B9387] text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Monthly Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxPeriodMode('SEMI_MONTHLY')}
                      className={`px-3 py-1 rounded-md transition ${
                        taxPeriodMode === 'SEMI_MONTHLY'
                          ? 'bg-[#1B9387] text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Semi-Monthly Table
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const res = resetWithholdingTaxBrackets(taxPeriodMode)
                      if (taxPeriodMode === 'MONTHLY') setMonthlyTaxBrackets(res)
                      else setSemiMonthlyTaxBrackets(res)
                      setStatus({
                        type: 'success',
                        msg: `Reset ${taxPeriodMode.toLowerCase().replace('_', '-')} tax brackets to standard TRAIN law rates.`
                      })
                      setTimeout(() => setStatus(null), 3000)
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-bold transition shadow-sm cursor-pointer"
                    title="Reset to official TRAIN schedule"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* TABLE CONTAINER */}
              <div className="p-6">
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                    <thead>
                      <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-black uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[170px]">
                          Taxable Income Range ({taxPeriodMode === 'MONTHLY' ? 'Monthly' : 'Semi-Monthly'})
                        </th>
                        <th className="py-2.5 px-3 w-28 text-center">Tax Rate (%)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Base Tax (₱)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Excess Over (₱)</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Prescribed Formula (Auto)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-medium">
                      {activeTaxBrackets.map((bracket, index) => (
                        <tr
                          key={bracket.id}
                          className={index % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-gray-50/50 hover:bg-blue-50/20'}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-gray-500">
                            {index + 1}
                          </td>

                          {/* RANGE EDIT (MIN & MAX) */}
                          <td className="py-2 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-2 text-[10px] text-gray-400">₱</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={bracket.minIncome}
                                  onChange={(e) =>
                                    handleUpdateBracketField(
                                      bracket.id,
                                      'minIncome',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full pl-5 pr-1 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold font-mono focus:border-[#1B9387] outline-none"
                                />
                              </div>
                              <span className="text-gray-400 font-bold text-xs">–</span>
                              <div className="relative flex-1">
                                {bracket.maxIncome === null ? (
                                  <span className="text-xs font-bold text-gray-400 italic px-2 py-1.5 inline-block">
                                    No Upper Cap
                                  </span>
                                ) : (
                                  <>
                                    <span className="absolute left-2 top-2 text-[10px] text-gray-400">₱</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="100"
                                      value={bracket.maxIncome}
                                      onChange={(e) =>
                                        handleUpdateBracketField(
                                          bracket.id,
                                          'maxIncome',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full pl-5 pr-1 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold font-mono focus:border-[#1B9387] outline-none"
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* RATE (%) */}
                          <td className="py-2 px-3 text-center">
                            <div className="relative inline-block w-20">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={bracket.ratePercentage}
                                onChange={(e) =>
                                  handleUpdateBracketField(
                                    bracket.id,
                                    'ratePercentage',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className={`w-full py-1.5 pr-6 text-center border rounded text-xs font-bold font-mono outline-none focus:border-[#1B9387] ${
                                  bracket.ratePercentage === 0
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-gray-400 font-bold">
                                %
                              </span>
                            </div>
                          </td>

                          {/* BASE TAX (₱) */}
                          <td className="py-2 px-3 text-right">
                            <div className="relative w-24 ml-auto">
                              <span className="absolute left-2 top-2 text-[10px] text-gray-400">₱</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={bracket.baseTax}
                                onChange={(e) =>
                                  handleUpdateBracketField(
                                    bracket.id,
                                    'baseTax',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full pl-5 pr-2 py-1.5 text-right bg-white border border-gray-300 rounded text-xs font-bold font-mono focus:border-[#1B9387] outline-none"
                              />
                            </div>
                          </td>

                          {/* EXCESS OVER FLOOR (₱) */}
                          <td className="py-2 px-3 text-right">
                            <div className="relative w-28 ml-auto">
                              <span className="absolute left-2 top-2 text-[10px] text-gray-400">₱</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={bracket.excessOver}
                                onChange={(e) =>
                                  handleUpdateBracketField(
                                    bracket.id,
                                    'excessOver',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full pl-5 pr-2 py-1.5 text-right bg-white border border-gray-300 rounded text-xs font-bold font-mono focus:border-[#1B9387] outline-none"
                              />
                            </div>
                          </td>

                          {/* AUTO-COMPUTED DESCRIPTION */}
                          <td className="py-2.5 px-3 text-gray-700 font-mono text-[11px] font-bold">
                            <div className="bg-gray-100/70 px-2.5 py-1.5 rounded border border-gray-200 text-gray-800 truncate" title={bracket.description}>
                              {bracket.description}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* INTERACTIVE TAX CALCULATOR PREVIEW */}
                <div className="mt-5 bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                      <Calculator size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-blue-900 uppercase tracking-wide">
                        Live Tax Computation Preview
                      </p>
                      <p className="text-[11px] text-blue-700">
                        Test taxable net income (after SSS, PhilHealth, Pag-IBIG deduction):
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 font-bold text-xs">₱</span>
                      <input
                        type="number"
                        step="500"
                        min="0"
                        value={taxTestIncome}
                        onChange={(e) => setTaxTestIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="pl-7 pr-3 py-1.5 w-36 bg-white border border-gray-300 rounded-md text-xs font-extrabold text-gray-800 focus:border-[#1B9387] outline-none font-mono"
                        placeholder="25,000"
                      />
                    </div>
                    {(() => {
                      const res = calculateTRAINWithholdingTax(
                        taxTestIncome,
                        taxPeriodMode,
                        activeTaxBrackets
                      )
                      return (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-blue-200 rounded-md shadow-xs">
                          <span className="text-[11px] font-bold text-gray-500 uppercase">Withholding Tax:</span>
                          <span className="text-xs font-black text-[#1B9387] font-mono">
                            ₱{res.totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-[11px] text-gray-500 font-medium">
                💡 Minimum wage earners and employees earning ₱250,000 or below annually (₱20,833/month) are completely tax-exempt.
              </div>
            </div>
          </div>
        )}

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
            <span>{loading ? 'Saving Settings...' : 'Save & Apply All Rates'}</span>
          </button>
        </div>
      </div>

      {/* SSS 61-BRACKET MODAL */}
      <SSSBracketTableModal
        isOpen={showSSSModal}
        onClose={() => setShowSSSModal(false)}
      />
    </div>
  )
}
