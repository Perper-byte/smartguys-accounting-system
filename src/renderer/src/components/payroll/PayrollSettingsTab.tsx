import React, { useState, useEffect } from 'react'

const DOLE_DEFAULTS = {
  regular_ot: 1.25,
  regular_night: 1.1,
  regular_night_ot: 1.375,
  rest_day: 1.3,
  rest_day_ot: 1.69,
  rest_day_night: 1.43,
  rest_day_night_ot: 1.859,
  special_holiday: 1.3,
  special_holiday_ot: 1.69,
  special_holiday_night: 1.43,
  special_holiday_night_ot: 1.859,
  special_holiday_rest_day: 1.5,
  special_holiday_rest_day_ot: 1.95,
  special_holiday_rest_day_night: 1.65,
  special_holiday_rest_day_night_ot: 2.145,
  legal_holiday: 2.0
}

const LABELS = {
  regular_ot: 'Regular Overtime',
  regular_night: 'Regular Night Differential',
  regular_night_ot: 'Regular Night OT',
  rest_day: 'Rest Day',
  rest_day_ot: 'Rest Day OT',
  rest_day_night: 'Rest Day Night Diff',
  rest_day_night_ot: 'Rest Day Night OT',
  special_holiday: 'Special Holiday',
  special_holiday_ot: 'Special Holiday OT',
  special_holiday_night: 'Special Holiday Night Diff',
  special_holiday_night_ot: 'Special Holiday Night OT',
  special_holiday_rest_day: 'Special Holiday Rest Day',
  special_holiday_rest_day_ot: 'Special Holiday Rest Day OT',
  special_holiday_rest_day_night: 'Special Holiday Rest Day Night Diff',
  special_holiday_rest_day_night_ot: 'Special Holiday Rest Day Night OT',
  legal_holiday: 'Legal Holiday'
}

export function PayrollSettingsTab() {
  const [settings, setSettings] = useState<Record<string, number>>(DOLE_DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api.getPayrollSettings) {
        const data = await api.getPayrollSettings()
        if (data && Object.keys(data).length > 0) {
          setSettings(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings', error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api.updatePayrollSettings) {
        const response = await api.updatePayrollSettings(settings)
        if (response.success) {
          setStatus({ type: 'success', msg: 'DOLE rates updated successfully.' })
        } else {
          setStatus({ type: 'error', msg: 'Failed to update settings.' })
        }
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'System error.' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      setSettings((prev) => ({ ...prev, [key]: num }))
    } else if (value === '') {
      setSettings((prev) => ({ ...prev, [key]: 0 }))
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto print:hidden p-8">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">DOLE Rate Multipliers</h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">Configure overtime and holiday pay multipliers based on standard labor rules.</p>
        </div>

        {status && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold border shadow-sm ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
            {status.type === 'success' ? '✅ ' : '⚠️ '} {status.msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#FBF8F8] p-6 rounded-xl border border-[#B0DCDA]">
          {Object.entries(LABELS).map(([key, label]) => {
            const currentValue = settings[key] || 0
            const defaultValue = DOLE_DEFAULTS[key as keyof typeof DOLE_DEFAULTS]
            const isDifferent = currentValue !== defaultValue

            return (
              <div key={key} className="flex flex-col">
                <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                  <span>{label}</span>
                  {isDifferent && (
                    <span className="text-orange-500 text-[10px] uppercase tracking-wider" title={`Standard: ${defaultValue}`}>Deviates (Standard: {defaultValue})</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings[key] === 0 ? '' : settings[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className={`w-full bg-white border ${isDifferent ? 'border-orange-300 focus:border-orange-500 ring-orange-50' : 'border-[#B0DCDA] focus:border-[#1B9387] ring-[#E9FAFA]'} rounded-md p-2.5 text-sm font-mono focus:ring-2 outline-none transition shadow-sm`}
                    placeholder={defaultValue.toString()}
                  />
                  <div className="absolute right-3 top-2.5 text-gray-400 font-mono text-sm pointer-events-none">x</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-3 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-bold transition shadow-md tracking-wide uppercase text-sm flex items-center gap-2"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
