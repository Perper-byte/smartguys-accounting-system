// src/renderer/src/utils/dole-rates.test.ts
import {
  ALL_DOLE_RATES,
  ALL_RATE_KEYS,
  getActiveDoleRateKeys,
  saveActiveDoleRateKeys,
  getDoleMultipliers,
  saveDoleMultipliers
} from './dole-rates'

describe('DOLE Rates Utility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('ALL_DOLE_RATES contains standard DOLE wage multipliers', () => {
    expect(ALL_DOLE_RATES.length).toBeGreaterThan(10)

    const regularOt = ALL_DOLE_RATES.find((r) => r.key === 'ot')
    expect(regularOt?.defaultMultiplier).toBe(1.25)

    const restDay = ALL_DOLE_RATES.find((r) => r.key === 'sun_reg')
    expect(restDay?.defaultMultiplier).toBe(1.30)

    const regularHoliday = ALL_DOLE_RATES.find((r) => r.key === 'leg_reg')
    expect(regularHoliday?.defaultMultiplier).toBe(2.00)
  })

  test('getActiveDoleRateKeys returns defaults when storage is empty', () => {
    const keys = getActiveDoleRateKeys()
    expect(keys).toEqual(ALL_RATE_KEYS)
  })

  test('saveActiveDoleRateKeys stores selection and ensures reg key is always retained', () => {
    saveActiveDoleRateKeys(['ot', 'sun_reg'])
    const active = getActiveDoleRateKeys()

    expect(active).toContain('reg')
    expect(active).toContain('ot')
    expect(active).toContain('sun_reg')
  })

  test('getDoleMultipliers merges default multipliers with saved custom multipliers', () => {
    const defaults = getDoleMultipliers()
    expect(defaults['ot']).toBe(1.25)

    saveDoleMultipliers({ ot: 1.30 })
    const updated = getDoleMultipliers()
    expect(updated['ot']).toBe(1.30)
  })
})
