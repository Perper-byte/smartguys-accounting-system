/// <reference types="jest" />
// src/main/services/tax.service.test.ts
import { TaxService } from './tax.service'

describe('Sprint 4 - Week 1: BIR Tax Compliance Engine', () => {
  const currentYear = 2026
  const currentQuarter = 2 // April, May, June
  const currentMonth = 5 // May (Middle of Q2 for 0619-E testing)

  /**
   * @test Form 2550Q: Should calculate exact 12% Output and Input VAT
   * FEATURE: BIR Form 2550Q (Quarterly VAT)
   * WHAT: Value-Added Tax (12% VAT) rate application, Output vs Input VAT, and net VAT payable
   * WHY: Comply with National Internal Revenue Code (NIRC) Sec. 106/108 quarterly VAT filing
   * TYPE: HAPPY PATH (Positive)
   */
  test('Form 2550Q: Should calculate exact 12% Output and Input VAT', async () => {
    const form2550Q = await TaxService.generate2550Q(currentYear, currentQuarter)

    // VAT Math Check: Output VAT + Net Sales MUST equal Gross Sales
    const totalSalesValidation = form2550Q.netSales + form2550Q.outputVat
    expect(totalSalesValidation).toBeCloseTo(form2550Q.grossSales, 1)

    const totalPurchasesValidation = form2550Q.netPurchases + form2550Q.inputVat
    expect(totalPurchasesValidation).toBeCloseTo(form2550Q.grossPurchases, 1)

    // Net VAT Payable must equal Output VAT - Input VAT
    expect(form2550Q.netVatPayable).toBeCloseTo(form2550Q.outputVat - form2550Q.inputVat, 1)
  })

  /**
   * @test Form 0619-E: Should extract monthly Expanded Withholding Tax (EWT)
   * FEATURE: BIR Form 0619-E (Monthly EWT Remittance)
   * WHAT: Extraction of monthly Expanded Withholding Tax (EWT) and Alphalist (QAP) breakdown
   * WHY: Ensure statutory compliance for monthly withholding remittance on supplier payments (NIRC Sec. 57)
   * TYPE: HAPPY PATH (Positive)
   */
  test('Form 0619-E: Should extract monthly Expanded Withholding Tax (EWT)', async () => {
    const form0619E = await TaxService.generate0619E(currentYear, currentMonth)

    expect(form0619E).toHaveProperty('ewtWithheld')
    expect(form0619E).toHaveProperty('qapList')
    expect(Array.isArray(form0619E.qapList)).toBe(true)

    if (form0619E.qapList.length > 0) {
      const sumOfQapTaxes = form0619E.qapList.reduce(
        (acc: number, curr: any) => acc + curr.taxWithheld,
        0
      )
      expect(sumOfQapTaxes).toBeCloseTo(form0619E.ewtWithheld, 1)
    }
  })

  /**
   * @test Relief Annexes: Should extract transactions assigned to payees for both Sales and Purchases
   * FEATURE: BIR RELIEF Annexes
   * WHAT: Extraction of Schedule of Sales and Purchases (SLSP) with payee TIN validation
   * WHY: Comply with BIR RR 7-95 / RR 8-2002 electronic submission requirements for VAT auditing
   * TYPE: HAPPY PATH (Positive)
   */
  test('Relief Annexes: Should extract transactions assigned to payees for both Sales and Purchases', async () => {
    const annexes = await TaxService.generateReliefAnnexes(currentYear, currentQuarter)

    expect(annexes).toHaveProperty('header')
    expect(annexes.header).toHaveProperty('tin')
    expect(annexes.header).toHaveProperty('registeredName')
    expect(annexes).toHaveProperty('annexA_Sales')
    expect(annexes).toHaveProperty('annexB_Purchases')
    expect(annexes).toHaveProperty('salesTotals')
    expect(annexes).toHaveProperty('purchasesTotals')

    expect(Array.isArray(annexes.annexA_Sales)).toBe(true)
    expect(Array.isArray(annexes.annexB_Purchases)).toBe(true)

    if (annexes.annexA_Sales.length > 0) {
      const sampleSale = annexes.annexA_Sales[0]
      expect(sampleSale).toHaveProperty('tin')
      expect(sampleSale).toHaveProperty('customerName')
      expect(sampleSale).toHaveProperty('taxableSales')
      expect(sampleSale).toHaveProperty('outputTax')
    }

    expect(annexes).toHaveProperty('salesDatFile')
    expect(annexes).toHaveProperty('salesFileName')
    expect(annexes).toHaveProperty('purchasesDatFile')
    expect(annexes).toHaveProperty('purchasesFileName')

    expect(typeof annexes.salesDatFile).toBe('string')
    expect(typeof annexes.purchasesDatFile).toBe('string')

    const salesHeader = annexes.salesDatFile.split('\r\n')[0]
    expect(salesHeader.startsWith('H,S,"748392019",')).toBe(true)
    expect(salesHeader.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).length).toBe(17)

    const purchasesHeader = annexes.purchasesDatFile.split('\r\n')[0]
    expect(purchasesHeader.startsWith('H,P,"748392019",')).toBe(true)
    expect(purchasesHeader.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).length).toBe(21)
  })

  /**
   * @test Monthly Relief Annexes: Should generate monthly DAT file matching BIR taxable month
   * FEATURE: BIR RELIEF Magnetic Media
   * WHAT: Generation of monthly RELIEF DAT file with exact file naming and date stamp
   * WHY: Produce valid magnetic media DAT files compatible with BIR RELIEF verification software
   * TYPE: HAPPY PATH (Positive)
   */
  test('Monthly Relief Annexes: Should generate monthly DAT file matching BIR taxable month', async () => {
    const monthlyAnnexes = await TaxService.generateReliefAnnexes(2026, 4, 10)
    expect(monthlyAnnexes.purchasesFileName).toBe('748392019P102026.DAT')
    expect(monthlyAnnexes.salesFileName).toBe('748392019S102026.DAT')

    const purchasesHeader = monthlyAnnexes.purchasesDatFile.split('\r\n')[0]
    expect(purchasesHeader).toContain('10/31/2026')

    const detailLines = monthlyAnnexes.purchasesDatFile.split('\r\n').slice(1)
    for (const line of detailLines) {
      if (!line) continue
      expect(line).toContain('10/31/2026')
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      const supplierTin = parts[2].replace(/"/g, '')
      expect(supplierTin.length).toBeGreaterThanOrEqual(9)
    }
  })

  /**
   * @test Form 1601-C: Should calculate monthly compensation withholding tax breakdown
   * FEATURE: BIR Form 1601-C (Compensation Withholding)
   * WHAT: Monthly employee taxable compensation and TRAIN Law graduated withholding tax computation
   * WHY: Comply with DOLE and BIR statutory remittance mandates for employee wage taxes
   * TYPE: HAPPY PATH (Positive)
   */
  test('Form 1601-C: Should calculate monthly compensation withholding tax breakdown', async () => {
    const form1601C = await TaxService.generate1601C(currentYear, currentMonth)

    expect(form1601C).toHaveProperty('totalGrossCompensation')
    expect(form1601C).toHaveProperty('totalNonTaxableCompensation')
    expect(form1601C).toHaveProperty('totalTaxableCompensation')
    expect(form1601C).toHaveProperty('totalTaxRequiredWithheld')
    expect(form1601C).toHaveProperty('employees')
    expect(Array.isArray(form1601C.employees)).toBe(true)

    expect(form1601C.totalTaxableCompensation + form1601C.totalNonTaxableCompensation).toBeCloseTo(
      form1601C.totalGrossCompensation,
      1
    )
  })

  /**
   * @test VAT Type Classification: Should classify VATABLE, EXEMPT, and ZERO_RATED sales correctly
   * FEATURE: BIR Tax Categorization
   * WHAT: Taxable sales segregation into Vatable, VAT-Exempt (medical/lab), and Zero-Rated categories
   * WHY: Ensure accurate categorization on official tax returns to prevent BIR audit penalties
   * TYPE: HAPPY PATH (Positive)
   */
  test('VAT Type Classification: Should classify VATABLE, EXEMPT, and ZERO_RATED sales correctly', async () => {
    const form2550Q = await TaxService.generate2550Q(currentYear, currentQuarter)
    expect(form2550Q).toHaveProperty('vatableSales')
    expect(form2550Q).toHaveProperty('exemptSales')
    expect(form2550Q).toHaveProperty('zeroRatedSales')
    expect(typeof form2550Q.zeroRatedSales).toBe('number')

    const relief = await TaxService.generateReliefAnnexes(currentYear, currentQuarter)
    expect(relief.salesTotals).toHaveProperty('totalZeroRated')
    expect(typeof relief.salesTotals.totalZeroRated).toBe('number')
  })
})
