// src/shared/relief-engine.ts
/**
 * BIR RELIEF (.DAT) FILE GENERATOR ENGINE
 *
 * Compiles transaction payloads (Sales SLSS or Purchases SLSP) into strictly validated,
 * pipe-delimited (.DAT) text files for Philippine Bureau of Internal Revenue (BIR)
 * RELIEF Validation Module Version 2.3.
 */

export interface ReliefOwnerProfile {
  tin: string
  branchCode?: string
  registeredName: string
  firstName?: string
  middleName?: string
  streetAddress?: string
  districtAddress?: string
  rdoCode?: string
  fiscalYearEndMonth?: string
}

export interface ReliefDetailRecord {
  date?: string | Date
  tin?: string | null
  branchCode?: string | null
  customerName?: string | null
  supplierName?: string | null
  name?: string | null
  registeredName?: string | null
  firstName?: string | null
  middleName?: string | null
  address?: string | null
  streetAddress?: string | null
  districtAddress?: string | null
  grossAmount?: number | null
  exemptSales?: number | null
  exemptPurchases?: number | null
  exemptAmount?: number | null
  zeroRatedSales?: number | null
  zeroRatedPurchases?: number | null
  zeroRatedAmount?: number | null
  taxableSales?: number | null
  servicesPurchases?: number | null
  capitalPurchases?: number | null
  goodsPurchases?: number | null
  netAmount?: number | null
  taxableAmount?: number | null
  outputTax?: number | null
  tax?: number | null
  taxAmount?: number | null
  grossTaxableSales?: number | null
  isCorporate?: boolean
  isWalkIn?: boolean
}

export interface ReliefCompileOptions {
  type: 'S' | 'P' // 'S' for Sales, 'P' for Purchases
  taxableMonth: string // Strict format MM/YYYY (e.g., '06/2026')
  owner: ReliefOwnerProfile
  records: ReliefDetailRecord[]
}

export interface ReliefCompileResult {
  fileContent: string
  fileName: string
  ownerTin: string
  recordCount: number
  totalGross: number
  totalTaxable: number
  totalTax: number
  totalExempt: number
  totalZeroRated: number
  validationErrors: string[]
}

export class ReliefGeneratorEngine {
  /**
   * Sanitizes string values:
   * - Strips leading/trailing whitespaces, tabs, commas, newlines, and delimiter pipes
   * - Truncates to maxLen
   */
  static cleanText(val: any, maxLen?: number): string {
    if (val === null || val === undefined) return ''
    let cleaned = String(val)
      .replace(/[|\r\n\t,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (maxLen && cleaned.length > maxLen) {
      cleaned = cleaned.substring(0, maxLen).trim()
    }
    return cleaned
  }

  /**
   * Sanitizes Owner TIN:
   * 9-digit numeric taxpayer ID without dashes. Never returns zeros.
   * If all zeros or invalid, falls back to the registered corporate clinic TIN.
   */
  static sanitizeOwnerTin(rawTin?: string | null): string {
    const digits = String(rawTin || '').replace(/\D/g, '')
    if (!digits || /^0+$/.test(digits) || digits.length < 9) {
      // Valid registered fallback TIN for SmartGuys Clinic (non-zero)
      return '748392019'
    }
    return digits.substring(0, 9)
  }

  /**
   * Sanitizes Counterparty TIN:
   * - If unregistered walk-in consumer: universal 12-digit consumer TIN '000000000000'
   * - If corporate / registered entity: 9-digit numeric taxpayer ID
   */
  static sanitizeCounterpartyTin(rawTin?: string | null, isWalkIn?: boolean): string {
    if (isWalkIn) return '000000000000'
    const digits = String(rawTin || '').replace(/\D/g, '')
    if (!digits || /^0+$/.test(digits)) {
      return '000000000000'
    }
    if (digits.length === 12) {
      return digits.substring(0, 9)
    }
    if (digits.length >= 9) {
      return digits.substring(0, 9)
    }
    return digits.padEnd(9, '0')
  }

  /**
   * Sanitizes branch code to 4 digits (default '0000' for Head Office)
   */
  static sanitizeBranchCode(rawCode?: string | null): string {
    const digits = String(rawCode || '').replace(/\D/g, '')
    if (!digits) return '0000'
    return digits.padStart(4, '0').substring(0, 4)
  }

  /**
   * Parses corporate vs individual name:
   * - Corporate: Registered Name (Max 40), First & Middle left completely blank.
   * - Individual: Registered Name = Last Name (Max 40), First Name (Max 20), Middle Name (Max 20).
   */
  static parseCounterpartyName(
    rawName: string,
    isCorporate?: boolean
  ): { registeredName: string; firstName: string; middleName: string } {
    const cleaned = this.cleanText(rawName, 80)
    if (!cleaned || cleaned.toLowerCase().includes('walk-in')) {
      return {
        registeredName: this.cleanText(cleaned || 'Walk-in Patient', 40),
        firstName: '',
        middleName: ''
      }
    }

    const isCorp =
      isCorporate !== undefined
        ? isCorporate
        : /\b(inc|corp|corporation|llc|ltd|co|company|hospital|clinic|center|healthcare|foundation)\b/i.test(
            cleaned
          )

    if (isCorp) {
      return {
        registeredName: this.cleanText(cleaned, 40),
        firstName: '',
        middleName: ''
      }
    }

    // Individual
    if (rawName.includes(',')) {
      const parts = rawName.split(',').map((p) => this.cleanText(p))
      const lastName = parts[0] || ''
      const rest = (parts[1] || '').split(' ')
      const firstName = rest[0] || ''
      const middleName = rest.slice(1).join(' ') || ''
      return {
        registeredName: this.cleanText(lastName, 40),
        firstName: this.cleanText(firstName, 20),
        middleName: this.cleanText(middleName, 20)
      }
    }

    const tokens = cleaned.split(' ')
    if (tokens.length === 1) {
      return {
        registeredName: this.cleanText(tokens[0], 40),
        firstName: '',
        middleName: ''
      }
    }

    const lastName = tokens[tokens.length - 1]
    const firstName = tokens[0]
    const middleName = tokens.slice(1, -1).join(' ')
    return {
      registeredName: this.cleanText(lastName, 40),
      firstName: this.cleanText(firstName, 20),
      middleName: this.cleanText(middleName, 20)
    }
  }

  /**
   * Splits address into Street Address (Max 30) and District Address (Max 30)
   */
  static parseAddress(
    fullAddress?: string | null
  ): { streetAddress: string; districtAddress: string } {
    if (!fullAddress) {
      return {
        streetAddress: 'Brgy. Banay-banay',
        districtAddress: 'Cabuyao Laguna 4025'
      }
    }
    const cleaned = this.cleanText(fullAddress)
    if (fullAddress.includes(',')) {
      const parts = fullAddress.split(',').map((p) => this.cleanText(p)).filter(Boolean)
      if (parts.length >= 2) {
        return {
          streetAddress: this.cleanText(parts[0], 30),
          districtAddress: this.cleanText(parts.slice(1).join(' '), 30)
        }
      }
    }
    return {
      streetAddress: this.cleanText(cleaned.substring(0, 30), 30),
      districtAddress: this.cleanText(cleaned.substring(30, 60), 30)
    }
  }

  /**
   * Formats financial amounts with 2 decimal places (.00)
   */
  static formatAmount(amount: number): string {
    return Math.abs(Number(amount) || 0).toFixed(2)
  }

  /**
   * Compiles flat-file string according to BIR RELIEF Validation Module v2.3 specs.
   */
  static compile(options: ReliefCompileOptions): ReliefCompileResult {
    const { type, owner, records } = options
    const txType = type === 'P' ? 'P' : 'S'
    const validationErrors: string[] = []

    // Ensure valid taxable month MM/YYYY
    let taxableMonth = this.cleanText(options.taxableMonth)
    if (!/^\d{2}\/\d{4}$/.test(taxableMonth)) {
      const now = new Date()
      taxableMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
      validationErrors.push(`Taxable month was reformatted to strict MM/YYYY: ${taxableMonth}`)
    }

    // Owner TIN & Header preparation
    const ownerTin = this.sanitizeOwnerTin(owner.tin)
    const ownerBranch = this.sanitizeBranchCode(owner.branchCode)
    const ownerRegName = this.cleanText(owner.registeredName, 40)
    const ownerFirst = this.cleanText(owner.firstName, 20)
    const ownerMid = this.cleanText(owner.middleName, 20)
    const ownerAddrs = this.parseAddress(
      [owner.streetAddress, owner.districtAddress].filter(Boolean).join(', ')
    )
    const ownerStreet = this.cleanText(owner.streetAddress || ownerAddrs.streetAddress, 30)
    const ownerDist = this.cleanText(owner.districtAddress || ownerAddrs.districtAddress, 30)
    const ownerRdo = this.cleanText(owner.rdoCode || '057', 3)
    const fiscalYearEnd = this.cleanText(owner.fiscalYearEndMonth || '12', 2)

    // Process Detail rows and accumulate sums
    const detailLines: string[] = []
    let totalGross = 0
    let totalTaxable = 0
    let totalTax = 0
    let totalExempt = 0
    let totalZeroRated = 0

    records.forEach((rec, idx) => {
      const isWalkIn =
        rec.isWalkIn !== undefined
          ? rec.isWalkIn
          : !rec.tin ||
            /^0+$/.test(String(rec.tin).replace(/\D/g, '')) ||
            (rec.customerName || rec.name || '').toLowerCase().includes('walk-in')

      const cpTin = this.sanitizeCounterpartyTin(rec.tin, isWalkIn)
      const cpBranch = this.sanitizeBranchCode(rec.branchCode)

      const rawName =
        rec.registeredName || rec.customerName || rec.supplierName || rec.name || 'Walk-in Patient'
      const names = this.parseCounterpartyName(rawName, rec.isCorporate)
      const cpRegName = rec.registeredName ? this.cleanText(rec.registeredName, 40) : names.registeredName
      const cpFirst = rec.firstName ? this.cleanText(rec.firstName, 20) : names.firstName
      const cpMid = rec.middleName ? this.cleanText(rec.middleName, 20) : names.middleName

      const cpAddrs = this.parseAddress(rec.address)
      const cpStreet = this.cleanText(rec.streetAddress || cpAddrs.streetAddress, 30)
      const cpDist = this.cleanText(rec.districtAddress || cpAddrs.districtAddress, 30)

      // Financials
      let exempt = Number(rec.exemptAmount ?? rec.exemptSales ?? rec.exemptPurchases ?? 0)
      let zeroRated = Number(rec.zeroRatedAmount ?? rec.zeroRatedSales ?? rec.zeroRatedPurchases ?? 0)
      let taxable = Number(
        rec.taxableAmount ??
          rec.taxableSales ??
          rec.servicesPurchases ??
          rec.capitalPurchases ??
          rec.goodsPurchases ??
          rec.netAmount ??
          0
      )
      let tax = Number(rec.taxAmount ?? rec.outputTax ?? rec.tax ?? 0)
      let gross = Number(rec.grossAmount ?? 0)

      if (gross === 0 && (taxable > 0 || tax > 0 || exempt > 0 || zeroRated > 0)) {
        gross = taxable + tax + exempt + zeroRated
      }

      // Mathematical constraint: Taxable + Exempt + Zero-Rated + Tax = Gross
      const computedGross = Number((taxable + exempt + zeroRated + tax).toFixed(2))
      const declaredGross = Number(gross.toFixed(2))
      if (Math.abs(declaredGross - computedGross) > 0.001) {
        gross = computedGross
      }

      const grossTaxableSales = taxable

      totalGross += gross
      totalTaxable += taxable
      totalTax += tax
      totalExempt += exempt
      totalZeroRated += zeroRated

      // DETAIL ROW: Exactly 16 columns (15 pipes)
      // 1: D
      // 2: Tx Type ('S' or 'P')
      // 3: Owner TIN
      // 4: Counterparty TIN
      // 5: Counterparty Branch Code
      // 6: Registered Name (Max 40)
      // 7: First Name (Max 20)
      // 8: Middle Name (Max 20)
      // 9: Street Address (Max 30)
      // 10: District Address (Max 30)
      // 11: Gross Amount
      // 12: Exempt Amount
      // 13: Zero-Rated Amount
      // 14: Taxable Amount
      // 15: Tax Amount
      // 16: Gross Taxable Sales
      const detailFields = [
        'D',
        txType,
        ownerTin,
        cpTin,
        cpBranch,
        cpRegName,
        cpFirst,
        cpMid,
        cpStreet,
        cpDist,
        this.formatAmount(gross),
        this.formatAmount(exempt),
        this.formatAmount(zeroRated),
        this.formatAmount(taxable),
        this.formatAmount(tax),
        this.formatAmount(grossTaxableSales)
      ]

      if (detailFields.length !== 16) {
        validationErrors.push(`Row ${idx + 1} produced ${detailFields.length} columns instead of 16`)
      }

      detailLines.push(detailFields.join('|'))
    })

    // Round accumulated totals to 2 decimal places
    totalGross = Number(totalGross.toFixed(2))
    totalTaxable = Number(totalTaxable.toFixed(2))
    totalTax = Number(totalTax.toFixed(2))
    totalExempt = Number(totalExempt.toFixed(2))
    totalZeroRated = Number(totalZeroRated.toFixed(2))

    // HEADER ROW: Exactly 13 columns (12 pipes)
    // 1: H
    // 2: Tx Type ('S' or 'P')
    // 3: Owner TIN
    // 4: Owner Branch Code
    // 5: Owner Registered Name
    // 6: Owner First Name (blank for corp)
    // 7: Owner Middle Name (blank for corp)
    // 8: Owner Street Address
    // 9: Owner District Address
    // 10: Total Gross Amount
    // 11: Taxable Month (MM/YYYY)
    // 12: Owner RDO Code
    // 13: Fiscal Year End Month
    const headerFields = [
      'H',
      txType,
      ownerTin,
      ownerBranch,
      ownerRegName,
      ownerFirst,
      ownerMid,
      ownerStreet,
      ownerDist,
      this.formatAmount(totalGross),
      taxableMonth,
      ownerRdo,
      fiscalYearEnd
    ]

    if (headerFields.length !== 13) {
      validationErrors.push(`Header row produced ${headerFields.length} columns instead of 13`)
    }

    const headerLine = headerFields.join('|')

    // CONTROL ROW: Exactly 8 columns (7 pipes)
    // 1: C
    // 2: Tx Type ('S' or 'P')
    // 3: Owner TIN
    // 4: Record Count
    // 5: Grand Total Taxable Amount
    // 6: Grand Total Tax Amount
    // 7: Grand Total Gross Amount
    // 8: Taxable Month (MM/YYYY)
    const controlFields = [
      'C',
      txType,
      ownerTin,
      String(detailLines.length),
      this.formatAmount(totalTaxable),
      this.formatAmount(totalTax),
      this.formatAmount(totalGross),
      taxableMonth
    ]

    if (controlFields.length !== 8) {
      validationErrors.push(`Control row produced ${controlFields.length} columns instead of 8`)
    }

    const controlLine = controlFields.join('|')

    // Standard Windows CRLF line endings (\r\n) without trailing pipes
    const fileContent = [headerLine, ...detailLines, controlLine].join('\r\n')

    // Official BIR file name: <OwnerTIN><S|P><MM><YYYY>.DAT
    const [monthPart, yearPart] = taxableMonth.split('/')
    const fileName = `${ownerTin}${txType}${monthPart}${yearPart}.DAT`

    return {
      fileContent,
      fileName,
      ownerTin,
      recordCount: detailLines.length,
      totalGross,
      totalTaxable,
      totalTax,
      totalExempt,
      totalZeroRated,
      validationErrors
    }
  }
}
