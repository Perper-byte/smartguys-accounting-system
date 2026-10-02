// src/renderer/src/components/payroll/DtrImportTab.tsx
import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { aggregateDtrRecords, DailyPunchLog } from '../../utils/dtr-classifier'
import {
  getDtrTemplateConfig,
  saveDtrTemplateConfig,
  downloadDtrTemplate,
  DtrTemplateConfig,
  DtrTemplateType,
  DEFAULT_DTR_CONFIG
} from '../../utils/dtr-template-generator'
import {
  Download,
  Settings,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  X,
  FileText
} from 'lucide-react'

export function DtrImportTab({
  employees,
  onApply
}: {
  employees: any[]
  onApply: (updates: any[]) => void
}) {
  const [templateConfig, setTemplateConfig] = useState<DtrTemplateConfig>(getDtrTemplateConfig())
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [tempConfig, setTempConfig] = useState<DtrTemplateConfig>(templateConfig)

  const [parsedData, setParsedData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [rawData, setRawData] = useState<any[] | null>(null)

  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail) {
        setTemplateConfig(e.detail)
        setTempConfig(e.detail)
      }
    }
    window.addEventListener('smartguys:dtr-config-updated', handleConfigUpdate)
    return () => window.removeEventListener('smartguys:dtr-config-updated', handleConfigUpdate)
  }, [])

  // Fuzzy column finder helper
  const getRowVal = (row: any, primaryKey: string, fallbacks: string[] = []): any => {
    if (row[primaryKey] !== undefined && row[primaryKey] !== null) return row[primaryKey]

    const allKeys = Object.keys(row)
    const normPrimary = primaryKey.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Check case-insensitive & trimmed match
    const exactMatch = allKeys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normPrimary)
    if (exactMatch && row[exactMatch] !== undefined) return row[exactMatch]

    // Check fallbacks
    for (const fb of fallbacks) {
      const normFb = fb.toLowerCase().replace(/[^a-z0-9]/g, '')
      const match = allKeys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normFb)
      if (match && row[match] !== undefined) return row[match]
    }

    return null
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError(null)
    setSuccessMsg(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        if (!data || data.length === 0) {
          setError('File appears to be empty or has no readable table data.')
          return
        }
        setRawData(data)
        processData(data, filterStartDate, filterEndDate)
      } catch (err: any) {
        setError('Failed to parse file: ' + (err?.message || 'Invalid format.'))
      }
    }
    reader.readAsBinaryString(file)
  }

  const processData = (data: any[], startFilter?: string, endFilter?: string) => {
    const mapping = templateConfig.columnMapping
    const firstRow = data[0] || {}
    const keys = Object.keys(firstRow).map((k) => k.toLowerCase())

    // Detect if the file is a Summary Hours table vs Daily Punch Log
    const isSummaryTable =
      templateConfig.templateType === 'SUMMARY_HOURS' ||
      keys.some((k) => k.includes('reg') && k.includes('hour')) ||
      (keys.some((k) => k.includes('regular')) && !keys.some((k) => k.includes('time in') || k.includes('clock in')))

    if (isSummaryTable) {
      // Process as pre-calculated summary hours table
      const results: any[] = []

      data.forEach((row) => {
        const name =
          getRowVal(row, mapping.employeeName, ['name', 'employee', 'staff', 'employee name']) || ''
        if (!name || String(name).trim() === '') return

        const matchedEmployee = employees.find(
          (e) =>
            `${e.first_name} ${e.last_name}`.toLowerCase() === String(name).trim().toLowerCase() ||
            String(name).toLowerCase().includes(e.first_name.toLowerCase()) ||
            (e.last_name && String(name).toLowerCase().includes(e.last_name.toLowerCase()))
        )

        const regHours = parseFloat(getRowVal(row, mapping.regHours, ['reg', 'regular', 'base_hours', 'reghours'])) || 0
        const otHours = parseFloat(getRowVal(row, mapping.otHours, ['ot', 'overtime', 'regular_ot', 'othours'])) || 0
        const ndHours = parseFloat(getRowVal(row, mapping.ndHours, ['nd', 'night diff', 'regular_night', 'ndhours'])) || 0
        const sunHours = parseFloat(getRowVal(row, mapping.sunHours, ['sun reg', 'sunday', 'rest day', 'restday'])) || 0
        const legHours = parseFloat(getRowVal(row, mapping.legHours, ['leg reg', 'legal', 'legal holiday'])) || 0
        const spclHours = parseFloat(getRowVal(row, mapping.spclHours, ['spcl reg', 'special', 'special holiday'])) || 0
        const lateMins = parseFloat(getRowVal(row, mapping.lateMinutes, ['late', 'lates', 'late_minutes'])) || 0
        const undertimeMins = parseFloat(getRowVal(row, mapping.undertimeMinutes, ['undertime', 'undertime_minutes'])) || 0
        const absentDays = parseFloat(getRowVal(row, mapping.absentDays, ['absent', 'absent days', 'absences'])) || 0

        results.push({
          originalName: String(name).trim(),
          matchedEmployee,
          mode: 'SUMMARY_HOURS',
          summary: {
            regHours,
            otHours,
            ndHours,
            sunHours,
            legHours,
            spclHours,
            lateMinutes: lateMins,
            undertimeMinutes: undertimeMins,
            absentDays
          }
        })
      })

      setParsedData(results)
      setSuccessMsg(`Successfully processed ${results.length} summary hour records.`)
      return
    }

    // Default: Process as Daily Punch Log
    const employeeLogs: Record<string, DailyPunchLog[]> = {}

    data.forEach((row) => {
      const name =
        getRowVal(row, mapping.employeeName, [
          'name',
          'employee',
          'staff',
          'employee name',
          'emp_name'
        ]) ||
        getRowVal(row, mapping.badgeId, ['badge id', 'id', 'emp id', 'badge', 'badgeno'])

      if (!name) return
      const cleanName = String(name).trim()

      const dateStr = getRowVal(row, mapping.date, ['date', 'punch date', 'punch_date', 'day'])
      const timeInStr = getRowVal(row, mapping.timeIn, ['time in', 'time_in', 'in', 'clock in', 'in time'])
      const timeOutStr = getRowVal(row, mapping.timeOut, ['time out', 'time_out', 'out', 'clock out', 'out time'])
      const shiftType = getRowVal(row, mapping.shiftType, ['shift', 'shift type', 'shifttype']) || 'REGULAR'

      const sDate = startFilter !== undefined ? startFilter : filterStartDate
      const eDate = endFilter !== undefined ? endFilter : filterEndDate

      const date = dateStr ? new Date(dateStr) : new Date()
      if (!isNaN(date.getTime())) {
        if (sDate && date < new Date(sDate + 'T00:00:00')) return
        if (eDate && date > new Date(eDate + 'T23:59:59')) return
      }

      let timeIn: Date | null = null
      let timeOut: Date | null = null

      if (timeInStr) {
        timeIn = new Date(`${dateStr || date.toISOString().split('T')[0]} ${timeInStr}`)
        if (isNaN(timeIn.getTime())) timeIn = null
      }
      if (timeOutStr) {
        timeOut = new Date(`${dateStr || date.toISOString().split('T')[0]} ${timeOutStr}`)
        if (isNaN(timeOut.getTime())) {
          timeOut = null
        } else if (timeIn && timeOut < timeIn) {
          timeOut.setDate(timeOut.getDate() + 1) // next day shift
        }
      }

      if (!employeeLogs[cleanName]) employeeLogs[cleanName] = []

      employeeLogs[cleanName].push({
        date,
        timeIn,
        timeOut,
        shiftType: shiftType as any
      })
    })

    const results: any[] = []

    Object.entries(employeeLogs).forEach(([name, logs]) => {
      // Fuzzy match employee
      const matchedEmployee = employees.find(
        (e) =>
          `${e.first_name} ${e.last_name}`.toLowerCase() === name.toLowerCase() ||
          name.toLowerCase().includes(e.first_name.toLowerCase()) ||
          (e.last_name && name.toLowerCase().includes(e.last_name.toLowerCase())) ||
          (e.employee_id && name.toLowerCase() === String(e.employee_id).toLowerCase())
      )

      const aggregated = aggregateDtrRecords(logs)

      results.push({
        originalName: name,
        matchedEmployee,
        mode: 'PUNCH_LOG',
        logs,
        aggregated
      })
    })

    setParsedData(results)
    setSuccessMsg(`Successfully processed ${results.length} employee time log groups from punch records.`)
  }

  const handleApply = () => {
    const updates = parsedData
      .filter((d) => d.matchedEmployee)
      .map((d) => {
        if (d.mode === 'SUMMARY_HOURS') {
          return {
            id: d.matchedEmployee.id,
            baseHours: d.summary.regHours,
            regHours: d.summary.regHours,
            otHours: d.summary.otHours,
            ndHours: d.summary.ndHours,
            sunHours: d.summary.sunHours,
            sunRegHours: d.summary.sunHours,
            legHours: d.summary.legHours,
            legRegHours: d.summary.legHours,
            spclHours: d.summary.spclHours,
            spclRegHours: d.summary.spclHours,
            absentDays: d.summary.absentDays,
            lateMinutes: d.summary.lateMinutes,
            undertimeMinutes: d.summary.undertimeMinutes
          }
        }

        // PUNCH_LOG mode
        return {
          id: d.matchedEmployee.id,
          baseHours: d.aggregated.totalBaseHours,
          regHours: d.aggregated.totalBaseHours,
          overtimeHours: d.aggregated.totalHours,
          otHours: d.aggregated.totalHours.regular_ot,
          ndHours: d.aggregated.totalHours.regular_night,
          ndOtHours: d.aggregated.totalHours.regular_night_ot,
          sunHours: d.aggregated.totalHours.rest_day,
          sunRegHours: d.aggregated.totalHours.rest_day,
          sunOtHours: d.aggregated.totalHours.rest_day_ot,
          sunNdHours: d.aggregated.totalHours.rest_day_night,
          sunNdOtHours: d.aggregated.totalHours.rest_day_night_ot,
          legHours: d.aggregated.totalHours.legal_holiday,
          legRegHours: d.aggregated.totalHours.legal_holiday,
          legOtHours: d.aggregated.totalHours.legal_holiday_ot,
          legNdHours: d.aggregated.totalHours.legal_holiday_night,
          legNdOtHours: d.aggregated.totalHours.legal_holiday_night_ot,
          spclHours: d.aggregated.totalHours.special_holiday,
          spclRegHours: d.aggregated.totalHours.special_holiday,
          spclOtHours: d.aggregated.totalHours.special_holiday_ot,
          spclNdHours: d.aggregated.totalHours.special_holiday_night,
          spclNdOtHours: d.aggregated.totalHours.special_holiday_night_ot,
          demerits: d.aggregated.totalDemerits,
          absentDays: d.aggregated.totalDemerits.absences_days
        }
      })

    onApply(updates)
  }

  const handleSaveModalSettings = () => {
    saveDtrTemplateConfig(tempConfig)
    setTemplateConfig(tempConfig)
    setShowConfigModal(false)
    setSuccessMsg('Template configuration updated! Re-import your file to apply.')
  }

  const handleResetModalSettings = () => {
    setTempConfig(DEFAULT_DTR_CONFIG)
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto print:hidden p-8">
      <div className="max-w-5xl mx-auto w-full">
        {/* HEADER & CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">
              DTR Attendance Import
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Upload Daily Time Records or biometric machine exports to auto-calculate payroll hours.
            </p>
          </div>

          {/* TEMPLATE ACTIONS */}
          <div className="flex items-center gap-3">
            {/* DOWNLOAD TEMPLATE BUTTONS */}
            <div className="flex items-center bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() =>
                  downloadDtrTemplate({
                    format: 'xlsx',
                    employees,
                    config: templateConfig
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-[#1B9387] hover:bg-white rounded transition cursor-pointer"
                title="Download spreadsheet pre-populated with active clinic staff"
              >
                <Download size={14} />
                <span>Download Template (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadDtrTemplate({
                    format: 'csv',
                    employees,
                    config: templateConfig
                  })
                }
                className="px-2.5 py-1.5 text-xs font-bold text-[#1B9387] hover:bg-white rounded transition cursor-pointer border-l border-[#B0DCDA]"
                title="Download CSV format"
              >
                .CSV
              </button>
            </div>

            {/* TEMPLATE SETTINGS BUTTON */}
            <button
              type="button"
              onClick={() => {
                setTempConfig(templateConfig)
                setShowConfigModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition shadow-sm border border-gray-300 cursor-pointer"
              title="Change DTR template type and customize column headers"
            >
              <Settings size={14} />
              <span>⚙️ Template Settings</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="opacity-50 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TEMPLATE INFO PILL */}
        <div className="mb-6 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs text-gray-600">
          <div>
            Active Template Format:{' '}
            <strong className="text-gray-900 font-bold uppercase tracking-wider">
              {templateConfig.templateType === 'SUMMARY_HOURS'
                ? 'Pre-Calculated Summary Hours'
                : templateConfig.templateType === 'RAW_BIOMETRIC'
                  ? 'Raw Biometric Machine Punch'
                  : 'Daily Punch Log (In / Out)'}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="text-xs text-[#1B9387] font-bold hover:underline cursor-pointer"
          >
            Customize Template Columns &rarr;
          </button>
        </div>

        {/* OPTIONAL CUTOFF DATE RANGE FILTER */}
        <div className="mb-4 p-4 bg-sky-50/60 border border-sky-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-gray-800">Cutoff Date Filter (Optional)</div>
            <p className="text-gray-500 text-[11px]">
              Filter out punches outside this pay period so past/future records do not inflate hours.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600 font-medium text-[11px]">From:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  const val = e.target.value
                  setFilterStartDate(val)
                  if (rawData) processData(rawData, val, filterEndDate)
                }}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1B9387] outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600 font-medium text-[11px]">To:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  const val = e.target.value
                  setFilterEndDate(val)
                  if (rawData) processData(rawData, filterStartDate, val)
                }}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1B9387] outline-none"
              />
            </div>
            {(filterStartDate || filterEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate('')
                  setFilterEndDate('')
                  if (rawData) processData(rawData, '', '')
                }}
                className="px-2 py-1 text-[11px] font-bold text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* FILE DROPZONE */}
        <div className="mb-8 p-8 border-2 border-dashed border-[#B0DCDA] bg-[#FBF8F8] rounded-xl flex flex-col items-center justify-center text-center">
          <FileSpreadsheet size={36} className="text-[#1B9387] mb-3 opacity-80" />
          <p className="text-sm font-bold text-gray-700 mb-1">
            Drag and drop your DTR CSV or Excel file here, or click to browse
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Supports .xlsx, .xls, and .csv exports from your biometric machine or manual time sheets.
          </p>
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="block w-full max-w-sm text-sm text-gray-500
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-md file:border-0
              file:text-xs file:font-bold
              file:bg-[#1B9387] file:text-white
              hover:file:bg-[#28958B] file:cursor-pointer file:transition shadow-sm"
          />
          {fileName && (
            <span className="mt-3 text-xs font-mono font-bold text-gray-600">
              Loaded: {fileName}
            </span>
          )}
        </div>

        {/* PREVIEW TABLE */}
        {parsedData.length > 0 && (
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                Preview & Verification ({parsedData.length} Employees Found)
              </h3>
              <span className="text-xs text-gray-500">
                Matched staff will have their hours automatically transferred to the payroll grid.
              </span>
            </div>

            <div className="overflow-auto border border-[#B0DCDA] rounded-xl bg-white shadow-sm mb-6 max-h-[450px]">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA] sticky top-0 z-10">
                  <tr className="text-gray-600 uppercase tracking-wider text-[10px] font-black">
                    <th className="p-3 border-r border-[#B0DCDA]">DTR Employee Name</th>
                    <th className="p-3 border-r border-[#B0DCDA]">Matched Clinic Staff</th>
                    <th className="p-3 border-r border-[#B0DCDA] text-right">Base Regular (hrs)</th>
                    <th className="p-3 border-r border-[#B0DCDA] text-right">Overtime (hrs)</th>
                    <th className="p-3 border-r border-[#B0DCDA] text-right">Night Diff (hrs)</th>
                    <th className="p-3 border-r border-[#B0DCDA] text-right">Sunday / Rest (hrs)</th>
                    <th className="p-3 border-r border-[#B0DCDA] text-right">Holiday (hrs)</th>
                    <th className="p-3 text-right">Demerits (Lates/Undertime)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {parsedData.map((row, idx) => {
                    const isSummary = row.mode === 'SUMMARY_HOURS'
                    const regHrs = isSummary ? row.summary.regHours : row.aggregated.totalBaseHours
                    const otHrs = isSummary
                      ? row.summary.otHours
                      : row.aggregated.totalHours.regular_ot
                    const ndHrs = isSummary
                      ? row.summary.ndHours
                      : row.aggregated.totalHours.regular_night
                    const sunHrs = isSummary
                      ? row.summary.sunHours
                      : row.aggregated.totalHours.rest_day
                    const holHrs = isSummary
                      ? (row.summary.legHours || 0) + (row.summary.spclHours || 0)
                      : (row.aggregated.totalHours.legal_holiday || 0) +
                        (row.aggregated.totalHours.special_holiday || 0)
                    const demerits = isSummary
                      ? (row.summary.lateMinutes || 0) + (row.summary.undertimeMinutes || 0)
                      : (row.aggregated.totalDemerits.late_minutes || 0) +
                        (row.aggregated.totalDemerits.undertime_minutes || 0)

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-medium text-gray-800 font-sans border-r border-[#B0DCDA]">
                          {row.originalName}
                        </td>
                        <td className="p-3 border-r border-[#B0DCDA] font-sans">
                          {row.matchedEmployee ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold">
                              ✅ {row.matchedEmployee.first_name} {row.matchedEmployee.last_name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-bold">
                              ⚠️ Unmatched
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right border-r border-[#B0DCDA] font-bold text-gray-900">
                          {regHrs.toFixed(1)}
                        </td>
                        <td className="p-3 text-right border-r border-[#B0DCDA] text-gray-700">
                          {otHrs > 0 ? otHrs.toFixed(1) : '—'}
                        </td>
                        <td className="p-3 text-right border-r border-[#B0DCDA] text-gray-700">
                          {ndHrs > 0 ? ndHrs.toFixed(1) : '—'}
                        </td>
                        <td className="p-3 text-right border-r border-[#B0DCDA] text-gray-700">
                          {sunHrs > 0 ? sunHrs.toFixed(1) : '—'}
                        </td>
                        <td className="p-3 text-right border-r border-[#B0DCDA] text-gray-700">
                          {holHrs > 0 ? holHrs.toFixed(1) : '—'}
                        </td>
                        <td className="p-3 text-right text-red-500 font-bold">
                          {demerits > 0 ? `${demerits} mins` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApply}
                className="px-8 py-3 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-lg font-black transition shadow-md tracking-wider uppercase text-xs flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle size={16} />
                <span>Apply to Payroll Grid</span>
              </button>
            </div>
          </div>
        )}

        {/* TEMPLATE CUSTOMIZATION MODAL */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300">
              {/* MODAL HEADER */}
              <div className="bg-[#1B9387] p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings size={18} />
                  <h3 className="font-extrabold text-sm tracking-wide uppercase">
                    DTR Template & Column Mapping Settings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* TEMPLATE TYPE SELECTION */}
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
                    DTR File Format / Biometric Mode
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setTempConfig((prev) => ({ ...prev, templateType: 'PUNCH_LOG' }))
                      }
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        tempConfig.templateType === 'PUNCH_LOG'
                          ? 'border-[#1B9387] bg-[#E9FAFA] ring-2 ring-[#1B9387]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-gray-800">Daily Punch Log</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        In / Out clock times per day (recommended)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTempConfig((prev) => ({ ...prev, templateType: 'SUMMARY_HOURS' }))
                      }
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        tempConfig.templateType === 'SUMMARY_HOURS'
                          ? 'border-[#1B9387] bg-[#E9FAFA] ring-2 ring-[#1B9387]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-gray-800">Summary Hours Table</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Pre-calculated Reg, OT, and ND hours per employee
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTempConfig((prev) => ({ ...prev, templateType: 'RAW_BIOMETRIC' }))
                      }
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        tempConfig.templateType === 'RAW_BIOMETRIC'
                          ? 'border-[#1B9387] bg-[#E9FAFA] ring-2 ring-[#1B9387]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-gray-800">Raw Biometric Machine</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Badge ID, Punch date, Clock In/Out columns
                      </div>
                    </button>
                  </div>
                </div>

                {/* COLUMN MAPPINGS */}
                <div>
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
                    Expected Column Header Names in Your File
                  </h4>
                  <p className="text-[11px] text-gray-500 mb-4">
                    If your biometric export uses different column names (e.g. &quot;EmpName&quot; instead of
                    &quot;Employee Name&quot;), enter the exact column titles below:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* General / Punch Fields */}
                    {tempConfig.templateType !== 'SUMMARY_HOURS' ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Employee Name Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.employeeName}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, employeeName: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                            placeholder="Employee Name"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Date Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.date}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, date: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                            placeholder="Date"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Time In / Clock In Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.timeIn}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, timeIn: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                            placeholder="Time In"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Time Out / Clock Out Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.timeOut}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, timeOut: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                            placeholder="Time Out"
                          />
                        </div>

                        {tempConfig.templateType === 'PUNCH_LOG' && (
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">
                              Shift Type Column
                            </label>
                            <input
                              type="text"
                              value={tempConfig.columnMapping.shiftType}
                              onChange={(e) =>
                                setTempConfig((prev) => ({
                                  ...prev,
                                  columnMapping: { ...prev.columnMapping, shiftType: e.target.value }
                                }))
                              }
                              className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                              placeholder="Shift Type"
                            />
                          </div>
                        )}

                        {tempConfig.templateType === 'RAW_BIOMETRIC' && (
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">
                              Badge / Biometric ID Column
                            </label>
                            <input
                              type="text"
                              value={tempConfig.columnMapping.badgeId}
                              onChange={(e) =>
                                setTempConfig((prev) => ({
                                  ...prev,
                                  columnMapping: { ...prev.columnMapping, badgeId: e.target.value }
                                }))
                              }
                              className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                              placeholder="Badge ID"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Summary Hours Fields */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Employee Name Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.employeeName}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, employeeName: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Regular Hours Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.regHours}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, regHours: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Overtime Hours Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.otHours}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, otHours: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Night Differential Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.ndHours}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, ndHours: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Sunday / Rest Day Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.sunHours}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, sunHours: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Absence Days Column
                          </label>
                          <input
                            type="text"
                            value={tempConfig.columnMapping.absentDays}
                            onChange={(e) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                columnMapping: { ...prev.columnMapping, absentDays: e.target.value }
                              }))
                            }
                            className="w-full text-xs font-mono font-medium p-2 border border-gray-300 rounded focus:border-[#1B9387] outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetModalSettings}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-bold cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Reset to Standard</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      downloadDtrTemplate({
                        format: 'xlsx',
                        employees,
                        config: tempConfig
                      })
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#E9FAFA] hover:bg-[#d6f4f2] text-[#1B9387] border border-[#B0DCDA] rounded-md text-xs font-bold transition cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download Sample</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveModalSettings}
                    className="px-5 py-1.5 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-md text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                  >
                    Save Mapping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
