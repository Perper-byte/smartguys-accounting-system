// src/renderer/src/utils/dtr-template-generator.ts
import * as XLSX from 'xlsx'

export type DtrTemplateType = 'PUNCH_LOG' | 'SUMMARY_HOURS' | 'RAW_BIOMETRIC'

export interface DtrColumnMapping {
  // Punch Log
  employeeName: string
  date: string
  timeIn: string
  timeOut: string
  shiftType: string

  // Summary Hours
  regHours: string
  otHours: string
  ndHours: string
  sunHours: string
  legHours: string
  spclHours: string
  lateMinutes: string
  undertimeMinutes: string
  absentDays: string

  // Raw Biometric
  badgeId: string
  clockIn: string
  clockOut: string
}

export interface DtrTemplateConfig {
  templateType: DtrTemplateType
  columnMapping: DtrColumnMapping
}

export const DEFAULT_DTR_CONFIG: DtrTemplateConfig = {
  templateType: 'PUNCH_LOG',
  columnMapping: {
    employeeName: 'Employee Name',
    date: 'Date',
    timeIn: 'Time In',
    timeOut: 'Time Out',
    shiftType: 'Shift Type',

    regHours: 'Regular Hours',
    otHours: 'Overtime Hours',
    ndHours: 'Night Diff Hours',
    sunHours: 'Sunday Hours',
    legHours: 'Legal Holiday Hours',
    spclHours: 'Special Holiday Hours',
    lateMinutes: 'Late Minutes',
    undertimeMinutes: 'Undertime Minutes',
    absentDays: 'Absence Days',

    badgeId: 'Badge ID',
    clockIn: 'Clock In',
    clockOut: 'Clock Out'
  }
}

export const STORAGE_KEY_DTR_CONFIG = 'smartguys_dtr_template_config'

export function getDtrTemplateConfig(): DtrTemplateConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DTR_CONFIG)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        templateType: parsed.templateType || DEFAULT_DTR_CONFIG.templateType,
        columnMapping: { ...DEFAULT_DTR_CONFIG.columnMapping, ...(parsed.columnMapping || {}) }
      }
    }
  } catch (err) {
    console.error('Failed to load DTR template config', err)
  }
  return DEFAULT_DTR_CONFIG
}

export function saveDtrTemplateConfig(config: DtrTemplateConfig): void {
  localStorage.setItem(STORAGE_KEY_DTR_CONFIG, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('smartguys:dtr-config-updated', { detail: config }))
}

export function downloadDtrTemplate({
  format = 'xlsx',
  employees = [],
  config
}: {
  format?: 'xlsx' | 'csv'
  employees?: any[]
  config?: DtrTemplateConfig
}) {
  const currentConfig = config || getDtrTemplateConfig()
  const mapping = currentConfig.columnMapping
  const activeEmployees = employees.filter((e) => e.is_active !== false)

  const today = new Date().toISOString().split('T')[0]
  const sampleEmployees =
    activeEmployees.length > 0
      ? activeEmployees.map((e) => ({
          name: `${e.first_name} ${e.last_name}`,
          id: e.employee_id || e.id
        }))
      : [
          { name: 'Juan Dela Cruz', id: 'EMP-001' },
          { name: 'Maria Santos', id: 'EMP-002' },
          { name: 'Pedro Reyes', id: 'EMP-003' }
        ]

  const sheetData: any[][] = []

  if (currentConfig.templateType === 'PUNCH_LOG') {
    // Headers
    sheetData.push([
      mapping.employeeName || 'Employee Name',
      mapping.date || 'Date',
      mapping.timeIn || 'Time In',
      mapping.timeOut || 'Time Out',
      mapping.shiftType || 'Shift Type'
    ])

    // Pre-populate with active staff
    sampleEmployees.forEach((emp, index) => {
      // Provide a couple sample punch rows
      sheetData.push([
        emp.name,
        today,
        index % 2 === 0 ? '08:00 AM' : '09:00 AM',
        index % 2 === 0 ? '05:00 PM' : '06:00 PM',
        'REGULAR'
      ])
    })
  } else if (currentConfig.templateType === 'SUMMARY_HOURS') {
    // Headers
    sheetData.push([
      mapping.employeeName || 'Employee Name',
      mapping.regHours || 'Regular Hours',
      mapping.otHours || 'Overtime Hours',
      mapping.ndHours || 'Night Diff Hours',
      mapping.sunHours || 'Sunday Hours',
      mapping.legHours || 'Legal Holiday Hours',
      mapping.spclHours || 'Special Holiday Hours',
      mapping.lateMinutes || 'Late Minutes',
      mapping.undertimeMinutes || 'Undertime Minutes',
      mapping.absentDays || 'Absence Days'
    ])

    sampleEmployees.forEach((emp) => {
      sheetData.push([
        emp.name,
        80, // e.g. 10 days x 8 hrs
        4, // 4 hours OT
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    })
  } else {
    // RAW_BIOMETRIC
    sheetData.push([
      mapping.badgeId || 'Badge ID',
      mapping.employeeName || 'Employee Name',
      mapping.date || 'Date',
      mapping.clockIn || 'Clock In',
      mapping.clockOut || 'Clock Out'
    ])

    sampleEmployees.forEach((emp) => {
      sheetData.push([emp.id, emp.name, today, '08:00:00', '17:00:00'])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DTR Template')

  const typeName =
    currentConfig.templateType === 'SUMMARY_HOURS'
      ? 'Summary_Hours'
      : currentConfig.templateType === 'RAW_BIOMETRIC'
        ? 'Biometric_Raw'
        : 'Daily_Punch_Log'

  const filename = `DTR_Template_${typeName}_${today}.${format}`

  XLSX.writeFile(wb, filename, {
    bookType: format === 'csv' ? 'csv' : 'xlsx'
  })
}
