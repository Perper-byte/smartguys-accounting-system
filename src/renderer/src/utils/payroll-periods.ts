// src/renderer/src/utils/payroll-periods.ts

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/**
 * Checks if a given year is a leap year (Feb has 29 days instead of 28).
 * Rule: Year divisible by 4, except end-of-centuries not divisible by 400.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Returns exact days in a month for any given year.
 * Handles February leap year automatically (29 in 2024/2028, 28 in 2025/2026).
 * @param year e.g. 2026
 * @param month 1 to 12
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export type CutoffType = '1ST_HALF' | '2ND_HALF' | 'CUSTOM'

export interface CutoffDetails {
  year: number
  month: number
  cutoff: CutoffType
  startDate: string
  endDate: string
  payrollDate: string
  daysCount: number
  isLeapFeb: boolean
  label: string
  badgeText: string
  defaultMemo: string
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export function getPayrollCutoffDetails(
  year: number,
  month: number,
  cutoff: CutoffType
): CutoffDetails {
  const monthName = MONTH_NAMES[month - 1] || 'Month'
  const isFeb = month === 2
  const leap = isFeb && isLeapYear(year)
  const lastDay = getDaysInMonth(year, month)

  if (cutoff === '1ST_HALF') {
    return {
      year,
      month,
      cutoff: '1ST_HALF',
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-15`,
      payrollDate: `${year}-${pad(month)}-15`,
      daysCount: 15,
      isLeapFeb: false,
      label: `1st Half (1st – 15th)`,
      badgeText: `15 days (1st to 15th)`,
      defaultMemo: `${monthName} 1–15, ${year} Payroll`
    }
  }

  if (cutoff === '2ND_HALF') {
    const daysInSecondHalf = lastDay - 15
    const leapNote = isFeb ? (leap ? 'Leap Year: 29 days' : '28 days') : `${daysInSecondHalf} days`

    return {
      year,
      month,
      cutoff: '2ND_HALF',
      startDate: `${year}-${pad(month)}-16`,
      endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
      payrollDate: `${year}-${pad(month)}-${pad(lastDay)}`,
      daysCount: daysInSecondHalf,
      isLeapFeb: leap,
      label: `2nd Half (16th – ${lastDay}th)`,
      badgeText: `${daysInSecondHalf} days (16th to ${lastDay}th${isFeb ? ` • ${leapNote}` : ''})`,
      defaultMemo: `${monthName} 16–${lastDay}, ${year} Payroll`
    }
  }

  // CUSTOM
  const today = new Date().toISOString().split('T')[0]
  return {
    year,
    month,
    cutoff: 'CUSTOM',
    startDate: `${year}-${pad(month)}-01`,
    endDate: today,
    payrollDate: today,
    daysCount: 0,
    isLeapFeb: false,
    label: 'Custom Range',
    badgeText: 'Custom Cutoff',
    defaultMemo: `${monthName} ${year} Payroll`
  }
}

// -------------------------------------------------------------
// PAYROLL DRAFTS STORAGE SYSTEM
// -------------------------------------------------------------
export interface PayrollDraft {
  id: string // e.g. "draft-2026-10-1ST_HALF" or timestamp
  cutoff: CutoffType
  year: number
  month: number
  startDate: string
  endDate: string
  payrollDate: string
  refSequence: string
  description: string
  rowInputs: Record<number, any>
  savedAt: string
  totalEmployees: number
  totalNet: number
}

export const STORAGE_KEY_PAYROLL_DRAFTS = 'smartguys_payroll_drafts'

export function getPayrollDrafts(): PayrollDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAYROLL_DRAFTS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.error('Failed to load payroll drafts', err)
  }
  return []
}

export function getPayrollDraft(id: string): PayrollDraft | null {
  const drafts = getPayrollDrafts()
  return drafts.find((d) => d.id === id) || null
}

export function findDraftForCutoff(
  year: number,
  month: number,
  cutoff: CutoffType
): PayrollDraft | null {
  const drafts = getPayrollDrafts()
  return drafts.find((d) => d.year === year && d.month === month && d.cutoff === cutoff) || null
}

export function savePayrollDraft(draft: PayrollDraft): void {
  const drafts = getPayrollDrafts()
  const existingIdx = drafts.findIndex((d) => d.id === draft.id)

  let updated: PayrollDraft[]
  if (existingIdx >= 0) {
    updated = [...drafts]
    updated[existingIdx] = draft
  } else {
    updated = [draft, ...drafts]
  }

  localStorage.setItem(STORAGE_KEY_PAYROLL_DRAFTS, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('smartguys:payroll-drafts-updated', { detail: updated }))
}

export function deletePayrollDraft(id: string): void {
  const drafts = getPayrollDrafts()
  const updated = drafts.filter((d) => d.id !== id)
  localStorage.setItem(STORAGE_KEY_PAYROLL_DRAFTS, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('smartguys:payroll-drafts-updated', { detail: updated }))
}
