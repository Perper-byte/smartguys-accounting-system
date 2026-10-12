// src/main/services/payroll-calculator.test.ts
import {
  calculateHourlyRate,
  calculateOvertimeAndDiff,
  calculateAttendanceDemerits,
  getSSSMonthlySalaryCredit,
  calculateSSSContribution,
  calculatePhilHealthContribution,
  calculatePagIbigContribution,
  calculateWithholdingTax,
  PayrollMultipliers
} from './payroll-calculator'

describe('Payroll Calculator Engine', () => {
  const defaultMultipliers: PayrollMultipliers = {
    regular_ot_rate: 1.25,
    regular_night_rate: 0.10,
    regular_night_ot_rate: 1.375,
    rest_day_rate: 1.30,
    rest_day_ot_rate: 1.69,
    rest_day_night_rate: 1.43,
    rest_day_night_ot_rate: 1.859,
    special_holiday_rate: 1.30,
    special_holiday_ot_rate: 1.69,
    special_holiday_night_rate: 1.43,
    special_holiday_night_ot_rate: 1.859,
    special_holiday_rest_day_rate: 1.50,
    special_holiday_rest_day_ot_rate: 1.95,
    special_holiday_rest_day_night_rate: 1.65,
    special_holiday_rest_day_night_ot_rate: 2.145,
    legal_holiday_rate: 2.00
  }

  test('calculateHourlyRate uses 261 days divisor and 8 hours workday standard', () => {
    // ₱26,100 monthly => (26100 * 12) / 261 / 8 = 313200 / 2088 = 150
    const hourly = calculateHourlyRate(26100)
    expect(hourly).toBe(150)
  })

  test('calculateOvertimeAndDiff computes overtime, night diff, and holiday premiums', () => {
    const hourlyRate = 100
    const hours = {
      regular_ot: 2, // 2 * 100 * 1.25 = 250
      rest_day: 8,   // 8 * 100 * 1.30 = 1040
      legal_holiday: 8 // 8 * 100 * 2.00 = 1600
    }

    const totalPremium = calculateOvertimeAndDiff(hourlyRate, hours, defaultMultipliers)
    expect(totalPremium).toBe(250 + 1040 + 1600)
  })

  test('calculateAttendanceDemerits computes late, undertime, and absence deductions', () => {
    const hourlyRate = 120 // Minute rate = 2, Daily rate = 960
    const demerits = {
      late_minutes: 30, // 30 * 2 = 60
      undertime_hours: 1, // 1 * 120 = 120
      undertime_minutes: 0,
      absence_days: 2 // 2 * 960 = 1920
    }

    const result = calculateAttendanceDemerits(hourlyRate, demerits)
    expect(result.late_deduction).toBe(60)
    expect(result.undertime_deduction).toBe(120)
    expect(result.absence_deduction).toBe(1920)
    expect(result.total_demerits).toBe(2100)
  })

  describe('SSS Contributions', () => {
    test('getSSSMonthlySalaryCredit respects minimum ₱5,000 and maximum ₱35,000 MSC caps', () => {
      expect(getSSSMonthlySalaryCredit(4000)).toBe(5000)
      expect(getSSSMonthlySalaryCredit(5000)).toBe(5000)
      expect(getSSSMonthlySalaryCredit(20000)).toBe(20000)
      expect(getSSSMonthlySalaryCredit(40000)).toBe(35000)
    })

    test('calculateSSSContribution separates Regular Social Security and WISP shares with EC', () => {
      // ₱30,000 salary: MSC = 30000. Regular MSC = 20000, WISP MSC = 10000
      const contrib = calculateSSSContribution(30000)
      expect(contrib.regular_ee).toBe(20000 * 0.05) // 1000
      expect(contrib.regular_er).toBe(20000 * 0.10) // 2000
      expect(contrib.wisp_ee).toBe(10000 * 0.05)   // 500
      expect(contrib.wisp_er).toBe(10000 * 0.10)   // 1000
      expect(contrib.ec).toBe(30)
      expect(contrib.total_ee).toBe(1500)
      expect(contrib.total_er).toBe(3030)
    })
  })

  describe('PhilHealth Contributions', () => {
    test('calculatePhilHealthContribution applies 5% rate split 50/50 between employee and employer', () => {
      // ₱20,000: Total = 1000, EE = 500, ER = 500
      const res = calculatePhilHealthContribution(20000)
      expect(res.totalPremium).toBe(1000)
      expect(res.eeShare).toBe(500)
      expect(res.erShare).toBe(500)
    })

    test('calculatePhilHealthContribution clamps to ₱10,000 floor and ₱100,000 ceiling', () => {
      const minRes = calculatePhilHealthContribution(5000)
      expect(minRes.totalPremium).toBe(10000 * 0.05)

      const maxRes = calculatePhilHealthContribution(150000)
      expect(maxRes.totalPremium).toBe(100000 * 0.05)
    })
  })

  describe('Pag-IBIG Contributions', () => {
    test('calculatePagIbigContribution applies statutory ₱200 cap', () => {
      // High salary: 2% of 30,000 is 600, clamped to 200
      const res = calculatePagIbigContribution(30000)
      expect(res.eeShare).toBe(200)
      expect(res.erShare).toBe(200)
      expect(res.totalPremium).toBe(400)
    })

    test('calculatePagIbigContribution handles low income <= ₱1,500 at 1% EE', () => {
      const res = calculatePagIbigContribution(1000)
      expect(res.eeShare).toBe(10) // 1% of 1000
      expect(res.erShare).toBe(20) // 2% of 1000
    })
  })

  describe('TRAIN Law Withholding Tax', () => {
    test('calculateWithholdingTax returns 0 tax for minimum taxable income brackets', () => {
      expect(calculateWithholdingTax(10000, 'SEMI_MONTHLY')).toBe(0)
      expect(calculateWithholdingTax(20000, 'MONTHLY')).toBe(0)
    })

    test('calculateWithholdingTax computes correct tax for semi-monthly brackets', () => {
      // Taxable ₱15,000 semi-monthly: (15000 - 10417) * 0.15 = 4583 * 0.15 = 687.45
      const tax = calculateWithholdingTax(15000, 'SEMI_MONTHLY')
      expect(tax).toBeCloseTo(687.45, 1)
    })

    test('calculateWithholdingTax computes correct tax for monthly brackets', () => {
      // Taxable ₱30,000 monthly: (30000 - 20833) * 0.15 = 9167 * 0.15 = 1375.05
      const tax = calculateWithholdingTax(30000, 'MONTHLY')
      expect(tax).toBeCloseTo(1375.05, 1)
    })
  })
})
