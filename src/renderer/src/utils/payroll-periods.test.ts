// src/renderer/src/utils/payroll-periods.test.ts
import {
  isLeapYear,
  getDaysInMonth,
  getPayrollCutoffDetails,
  savePayrollDraft,
  getPayrollDraft,
  getPayrollDrafts,
  deletePayrollDraft,
  PayrollDraft
} from './payroll-periods'

describe('Payroll Periods Utility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('isLeapYear accurately detects leap years', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(1900)).toBe(false)
  })

  test('getDaysInMonth returns correct days for all months including February', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31) // January
    expect(getDaysInMonth(2026, 2)).toBe(28) // February non-leap
    expect(getDaysInMonth(2024, 2)).toBe(29) // February leap year
    expect(getDaysInMonth(2026, 4)).toBe(30) // April
  })

  test('getPayrollCutoffDetails calculates 1st half and 2nd half date ranges accurately', () => {
    // 1st half of October 2026: Oct 1 - Oct 15
    const firstHalf = getPayrollCutoffDetails(2026, 10, '1ST_HALF')
    expect(firstHalf.startDate).toBe('2026-10-01')
    expect(firstHalf.endDate).toBe('2026-10-15')
    expect(firstHalf.daysCount).toBe(15)

    // 2nd half of February 2026: Feb 16 - Feb 28
    const secondHalfFeb = getPayrollCutoffDetails(2026, 2, '2ND_HALF')
    expect(secondHalfFeb.startDate).toBe('2026-02-16')
    expect(secondHalfFeb.endDate).toBe('2026-02-28')
    expect(secondHalfFeb.daysCount).toBe(13)
  })

  test('Draft management saves, retrieves, and deletes drafts from storage', () => {
    const draft: PayrollDraft = {
      id: 'draft-oct-1',
      year: 2026,
      month: 10,
      cutoffHalf: '1ST_HALF',
      title: 'October 1-15 2026 Payroll',
      savedAt: new Date().toISOString(),
      rows: []
    }

    savePayrollDraft(draft)
    expect(getPayrollDrafts().length).toBe(1)
    expect(getPayrollDraft('draft-oct-1')?.title).toBe('October 1-15 2026 Payroll')

    deletePayrollDraft('draft-oct-1')
    expect(getPayrollDraft('draft-oct-1')).toBeNull()
  })
})

