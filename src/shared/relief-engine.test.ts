// src/shared/relief-engine.test.ts
import { ReliefGeneratorEngine, ReliefCompileOptions } from './relief-engine'

describe('BIR RELIEF (.DAT) File Generator Engine - BIR Validation Module v2.3 Compliance', () => {
  const sampleOwner = {
    tin: '748-392-019-000',
    branchCode: '0000',
    registeredName: 'SMARTGUYS COMMUNITY HEALTHCARE INC.',
    streetAddress: 'Katapatan Mutual Homes',
    districtAddress: 'Cabuyao, Laguna 4025',
    rdoCode: '057',
    fiscalYearEndMonth: '12'
  }

  const sampleSalesRecords = [
    {
      date: '2026-06-15',
      tin: '123-456-789-000',
      branchCode: '0000',
      name: 'Maxicare Healthcare Corp.',
      isCorporate: true,
      address: 'Makati City, Metro Manila',
      taxableAmount: 10000.0,
      taxAmount: 1200.0,
      grossAmount: 11200.0,
      exemptAmount: 0.0,
      zeroRatedAmount: 0.0
    },
    {
      date: '2026-06-18',
      tin: null, // Walk-in unregistered consumer
      name: 'Walk-in Patient',
      isCorporate: false,
      isWalkIn: true,
      address: 'Brgy. Banay-banay, Cabuyao',
      taxableAmount: 0.0,
      taxAmount: 0.0,
      grossAmount: 1500.0,
      exemptAmount: 1500.0,
      zeroRatedAmount: 0.0
    },
    {
      date: '2026-06-20',
      tin: '987-654-321',
      branchCode: '0001',
      name: 'Dela Cruz, Juan M.',
      isCorporate: false,
      address: 'Poblacion, Cabuyao, Laguna',
      taxableAmount: 2000.0,
      taxAmount: 240.0,
      grossAmount: 2240.0,
      exemptAmount: 0.0,
      zeroRatedAmount: 0.0
    }
  ]

  test('Delimiters & Structure: Verifies exact column and pipe counts across all rows', () => {
    const compileOptions: ReliefCompileOptions = {
      type: 'S',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: sampleSalesRecords
    }

    const result = ReliefGeneratorEngine.compile(compileOptions)
    const lines = result.fileContent.split('\r\n')

    expect(lines.length).toBe(5) // 1 Header + 3 Details + 1 Control

    // 1. Header Line: Exactly 13 columns (12 pipes)
    const headerCols = lines[0].split('|')
    expect(headerCols.length).toBe(13)
    expect((lines[0].match(/\|/g) || []).length).toBe(12)
    expect(lines[0].endsWith('|')).toBe(false)
    expect(lines[0].startsWith('H|S|')).toBe(true)

    // 2. Detail Lines: Exactly 16 columns (15 pipes)
    for (let i = 1; i <= 3; i++) {
      const detailCols = lines[i].split('|')
      expect(detailCols.length).toBe(16)
      expect((lines[i].match(/\|/g) || []).length).toBe(15)
      expect(lines[i].endsWith('|')).toBe(false)
      expect(lines[i].startsWith('D|S|')).toBe(true)
    }

    // 3. Control Line: Exactly 8 columns (7 pipes)
    const controlCols = lines[4].split('|')
    expect(controlCols.length).toBe(8)
    expect((lines[4].match(/\|/g) || []).length).toBe(7)
    expect(lines[4].endsWith('|')).toBe(false)
    expect(lines[4].startsWith('C|S|')).toBe(true)
  })

  test('TIN Rules: Owner TIN is non-zero 9 digits; unregistered consumer TIN is 000000000000', () => {
    // Test owner with 000-000-000 -> must fall back to non-zero valid corporate TIN
    const zeroOwner = { ...sampleOwner, tin: '000-000-000-000' }
    const result = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: '06/2026',
      owner: zeroOwner,
      records: sampleSalesRecords
    })

    const lines = result.fileContent.split('\r\n')
    const headerCols = lines[0].split('|')
    const ownerTin = headerCols[2]

    // Crucial: Owner TIN must never be zeros and must be 9 digits
    expect(ownerTin).not.toBe('000000000')
    expect(ownerTin.length).toBe(9)
    expect(/^\d{9}$/.test(ownerTin)).toBe(true)

    // Detail Line 2: Walk-in consumer TIN must be universal 12-digit '000000000000'
    const walkInCols = lines[2].split('|')
    expect(walkInCols[3]).toBe('000000000000')

    // Detail Line 1: Corporate TIN must be 9 digits
    const corpCols = lines[1].split('|')
    expect(corpCols[3]).toBe('123456789')
    expect(corpCols[3].length).toBe(9)

    // Detail Line 3: Individual TIN must be 9 digits
    const indCols = lines[3].split('|')
    expect(indCols[3]).toBe('987654321')
    expect(indCols[3].length).toBe(9)
  })

  test('Corporate vs Individual Name Formatting: First and middle left completely blank for corporate', () => {
    const result = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: sampleSalesRecords
    })

    const lines = result.fileContent.split('\r\n')

    // Header (Corporate Owner): First & Middle empty (columns 5, 6, 7 -> indices 4, 5, 6)
    const headerCols = lines[0].split('|')
    expect(headerCols[4]).toBe('SMARTGUYS COMMUNITY HEALTHCARE INC.')
    expect(headerCols[5]).toBe('')
    expect(headerCols[6]).toBe('')
    expect(lines[0]).toContain('|SMARTGUYS COMMUNITY HEALTHCARE INC.|||') // Name|||Street

    // Detail 1 (Maxicare - Corporate): First & Middle empty
    const corpCols = lines[1].split('|')
    expect(corpCols[5]).toBe('Maxicare Healthcare Corp.')
    expect(corpCols[6]).toBe('')
    expect(corpCols[7]).toBe('')

    // Detail 3 (Dela Cruz, Juan M. - Individual): Registered Name = Last Name, First Name, Middle Name
    const indCols = lines[3].split('|')
    expect(indCols[5]).toBe('Dela Cruz')
    expect(indCols[6]).toBe('Juan')
    expect(indCols[7]).toBe('M.')
  })

  test('Mathematical Integrity: Field 14 + Field 12 + Field 13 + Field 15 = Field 11 (Gross)', () => {
    const result = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: sampleSalesRecords
    })

    const lines = result.fileContent.split('\r\n')

    for (let i = 1; i <= 3; i++) {
      const cols = lines[i].split('|')
      const gross = parseFloat(cols[10])
      const exempt = parseFloat(cols[11])
      const zeroRated = parseFloat(cols[12])
      const taxable = parseFloat(cols[13])
      const tax = parseFloat(cols[14])

      expect(taxable + exempt + zeroRated + tax).toBeCloseTo(gross, 2)
    }

    // Control Row Totals Match Accumulated Details
    const controlCols = lines[4].split('|')
    expect(parseInt(controlCols[3])).toBe(3) // Record Count
    expect(parseFloat(controlCols[4])).toBeCloseTo(12000.0, 2) // Grand Total Taxable (10000 + 2000)
    expect(parseFloat(controlCols[5])).toBeCloseTo(1440.0, 2) // Grand Total Tax (1200 + 240)
    expect(parseFloat(controlCols[6])).toBeCloseTo(14940.0, 2) // Grand Total Gross (11200 + 1500 + 2240)
    expect(controlCols[7]).toBe('06/2026') // Taxable Month
  })

  test('Purchases SLSP Compilation: Correct type P and file naming <TIN>P<MM><YYYY>.DAT', () => {
    const samplePurchases = [
      {
        date: '2026-06-10',
        tin: '555-444-333-000',
        branchCode: '0000',
        name: 'MediPharm Supplies Corp.',
        isCorporate: true,
        address: 'Quezon City, Metro Manila',
        taxableAmount: 50000.0,
        taxAmount: 6000.0,
        grossAmount: 56000.0
      }
    ]

    const result = ReliefGeneratorEngine.compile({
      type: 'P',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: samplePurchases
    })

    expect(result.fileName).toBe('748392019P062026.DAT')

    const lines = result.fileContent.split('\r\n')
    expect(lines[0].startsWith('H|P|748392019|')).toBe(true)
    expect(lines[1].startsWith('D|P|748392019|555444333|')).toBe(true)
    expect(lines[2].startsWith('C|P|748392019|1|')).toBe(true)
  })
})
