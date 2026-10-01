// src/renderer/src/utils/dole-rates.ts

export interface DOLERateDef {
  key: string
  label: string
  shortLabel: string
  group: 'REGULAR' | 'SUNDAY' | 'LEGAL' | 'SPECIAL'
  groupLabel: string
  defaultMultiplier: number
  description: string
}

export const ALL_DOLE_RATES: DOLERateDef[] = [
  // REGULAR
  {
    key: 'reg',
    label: 'Regular Base Hours',
    shortLabel: 'REG',
    group: 'REGULAR',
    groupLabel: 'REGULAR (hours)',
    defaultMultiplier: 1.0,
    description: 'Standard 8-hour workday base pay'
  },
  {
    key: 'ot',
    label: 'Regular Overtime',
    shortLabel: 'OT',
    group: 'REGULAR',
    groupLabel: 'REGULAR (hours)',
    defaultMultiplier: 1.25,
    description: 'Work beyond 8 hours on a regular workday (125%)'
  },
  {
    key: 'nd',
    label: 'Regular Night Differential',
    shortLabel: 'ND',
    group: 'REGULAR',
    groupLabel: 'REGULAR (hours)',
    defaultMultiplier: 1.1,
    description: 'Work rendered between 10:00 PM and 6:00 AM (110%)'
  },
  {
    key: 'nd_ot',
    label: 'Regular Night OT',
    shortLabel: 'ND OT',
    group: 'REGULAR',
    groupLabel: 'REGULAR (hours)',
    defaultMultiplier: 1.375,
    description: 'Overtime rendered between 10:00 PM and 6:00 AM (137.5%)'
  },

  // SUNDAY / REST DAY
  {
    key: 'sun_reg',
    label: 'Rest Day Regular',
    shortLabel: 'SUN REG',
    group: 'SUNDAY',
    groupLabel: 'SUNDAY/SATURDAY (hours)',
    defaultMultiplier: 1.3,
    description: 'First 8 hours on a scheduled rest day / weekend (130%)'
  },
  {
    key: 'sun_ot',
    label: 'Rest Day Overtime',
    shortLabel: 'SUN OT',
    group: 'SUNDAY',
    groupLabel: 'SUNDAY/SATURDAY (hours)',
    defaultMultiplier: 1.69,
    description: 'Work beyond 8 hours on a scheduled rest day (169%)'
  },
  {
    key: 'sun_nd',
    label: 'Rest Day Night Diff',
    shortLabel: 'SUN ND',
    group: 'SUNDAY',
    groupLabel: 'SUNDAY/SATURDAY (hours)',
    defaultMultiplier: 1.43,
    description: 'Rest day work between 10:00 PM and 6:00 AM (143%)'
  },
  {
    key: 'sun_nd_ot',
    label: 'Rest Day Night OT',
    shortLabel: 'SUN ND OT',
    group: 'SUNDAY',
    groupLabel: 'SUNDAY/SATURDAY (hours)',
    defaultMultiplier: 1.859,
    description: 'Rest day overtime between 10:00 PM and 6:00 AM (185.9%)'
  },

  // LEGAL HOLIDAY
  {
    key: 'leg_reg',
    label: 'Legal Holiday Regular',
    shortLabel: 'LEG REG',
    group: 'LEGAL',
    groupLabel: 'LEGAL HOLIDAY (hours)',
    defaultMultiplier: 2.0,
    description: 'First 8 hours on a regular / legal national holiday (200%)'
  },
  {
    key: 'leg_ot',
    label: 'Legal Holiday Overtime',
    shortLabel: 'LEG OT',
    group: 'LEGAL',
    groupLabel: 'LEGAL HOLIDAY (hours)',
    defaultMultiplier: 2.6,
    description: 'Work beyond 8 hours on a legal holiday (260%)'
  },
  {
    key: 'leg_nd',
    label: 'Legal Holiday Night Diff',
    shortLabel: 'LEG ND',
    group: 'LEGAL',
    groupLabel: 'LEGAL HOLIDAY (hours)',
    defaultMultiplier: 2.2,
    description: 'Legal holiday work between 10:00 PM and 6:00 AM (220%)'
  },
  {
    key: 'leg_nd_ot',
    label: 'Legal Holiday Night OT',
    shortLabel: 'LEG ND OT',
    group: 'LEGAL',
    groupLabel: 'LEGAL HOLIDAY (hours)',
    defaultMultiplier: 2.86,
    description: 'Legal holiday overtime between 10:00 PM and 6:00 AM (286%)'
  },

  // SPECIAL HOLIDAY
  {
    key: 'spcl_reg',
    label: 'Special Holiday Regular',
    shortLabel: 'SPCL REG',
    group: 'SPECIAL',
    groupLabel: 'SPECIAL HOLIDAY (hours)',
    defaultMultiplier: 1.3,
    description: 'First 8 hours on a special non-working holiday (130%)'
  },
  {
    key: 'spcl_ot',
    label: 'Special Holiday Overtime',
    shortLabel: 'SPCL OT',
    group: 'SPECIAL',
    groupLabel: 'SPECIAL HOLIDAY (hours)',
    defaultMultiplier: 1.69,
    description: 'Work beyond 8 hours on a special holiday (169%)'
  },
  {
    key: 'spcl_nd',
    label: 'Special Holiday Night Diff',
    shortLabel: 'SPCL ND',
    group: 'SPECIAL',
    groupLabel: 'SPECIAL HOLIDAY (hours)',
    defaultMultiplier: 1.43,
    description: 'Special holiday work between 10:00 PM and 6:00 AM (143%)'
  },
  {
    key: 'spcl_nd_ot',
    label: 'Special Holiday Night OT',
    shortLabel: 'SPCL ND OT',
    group: 'SPECIAL',
    groupLabel: 'SPECIAL HOLIDAY (hours)',
    defaultMultiplier: 1.859,
    description: 'Special holiday overtime between 10:00 PM and 6:00 AM (185.9%)'
  }
]

// Clinic Standard Preset (commonly applied rates)
export const CLINIC_STANDARD_RATES = [
  'reg',
  'ot',
  'nd',
  'nd_ot',
  'sun_reg',
  'sun_ot',
  'leg_reg',
  'leg_ot',
  'spcl_reg',
  'spcl_ot'
]

export const ALL_RATE_KEYS = ALL_DOLE_RATES.map((r) => r.key)

export const STORAGE_KEY_ACTIVE_DOLE_RATES = 'smartguys_active_dole_rates'
export const STORAGE_KEY_DOLE_MULTIPLIERS = 'smartguys_dole_multipliers'

export function getActiveDoleRateKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_DOLE_RATES)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Return only keys that exist in ALL_DOLE_RATES
        const valid = parsed.filter((k: string) => ALL_DOLE_RATES.some((r) => r.key === k))
        if (valid.length > 0) return valid
      }
    }
  } catch (err) {
    console.error('Failed to load active DOLE rates', err)
  }
  return ALL_RATE_KEYS
}

export function saveActiveDoleRateKeys(keys: string[]): void {
  // Ensure 'reg' is always active so basic hours work
  const finalKeys = keys.includes('reg') ? keys : ['reg', ...keys]
  localStorage.setItem(STORAGE_KEY_ACTIVE_DOLE_RATES, JSON.stringify(finalKeys))
  window.dispatchEvent(new CustomEvent('smartguys:dole-rates-updated', { detail: finalKeys }))
}

export function getDoleMultipliers(): Record<string, number> {
  const defaults: Record<string, number> = {}
  ALL_DOLE_RATES.forEach((r) => {
    defaults[r.key] = r.defaultMultiplier
  })

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOLE_MULTIPLIERS)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaults, ...parsed }
    }
  } catch (err) {
    console.error('Failed to load DOLE multipliers', err)
  }
  return defaults
}

export function saveDoleMultipliers(multipliers: Record<string, number>): void {
  localStorage.setItem(STORAGE_KEY_DOLE_MULTIPLIERS, JSON.stringify(multipliers))
  window.dispatchEvent(new CustomEvent('smartguys:dole-multipliers-updated', { detail: multipliers }))
}
