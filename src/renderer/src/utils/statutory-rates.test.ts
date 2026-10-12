// src/renderer/src/utils/statutory-rates.test.ts
import {
  calculateSSS2026,
  calculatePhilHealth2026,
  calculatePagIbig2026,
  calculateTRAINWithholdingTax,
  generateOfficial2026SSSTable,
  getPhilHealthConfig,
  getPagIbigConfig
} from './statutory-rates'

describe('Statutory Rates Utility (Philippine Regulations)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('SSS 2026 Schedule', () => {
    test('generateOfficial2026SSSTable generates valid brackets covering ₱5,000 to ₱35,000', () => {
      const table = generateOfficial2026SSSTable()
      expect(table.length).toBeGreaterThan(50)
      expect(table[0].minComp).toBe(0)
      expect(table[table.length - 1].totalMsc).toBe(35000)
    })

    test('calculateSSS2026 calculates employee and employer shares accurately', () => {
      // For ₱25,000 monthly salary: MSC 25,000
      const sss = calculateSSS2026(25000)
      expect(sss.totalMsc).toBe(25000)
      expect(sss.totalEE).toBeGreaterThan(0)
      expect(sss.totalER).toBeGreaterThan(0)
      expect(sss.totalContribution).toBe(sss.totalEE + sss.totalER)
    })
  })

  describe('PhilHealth 2026 (5% Rate)', () => {
    test('calculatePhilHealth2026 splits 5% premium equally between EE and ER', () => {
      const phConfig = getPhilHealthConfig()
      expect(phConfig.rate).toBe(5.0)

      // ₱30,000 salary => 5% = ₱1,500 total, ₱750 EE, ₱750 ER
      const result = calculatePhilHealth2026(30000, phConfig)
      expect(result.totalPremium).toBe(1500)
      expect(result.eeShare).toBe(750)
      expect(result.erShare).toBe(750)
    })

    test('calculatePhilHealth2026 respects salary floor (₱10,000) and ceiling (₱100,000)', () => {
      const phConfig = getPhilHealthConfig()

      const belowFloor = calculatePhilHealth2026(5000, phConfig)
      expect(belowFloor.totalPremium).toBe(10000 * 0.05)

      const aboveCeiling = calculatePhilHealth2026(150000, phConfig)
      expect(aboveCeiling.totalPremium).toBe(100000 * 0.05)
    })
  })

  describe('Pag-IBIG 2026 (₱200 Cap)', () => {
    test('calculatePagIbig2026 enforces ₱200 maximum share', () => {
      const piConfig = getPagIbigConfig()
      expect(piConfig.maxContribution).toBe(200)

      const result = calculatePagIbig2026(25000, piConfig)
      expect(result.eeShare).toBe(200)
      expect(result.erShare).toBe(200)
      expect(result.eeShare + result.erShare).toBe(400)
    })

    test('calculatePagIbig2026 handles salaries under ₱1,500', () => {
      const piConfig = getPagIbigConfig()
      const result = calculatePagIbig2026(1200, piConfig)
      expect(result.eeShare).toBe(12) // 1% of 1200
      expect(result.erShare).toBe(24) // 2% of 1200
    })
  })

  describe('TRAIN Withholding Tax', () => {
    test('calculateTRAINWithholdingTax yields 0 tax for non-taxable compensation', () => {
      const semiMonthly = calculateTRAINWithholdingTax(10000, 'SEMI_MONTHLY')
      expect(semiMonthly.totalTax).toBe(0)

      const monthly = calculateTRAINWithholdingTax(20000, 'MONTHLY')
      expect(monthly.totalTax).toBe(0)
    })

    test('calculateTRAINWithholdingTax applies progressive marginal tax rates', () => {
      const semiMonthlyTax = calculateTRAINWithholdingTax(15000, 'SEMI_MONTHLY')
      expect(semiMonthlyTax.totalTax).toBeGreaterThan(0)

      const monthlyTax = calculateTRAINWithholdingTax(35000, 'MONTHLY')
      expect(monthlyTax.totalTax).toBeGreaterThan(0)
    })
  })
})
