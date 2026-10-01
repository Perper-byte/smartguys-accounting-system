// src/renderer/src/utils/excel-payroll-export.ts
import * as XLSX from 'xlsx'
import {
  ALL_DOLE_RATES,
  DOLERateDef,
  getActiveDoleRateKeys,
  getDoleMultipliers
} from './dole-rates'

export interface PayrollRowExportData {
  name: string
  position: string
  monthlySalary: number
  dailyRate: number
  // 16 DOLE categories
  regHours: number
  otHours: number
  ndHours: number
  ndOtHours: number
  sunRegHours: number
  sunOtHours: number
  sunNdHours: number
  sunNdOtHours: number
  legRegHours: number
  legOtHours: number
  legNdHours: number
  legNdOtHours: number
  spclRegHours: number
  spclOtHours: number
  spclNdHours: number
  spclNdOtHours: number
  // Earning summaries
  totalDays: number
  hourlyRate: number
  grossPay: number
  // Deductions
  absentDays: number
  absentDeduction: number
  totalAfterAbsent: number
  sss: number
  philhealth: number
  hdmf: number
  withholdingTax: number
  totalPrimaryDeductions: number
  netPrimaryDeductions: number
  totalNetDeduction: number
  // Adjustments
  mealTranspoAllowance: number
  licenseFee: number
  adjustment: number
  sil: number
  netTotal: number
}

const KEY_TO_FIELD: Record<string, keyof PayrollRowExportData> = {
  reg: 'regHours',
  ot: 'otHours',
  nd: 'ndHours',
  nd_ot: 'ndOtHours',
  sun_reg: 'sunRegHours',
  sun_ot: 'sunOtHours',
  sun_nd: 'sunNdHours',
  sun_nd_ot: 'sunNdOtHours',
  leg_reg: 'legRegHours',
  leg_ot: 'legOtHours',
  leg_nd: 'legNdHours',
  leg_nd_ot: 'legNdOtHours',
  spcl_reg: 'spclRegHours',
  spcl_ot: 'spclOtHours',
  spcl_nd: 'spclNdHours',
  spcl_nd_ot: 'spclNdOtHours'
}

export function exportPayrollGridToExcel(
  rows: PayrollRowExportData[],
  payrollDate: string,
  voucherNo: string,
  memo: string,
  activeKeys?: string[],
  customMultipliers?: Record<string, number>
) {
  const effectiveActiveKeys = activeKeys && activeKeys.length > 0 ? activeKeys : getActiveDoleRateKeys()
  const activeRateDefs = ALL_DOLE_RATES.filter((r) => effectiveActiveKeys.includes(r.key))
  const multipliers = customMultipliers || getDoleMultipliers()

  const sheetData: any[][] = []

  // Row 1: Title & Meta
  sheetData.push([`SMART GUYS ACCOUNTING - PAYROLL REGISTER (${voucherNo})`])
  sheetData.push([`Period / Date: ${payrollDate}`, '', `Memo: ${memo}`])
  sheetData.push([])

  // Row 4: Category Group Header
  const groupRow: string[] = ['', '', '', ''] // 4 left frozen columns

  const groups: { id: string; label: string }[] = [
    { id: 'REGULAR', label: 'REGULAR (hours)' },
    { id: 'SUNDAY', label: 'SUNDAY/SATURDAY (hours)' },
    { id: 'LEGAL', label: 'LEGAL HOLIDAY (hours)' },
    { id: 'SPECIAL', label: 'SPECIAL HOLIDAY (hours)' }
  ]

  groups.forEach((g) => {
    const count = activeRateDefs.filter((r) => r.group === g.id).length
    if (count > 0) {
      groupRow.push(g.label)
      for (let i = 1; i < count; i++) {
        groupRow.push('')
      }
    }
  })

  // Earnings, Demerits, Primary Deductions, Adjustments Group Titles
  groupRow.push('Earnings Summary', '', '')
  groupRow.push('Demerits', '', '')
  groupRow.push('PRIMARY DEDUCTIONS', '', '', '', '', '', '')
  groupRow.push('ADJUSTMENTS', '', '', '', '')

  sheetData.push(groupRow)

  // Row 5: Multiplier Row
  const multRow: string[] = ['', '', '', 'Multiplier:']
  activeRateDefs.forEach((r) => {
    const mult = multipliers[r.key] ?? r.defaultMultiplier
    multRow.push(mult.toFixed(3))
  })
  // Fill remaining non-multiplier columns with empty strings
  for (let i = 0; i < 18; i++) {
    multRow.push('')
  }
  sheetData.push(multRow)

  // Row 6: Detailed Column Names
  const colHeaderRow: string[] = ['NAME', 'POSITION', 'SALARY (Monthly)', 'DAILY RATE']
  activeRateDefs.forEach((r) => {
    colHeaderRow.push(r.shortLabel)
  })

  colHeaderRow.push(
    'Total # of Days',
    'REGULAR HOURLY RATE',
    'GROSS PAY',
    'Absent (days)',
    'Absent Deduction',
    'TOTAL',
    'SSS',
    'PHILHEALTH',
    'HDMF',
    'WITHHOLDING',
    'TOTAL OF PRIMARY DEDUCTIONS',
    'NET TOTAL OF PRIMARY DEDUCTION',
    'TOTAL NET OF DEDUCTION',
    'Meal & Transpo Allowance',
    'License Fee',
    'ADJUSTMENT',
    'SIL',
    'NET TOTAL'
  )
  sheetData.push(colHeaderRow)

  // Rows 7+: Data rows
  rows.forEach((r) => {
    const dataRow: any[] = [
      r.name,
      r.position,
      r.monthlySalary,
      r.dailyRate
    ]

    activeRateDefs.forEach((def) => {
      const field = KEY_TO_FIELD[def.key]
      dataRow.push(field && r[field] ? r[field] : null)
    })

    dataRow.push(
      r.totalDays || null,
      r.hourlyRate,
      r.grossPay,
      r.absentDays || null,
      r.absentDeduction || null,
      r.totalAfterAbsent,
      r.sss,
      r.philhealth,
      r.hdmf,
      r.withholdingTax || null,
      r.totalPrimaryDeductions,
      r.netPrimaryDeductions,
      r.totalNetDeduction,
      r.mealTranspoAllowance || null,
      r.licenseFee || null,
      r.adjustment || null,
      r.sil || null,
      r.netTotal
    )

    sheetData.push(dataRow)
  })

  // Summary Row
  const totalRow: any[] = [
    'TOTALS',
    '',
    rows.reduce((s, r) => s + r.monthlySalary, 0),
    ''
  ]

  activeRateDefs.forEach((def) => {
    const field = KEY_TO_FIELD[def.key]
    const sum = field ? rows.reduce((s, r) => s + ((r[field] as number) || 0), 0) : 0
    totalRow.push(sum > 0 ? sum : null)
  })

  totalRow.push(
    '',
    '',
    rows.reduce((s, r) => s + r.grossPay, 0),
    rows.reduce((s, r) => s + (r.absentDays || 0), 0),
    rows.reduce((s, r) => s + (r.absentDeduction || 0), 0),
    rows.reduce((s, r) => s + r.totalAfterAbsent, 0),
    rows.reduce((s, r) => s + r.sss, 0),
    rows.reduce((s, r) => s + r.philhealth, 0),
    rows.reduce((s, r) => s + r.hdmf, 0),
    rows.reduce((s, r) => s + r.withholdingTax, 0),
    rows.reduce((s, r) => s + r.totalPrimaryDeductions, 0),
    rows.reduce((s, r) => s + r.netPrimaryDeductions, 0),
    rows.reduce((s, r) => s + r.totalNetDeduction, 0),
    rows.reduce((s, r) => s + r.mealTranspoAllowance, 0),
    rows.reduce((s, r) => s + r.licenseFee, 0),
    rows.reduce((s, r) => s + r.adjustment, 0),
    rows.reduce((s, r) => s + r.sil, 0),
    rows.reduce((s, r) => s + r.netTotal, 0)
  )
  sheetData.push(totalRow)

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll Register')

  const cleanVoucher = voucherNo.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Payroll_Register_${cleanVoucher}_${payrollDate}.xlsx`

  XLSX.writeFile(wb, filename)
}
