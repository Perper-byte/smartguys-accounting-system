// src/shared/relief-engine.ts
/**
 * BIR RELIEF (.DAT) FILE GENERATOR ENGINE
 *
 * Compiles transaction payloads (Sales SLS or Purchases SLP) into strictly validated,
 * comma-delimited (.DAT) text files for Philippine Bureau of Internal Revenue (BIR)
 * RELIEF Validation Module Version 2.3.
 */

export interface ReliefOwnerProfile {
  tin: string
  branchCode?: string
  registeredName: string
  tradeName?: string
  firstName?: string
  middleName?: string
  lastName?: string
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
  lastName?: string | null
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
  taxableMonth: string // Format MM/YYYY (e.g., '12/2026')
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
   * - Strips quotes, commas, pipes, newlines, and tabs
   * - Truncates to maxLen
   */
  static cleanText(val: any, maxLen?: number): string {
    if (val === null || val === undefined) return ''
    let cleaned = String(val)
      .replace(/["'|,\r\n\t]+/g, ' ')
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
      return '748392019'
    }
    return digits.substring(0, 9)
  }

  /**
   * Sanitizes Counterparty TIN:
   * - If unregistered walk-in consumer or invalid/all-zero: returns empty string ''
   * - If corporate / registered entity: 9-digit numeric taxpayer ID
   */
  static sanitizeCounterpartyTin(rawTin?: string | null, isWalkIn?: boolean): string {
    if (isWalkIn) return ''
    const digits = String(rawTin || '').replace(/\D/g, '')
    if (!digits || /^0+$/.test(digits)) {
      return ''
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
   * - Corporate: Registered Name (Max 50), First, Middle, & Last Name left empty.
   * - Individual: Registered Name left empty; Last Name (Max 30), First Name (Max 30), Middle Name (Max 30).
   */
  static parseCounterpartyName(
    rawName: string,
    isCorporate?: boolean
  ): { registeredName: string; firstName: string; middleName: string; lastName: string } {
    const cleaned = this.cleanText(rawName, 50)
    if (!cleaned || cleaned.toLowerCase().includes('walk-in')) {
      return {
        registeredName: '',
        lastName: this.cleanText(cleaned || 'Walk-in Patient', 30),
        firstName: '',
        middleName: ''
      }
    }

    const isCorp =
      isCorporate !== undefined
        ? isCorporate
        : /\b(inc|corp|corporation|llc|ltd|co|company|hospital|clinic|center|healthcare|foundation|pharmacy|laboratories|enterprises)\b/i.test(
            cleaned
          )

    if (isCorp) {
      return {
        registeredName: this.cleanText(cleaned, 50),
        lastName: '',
        firstName: '',
        middleName: ''
      }
    }

    // Individual: Last, First Middle
    if (rawName.includes(',')) {
      const parts = rawName.split(',').map((p) => this.cleanText(p))
      const lastName = parts[0] || ''
      const rest = (parts[1] || '').split(' ')
      const firstName = rest[0] || ''
      const middleName = rest.slice(1).join(' ') || ''
      return {
        registeredName: '',
        lastName: this.cleanText(lastName, 30),
        firstName: this.cleanText(firstName, 30),
        middleName: this.cleanText(middleName, 30)
      }
    }

    const tokens = cleaned.split(' ')
    if (tokens.length === 1) {
      return {
        registeredName: '',
        lastName: this.cleanText(tokens[0], 30),
        firstName: '',
        middleName: ''
      }
    }

    const lastName = tokens[tokens.length - 1]
    const firstName = tokens[0]
    const middleName = tokens.slice(1, -1).join(' ')
    return {
      registeredName: '',
      lastName: this.cleanText(lastName, 30),
      firstName: this.cleanText(firstName, 30),
      middleName: this.cleanText(middleName, 30)
    }
  }

  /**
   * Splits address into Street Address (Max 30) and District Address / City (Max 30)
   */
  static parseAddress(
    fullAddress?: string | null
  ): { streetAddress: string; districtAddress: string } {
    if (!fullAddress) {
      return {
        streetAddress: 'Brgy Banay-banay',
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
   * Returns end-of-month date string in MM/DD/YYYY format.
   * e.g., '12/2026' -> '12/31/2026'
   */
  static getMonthEndDate(taxableMonth: string): string {
    const parts = taxableMonth.split('/')
    if (parts.length === 3) {
      return taxableMonth
    }
    const mm = parseInt(parts[0], 10) || 1
    const yyyy = parseInt(parts[1], 10) || new Date().getFullYear()
    const lastDay = new Date(yyyy, mm, 0).getDate()
    return `${String(mm).padStart(2, '0')}/${String(lastDay).padStart(2, '0')}/${yyyy}`
  }

  /**
   * Compiles flat-file string according to BIR RELIEF Validation Module v2.3 specs.
   * Format: Comma-delimited with quoted text fields; NO Control 'C' record.
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

    const [monthPart, yearPart] = taxableMonth.split('/')
    const monthEndDate = this.getMonthEndDate(taxableMonth)

    // Owner Profile Preparation
    const ownerTin = this.sanitizeOwnerTin(owner.tin)
    const isOwnerCorp =
      !owner.lastName &&
      !owner.firstName &&
      (Boolean(owner.registeredName) ||
        /\b(inc|corp|corporation|center|clinic|healthcare)\b/i.test(owner.registeredName || ''))

    const ownerRegName = isOwnerCorp ? this.cleanText(owner.registeredName, 50) : ''
    const ownerLastName = !isOwnerCorp ? this.cleanText(owner.lastName || owner.registeredName, 30) : ''
    const ownerFirstName = !isOwnerCorp ? this.cleanText(owner.firstName, 30) : ''
    const ownerMiddleName = !isOwnerCorp ? this.cleanText(owner.middleName, 30) : ''

    const ownerTrade = this.cleanText(
      owner.tradeName || owner.registeredName || 'SMARTGUYS CLINIC',
      40
    )
    const ownerAddrs = this.parseAddress(
      [owner.streetAddress, owner.districtAddress].filter(Boolean).join(', ')
    )
    const ownerStreet = this.cleanText(owner.streetAddress || ownerAddrs.streetAddress, 30)
    const ownerCity = this.cleanText(owner.districtAddress || ownerAddrs.districtAddress, 30)
    const ownerRdo = this.cleanText(owner.rdoCode || '057', 3)
    const fiscalYearEnd = this.cleanText(owner.fiscalYearEndMonth || '12', 2)

    // Process Detail rows and accumulate sums
    const detailLines: string[] = []
    let totalGross = 0
    let totalTaxable = 0
    let totalTax = 0
    let totalExempt = 0
    let totalZeroRated = 0
    let totalService = 0
    let totalCapital = 0
    let totalGoods = 0

    records.forEach((rec) => {
      const isWalkIn =
        rec.isWalkIn !== undefined
          ? rec.isWalkIn
          : !rec.tin ||
            /^0+$/.test(String(rec.tin).replace(/\D/g, '')) ||
            (rec.customerName || rec.name || '').toLowerCase().includes('walk-in')

      const cpTin = this.sanitizeCounterpartyTin(rec.tin, isWalkIn)
      const rawName =
        rec.registeredName || rec.customerName || rec.supplierName || rec.name || 'Walk-in Patient'
      const names = this.parseCounterpartyName(rawName, rec.isCorporate)

      const cpRegName = rec.registeredName
        ? this.cleanText(rec.registeredName, 50)
        : names.registeredName
      const cpLastName = rec.lastName ? this.cleanText(rec.lastName, 30) : names.lastName
      const cpFirstName = rec.firstName ? this.cleanText(rec.firstName, 30) : names.firstName
      const cpMiddleName = rec.middleName ? this.cleanText(rec.middleName, 30) : names.middleName

      const cpAddrs = this.parseAddress(rec.address)
      const cpStreet = this.cleanText(rec.streetAddress || cpAddrs.streetAddress, 30)
      const cpCity = this.cleanText(rec.districtAddress || cpAddrs.districtAddress, 30)

      // Financials
      const exempt = Number(rec.exemptAmount ?? rec.exemptSales ?? rec.exemptPurchases ?? 0)
      const zeroRated = Number(
        rec.zeroRatedAmount ?? rec.zeroRatedSales ?? rec.zeroRatedPurchases ?? 0
      )
      const service = Number(rec.servicesPurchases ?? 0)
      const capital = Number(rec.capitalPurchases ?? 0)
      const goods = Number(rec.goodsPurchases ?? 0)

      let taxable = Number(
        rec.taxableAmount ??
          rec.taxableSales ??
          (service + capital + goods > 0 ? service + capital + goods : rec.netAmount ?? 0)
      )
      const tax = Number(rec.taxAmount ?? rec.outputTax ?? rec.tax ?? 0)
      let gross = Number(rec.grossAmount ?? 0)

      if (gross === 0 && (taxable > 0 || tax > 0 || exempt > 0 || zeroRated > 0)) {
        gross = taxable + tax + exempt + zeroRated
      }

      const computedGross = Number((taxable + exempt + zeroRated + tax).toFixed(2))
      const declaredGross = Number(gross.toFixed(2))
      if (Math.abs(declaredGross - computedGross) > 0.001) {
        gross = computedGross
      }

      if (gross === 0 && taxable === 0 && tax === 0 && exempt === 0 && zeroRated === 0) {
        return
      }

      // In Purchases (Annex B / SLP), Supplier TIN cannot be empty per BIR Validation Module rules
      if (txType === 'P' && !cpTin) {
        validationErrors.push(
          `Record "${rawName}" skipped: Supplier TIN is empty. BIR requires a valid supplier TIN to claim Input VAT.`
        )
        return
      }

      totalGross += gross
      totalTaxable += taxable
      totalTax += tax
      totalExempt += exempt
      totalZeroRated += zeroRated
      totalService += service
      totalCapital += capital
      totalGoods += goods

      if (txType === 'S') {
        // SALES DETAIL (D,S) - Exactly 15 columns
        // 1: D
        // 2: S
        // 3: Customer TIN
        // 4: Registered Name (Corporate)
        // 5: Last Name (Individual)
        // 6: First Name (Individual)
        // 7: Middle Name (Individual)
        // 8: Street Address
        // 9: District / City Address
        // 10: Exempt Sales
        // 11: Zero-Rated Sales
        // 12: Taxable Sales
        // 13: Output VAT
        // 14: Owner TIN
        // 15: Month End Date (MM/DD/YYYY)
        const line = [
          'D',
          'S',
          `"${cpTin}"`,
          `"${cpRegName}"`,
          `"${cpLastName}"`,
          `"${cpFirstName}"`,
          `"${cpMiddleName}"`,
          `"${cpStreet}"`,
          `"${cpCity}"`,
          this.formatAmount(exempt),
          this.formatAmount(zeroRated),
          this.formatAmount(taxable),
          this.formatAmount(tax),
          `"${ownerTin}"`,
          monthEndDate
        ].join(',')

        detailLines.push(line)
      } else {
        // PURCHASES DETAIL (D,P) - Exactly 17 columns
        // 1: D
        // 2: P
        // 3: Supplier TIN
        // 4: Registered Name (Corporate)
        // 5: Last Name (Individual)
        // 6: First Name (Individual)
        // 7: Middle Name (Individual)
        // 8: Street Address
        // 9: District / City Address
        // 10: Exempt Purchases
        // 11: Zero-Rated Purchases
        // 12: Services Purchases
        // 13: Capital Goods Purchases
        // 14: Other Goods Purchases
        // 15: Input Tax
        // 16: Owner TIN
        // 17: Month End Date (MM/DD/YYYY)
        const line = [
          'D',
          'P',
          `"${cpTin}"`,
          `"${cpRegName}"`,
          `"${cpLastName}"`,
          `"${cpFirstName}"`,
          `"${cpMiddleName}"`,
          `"${cpStreet}"`,
          `"${cpCity}"`,
          this.formatAmount(exempt),
          this.formatAmount(zeroRated),
          this.formatAmount(service || taxable),
          this.formatAmount(capital),
          this.formatAmount(goods),
          this.formatAmount(tax),
          `"${ownerTin}"`,
          monthEndDate
        ].join(',')

        detailLines.push(line)
      }
    })

    // Round accumulated totals to 2 decimal places
    totalGross = Number(totalGross.toFixed(2))
    totalTaxable = Number(totalTaxable.toFixed(2))
    totalTax = Number(totalTax.toFixed(2))
    totalExempt = Number(totalExempt.toFixed(2))
    totalZeroRated = Number(totalZeroRated.toFixed(2))
    totalService = Number(totalService.toFixed(2))
    totalCapital = Number(totalCapital.toFixed(2))
    totalGoods = Number(totalGoods.toFixed(2))

    let headerLine = ''
    if (txType === 'S') {
      // SALES HEADER (H,S) - Exactly 17 columns
      // 1: H
      // 2: S
      // 3: Owner TIN
      // 4: Owner Registered Name (Corporate)
      // 5: Owner Last Name (Individual)
      // 6: Owner First Name (Individual)
      // 7: Owner Middle Name (Individual)
      // 8: Trade Name
      // 9: Street Address
      // 10: District / City Address
      // 11: Total Exempt Sales
      // 12: Total Zero-Rated Sales
      // 13: Total Taxable Sales
      // 14: Total Output VAT
      // 15: Owner RDO Code
      // 16: Month End Date (MM/DD/YYYY)
      // 17: Fiscal Year End Month
      headerLine = [
        'H',
        'S',
        `"${ownerTin}"`,
        `"${ownerRegName}"`,
        `"${ownerLastName}"`,
        `"${ownerFirstName}"`,
        `"${ownerMiddleName}"`,
        `"${ownerTrade}"`,
        `"${ownerStreet}"`,
        `"${ownerCity}"`,
        this.formatAmount(totalExempt),
        this.formatAmount(totalZeroRated),
        this.formatAmount(totalTaxable),
        this.formatAmount(totalTax),
        ownerRdo,
        monthEndDate,
        fiscalYearEnd
      ].join(',')
    } else {
      // PURCHASES HEADER (H,P) - Exactly 21 columns
      // 1: H
      // 2: P
      // 3: Owner TIN
      // 4: Owner Registered Name (Corporate)
      // 5: Owner Last Name (Individual)
      // 6: Owner First Name (Individual)
      // 7: Owner Middle Name (Individual)
      // 8: Trade Name
      // 9: Street Address
      // 10: District / City Address
      // 11: Total Exempt Purchases
      // 12: Total Zero-Rated Purchases
      // 13: Total Services Purchases
      // 14: Total Capital Goods Purchases
      // 15: Total Other Goods Purchases
      // 16: Total Input Tax
      // 17: Total Creditable Input Tax (input tax - non-creditable)
      // 18: Total Non-Creditable Input Tax (0.00)
      // 19: Owner RDO Code
      // 20: Month End Date (MM/DD/YYYY)
      // 21: Fiscal Year End Month
      const nonCreditable = 0
      const creditable = totalTax - nonCreditable
      headerLine = [
        'H',
        'P',
        `"${ownerTin}"`,
        `"${ownerRegName}"`,
        `"${ownerLastName}"`,
        `"${ownerFirstName}"`,
        `"${ownerMiddleName}"`,
        `"${ownerTrade}"`,
        `"${ownerStreet}"`,
        `"${ownerCity}"`,
        this.formatAmount(totalExempt),
        this.formatAmount(totalZeroRated),
        this.formatAmount(totalService || totalTaxable),
        this.formatAmount(totalCapital),
        this.formatAmount(totalGoods),
        this.formatAmount(totalTax),
        this.formatAmount(creditable),
        this.formatAmount(nonCreditable),
        ownerRdo,
        monthEndDate,
        fiscalYearEnd
      ].join(',')
    }

    // Windows CRLF line endings (\r\n); NO Control ('C') record in BIR RELIEF v2.3
    const fileContent = [headerLine, ...detailLines].join('\r\n')

    // Official BIR file name: <OwnerTIN><S|P><MM><YYYY>.DAT
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


