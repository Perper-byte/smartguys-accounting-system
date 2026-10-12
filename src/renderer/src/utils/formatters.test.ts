// src/renderer/src/utils/formatters.test.ts
import { cleanDescription } from './formatters'
import { toDateOnly, OFFICIAL_TAXPAYER_HEADER } from '../../../shared/formatters'

describe('Formatters Utility', () => {
  describe('cleanDescription', () => {
    test('returns empty string for null, undefined, or empty inputs', () => {
      expect(cleanDescription(null)).toBe('')
      expect(cleanDescription(undefined)).toBe('')
      expect(cleanDescription('')).toBe('')
      expect(cleanDescription('   ')).toBe('')
    })

    test('retains clean user descriptions without metadata tags', () => {
      const desc = 'Medical checkup consultation fee'
      expect(cleanDescription(desc)).toBe('Medical checkup consultation fee')
    })

    test('strips [META:...] and [ITEMS:...] tags from string', () => {
      const itemsPayload = encodeURIComponent(JSON.stringify([{ name: 'CBC' }]))
      const raw = `Cash receipt [META:{"type":"pos"}] for lab test [ITEMS:${itemsPayload}]`
      const cleaned = cleanDescription(raw)
      expect(cleaned).toBe('Cash receipt for lab test')
    })

    test('falls back to extracting items when cleaning leaves description blank', () => {
      const itemsPayload = encodeURIComponent(
        JSON.stringify([{ description: 'Urinalysis' }, { name: 'X-Ray' }])
      )
      const raw = `[ITEMS:${itemsPayload}] [META:{"tx":"123"}]`
      const cleaned = cleanDescription(raw)
      expect(cleaned).toBe('Urinalysis, X-Ray')
    })
  })

  describe('Shared Formatters & Date Utilities', () => {
    test('OFFICIAL_TAXPAYER_HEADER has compliant BIR CAS details', () => {
      expect(OFFICIAL_TAXPAYER_HEADER.businessName).toBe('SMARTGUYS COMMUNITY HEALTHCARE INC.')
      expect(OFFICIAL_TAXPAYER_HEADER.rdo).toBe('057')
      expect(OFFICIAL_TAXPAYER_HEADER.taxStatus).toBe('VAT Registered')
    })

    test('toDateOnly converts local Date to pure UTC date without timezone drift', () => {
      const date = new Date(2026, 9, 12, 18, 30, 0) // Oct 12, 2026
      const utcDate = toDateOnly(date)
      expect(utcDate.getUTCFullYear()).toBe(2026)
      expect(utcDate.getUTCMonth()).toBe(9)
      expect(utcDate.getUTCDate()).toBe(12)
      expect(utcDate.getUTCHours()).toBe(0)
    })
  })
})
