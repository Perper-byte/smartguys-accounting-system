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

  test('Delimiters & Structure: Verifies comma delimiters, quoted strings, and row counts (NO C row)', () => {
    const compileOptions: ReliefCompileOptions = {
      type: 'S',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: sampleSalesRecords
    }

    const result = ReliefGeneratorEngine.compile(compileOptions)
    const lines = result.fileContent.split('\r\n')

    // BIR RELIEF v2.3 has ONLY Header (H) and Details (D) - NO Control (C) row
    expect(lines.length).toBe(4) // 1 Header + 3 Details

    // 1. Header Line: Exactly 17 columns
    const headerLine = lines[0]
    expect(headerLine.startsWith('H,S,"748392019",')).toBe(true)
    const headerCols = headerLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/) // split by comma outside quotes
    expect(headerCols.length).toBe(17)
    expect(headerLine.endsWith(',')).toBe(false)

    // 2. Detail Lines: Exactly 15 columns
    for (let i = 1; i <= 3; i++) {
      const detailLine = lines[i]
      expect(detailLine.startsWith('D,S,')).toBe(true)
      const detailCols = detailLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      expect(detailCols.length).toBe(15)
      expect(detailLine.endsWith(',')).toBe(false)
    }

    // Must NOT contain any 'C' control record (prevents 'Invalid Header/Detail Code' error)
    expect(lines.some((l) => l.startsWith('C,'))).toBe(false)
  })

  test('TIN Rules: Owner TIN is non-zero 9 digits; unregistered consumer TIN is empty string', () => {
    // Test owner with 000-000-000 -> must fall back to non-zero valid corporate TIN
    const zeroOwner = { ...sampleOwner, tin: '000-000-000-000' }
    const result = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: '06/2026',
      owner: zeroOwner,
      records: sampleSalesRecords
    })

    const lines = result.fileContent.split('\r\n')
    const headerCols = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    const ownerTin = headerCols[2].replace(/"/g, '')

    // Crucial: Owner TIN must never be zeros and must be 9 digits
    expect(ownerTin).not.toBe('000000000')
    expect(ownerTin.length).toBe(9)
    expect(/^\d{9}$/.test(ownerTin)).toBe(true)

    // Detail Line 2: Walk-in consumer TIN must be empty string '""' (never dummy zeros '000000000')
    const walkInCols = lines[2].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(walkInCols[2]).toBe('""')

    // Detail Line 1: Corporate TIN must be 9 digits
    const corpCols = lines[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(corpCols[2]).toBe('"123456789"')

    // Detail Line 3: Individual TIN must be 9 digits
    const indCols = lines[3].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(indCols[2]).toBe('"987654321"')
  })

  test('Corporate vs Individual Name Formatting: First and middle left completely blank for corporate', () => {
    const result = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: sampleSalesRecords
    })

    const lines = result.fileContent.split('\r\n')

    // Header (Corporate Owner): First, Middle, Last empty
    const headerCols = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(headerCols[3]).toBe('"SMARTGUYS COMMUNITY HEALTHCARE INC."')
    expect(headerCols[4]).toBe('""')
    expect(headerCols[5]).toBe('""')
    expect(headerCols[6]).toBe('""')

    // Detail 1 (Maxicare - Corporate): RegName populated, names empty
    const corpCols = lines[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(corpCols[3]).toBe('"Maxicare Healthcare Corp."')
    expect(corpCols[4]).toBe('""')
    expect(corpCols[5]).toBe('""')
    expect(corpCols[6]).toBe('""')

    // Detail 3 (Dela Cruz, Juan M. - Individual): RegName empty, names populated
    const indCols = lines[3].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(indCols[3]).toBe('""')
    expect(indCols[4]).toBe('"Dela Cruz"')
    expect(indCols[5]).toBe('"Juan"')
    expect(indCols[6]).toBe('"M."')
  })

  test('Mathematical Integrity: Sum of Details matches Header Totals', () => {
    const result = ReliefGeneratorEngine.compile({
      type: 'S',
      taxableMonth: '06/2026',
      owner: sampleOwner,
      records: sampleSalesRecords
    })

    const lines = result.fileContent.split('\r\n')
    const headerCols = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)

    const headerExempt = parseFloat(headerCols[10])
    const headerZeroRated = parseFloat(headerCols[11])
    const headerTaxable = parseFloat(headerCols[12])
    const headerTax = parseFloat(headerCols[13])

    expect(headerTaxable).toBeCloseTo(12000.0, 2) // 10000 + 2000
    expect(headerTax).toBeCloseTo(1440.0, 2) // 1200 + 240
    expect(headerExempt).toBeCloseTo(1500.0, 2)
    expect(headerZeroRated).toBeCloseTo(0.0, 2)

    // Month End Date properly computed as 06/30/2026
    expect(headerCols[15]).toBe('06/30/2026')
    expect(headerCols[16]).toBe('12') // Fiscal Year End Month
  })

  test('Purchases SLSP Compilation: Correct type P, 21 header cols, 17 detail cols, and file naming <TIN>P<MM><YYYY>.DAT', () => {
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
    expect(lines.length).toBe(2) // 1 Header + 1 Detail (NO C row)

    const headerCols = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(headerCols.length).toBe(21)
    expect(lines[0].startsWith('H,P,"748392019",')).toBe(true)

    const detailCols = lines[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    expect(detailCols.length).toBe(17)
    expect(lines[1].startsWith('D,P,"555444333",')).toBe(true)
  })
})
