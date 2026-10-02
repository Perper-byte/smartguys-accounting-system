export interface StatutoryEnabledConfig {
  sss: boolean
  philhealth: boolean
  pagibig: boolean
  withholdingTax: boolean
}

export const DEFAULT_STATUTORY_ENABLED: StatutoryEnabledConfig = {
  sss: true,
  philhealth: true,
  pagibig: true,
  withholdingTax: true
}

const STORAGE_KEY_STATUTORY_ENABLED = 'smartguys:statutory-enabled'

export function getStatutoryEnabledConfig(): StatutoryEnabledConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATUTORY_ENABLED)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        sss: parsed.sss !== false,
        philhealth: parsed.philhealth !== false,
        pagibig: parsed.pagibig !== false,
        withholdingTax: parsed.withholdingTax !== false
      }
    }
  } catch (e) {
    console.error('Failed to parse statutory enabled config', e)
  }
  return { ...DEFAULT_STATUTORY_ENABLED }
}

export function saveStatutoryEnabledConfig(config: StatutoryEnabledConfig): void {
  localStorage.setItem(STORAGE_KEY_STATUTORY_ENABLED, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('smartguys:statutory-rates-updated'))
}

export interface PhilHealthConfig {
  rate: number // e.g. 5.0 (%)
  minSalary: number // 10000
  maxSalary: number // 100000
  employeeSharePercentage: number // 50 (%)
  employerSharePercentage: number // 50 (%)
}

export interface PagIbigConfig {
  employeeRateBelow1500: number // 1.0 (%)
  employeeRateAbove1500: number // 2.0 (%)
  employerRate: number // 2.0 (%)
  maxMonthlyCompensation: number // 10000 (MFS cap)
  maxContribution: number // 200 (max share)
}

export interface WithholdingTaxBracket {
  id: number
  rangeLabel: string
  minIncome: number
  maxIncome: number | null
  baseTax: number
  rate: number // decimal e.g. 0.20
  ratePercentage: number // 20 (%)
  excessOver: number
  description: string
}

export interface SSSBracket {
  id: number
  rangeLabel: string
  minComp: number
  maxComp: number | null // null for Over
  regularMsc: number
  mpfMsc: number
  totalMsc: number
  erRegular: number
  erMpf: number
  erEc: number
  erTotal: number
  eeRegular: number
  eeMpf: number
  eeTotal: number
  totalContribution: number
}

// Generate the official 61-bracket 2026 SSS Table matching RA 11199 schedule
export function generateOfficial2026SSSTable(): SSSBracket[] {
  const brackets: SSSBracket[] = []

  // Bracket 1: Below 5,250
  brackets.push({
    id: 1,
    rangeLabel: 'BELOW 5,250',
    minComp: 0,
    maxComp: 5249.99,
    regularMsc: 5000,
    mpfMsc: 0,
    totalMsc: 5000,
    erRegular: 500,
    erMpf: 0,
    erEc: 10,
    erTotal: 510,
    eeRegular: 250,
    eeMpf: 0,
    eeTotal: 250,
    totalContribution: 760
  })

  // Brackets 2 to 31: 5,250 to 20,249.99 (Regular SS MSC only, 5,500 to 20,000)
  let currentMin = 5250
  let currentMsc = 5500
  let bracketId = 2

  while (currentMsc <= 20000) {
    const currentMax = currentMin + 499.99
    const ec = currentMsc >= 15000 ? 30 : 10
    const erRegular = currentMsc * 0.10
    const eeRegular = currentMsc * 0.05

    brackets.push({
      id: bracketId++,
      rangeLabel: `${currentMin.toLocaleString('en-US')} - ${currentMax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      minComp: currentMin,
      maxComp: currentMax,
      regularMsc: currentMsc,
      mpfMsc: 0,
      totalMsc: currentMsc,
      erRegular,
      erMpf: 0,
      erEc: ec,
      erTotal: erRegular + ec,
      eeRegular,
      eeMpf: 0,
      eeTotal: eeRegular,
      totalContribution: erRegular + ec + eeRegular
    })

    currentMin += 500
    currentMsc += 500
  }

  // Brackets 32 to 60: 20,250 to 34,749.99 (Regular SS capped at 20k, MPF MSC 500 to 14,500)
  let mpfMsc = 500
  while (mpfMsc <= 14500) {
    const currentMax = currentMin + 499.99
    const regularMsc = 20000
    const totalMsc = regularMsc + mpfMsc
    const erRegular = regularMsc * 0.10 // 2000
    const erMpf = mpfMsc * 0.10
    const erEc = 30
    const erTotal = erRegular + erMpf + erEc
    const eeRegular = regularMsc * 0.05 // 1000
    const eeMpf = mpfMsc * 0.05
    const eeTotal = eeRegular + eeMpf
    const totalContribution = erTotal + eeTotal

    brackets.push({
      id: bracketId++,
      rangeLabel: `${currentMin.toLocaleString('en-US')} - ${currentMax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      minComp: currentMin,
      maxComp: currentMax,
      regularMsc,
      mpfMsc,
      totalMsc,
      erRegular,
      erMpf,
      erEc,
      erTotal,
      eeRegular,
      eeMpf,
      eeTotal,
      totalContribution
    })

    currentMin += 500
    mpfMsc += 500
  }

  // Bracket 61: 34,750 - Over (Regular SS 20k, MPF 15k, Total MSC 35k)
  brackets.push({
    id: bracketId,
    rangeLabel: '34,750 - Over',
    minComp: 34750,
    maxComp: null,
    regularMsc: 20000,
    mpfMsc: 15000,
    totalMsc: 35000,
    erRegular: 2000,
    erMpf: 1500,
    erEc: 30,
    erTotal: 3530,
    eeRegular: 1000,
    eeMpf: 750,
    eeTotal: 1750,
    totalContribution: 5280
  })

  return brackets
}

export const DEFAULT_PHILHEALTH_CONFIG: PhilHealthConfig = {
  rate: 5.0,
  minSalary: 10000,
  maxSalary: 100000,
  employeeSharePercentage: 50,
  employerSharePercentage: 50
}

export const DEFAULT_PAGIBIG_CONFIG: PagIbigConfig = {
  employeeRateBelow1500: 1.0,
  employeeRateAbove1500: 2.0,
  employerRate: 2.0,
  maxMonthlyCompensation: 10000,
  maxContribution: 200
}

export const STORAGE_KEY_PHILHEALTH = 'smartguys_philhealth_config_2026'
export const STORAGE_KEY_PAGIBIG = 'smartguys_pagibig_config_2026'
export const STORAGE_KEY_SSS_BRACKETS = 'smartguys_sss_brackets_2026'

export function getPhilHealthConfig(): PhilHealthConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PHILHEALTH)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        rate: parsed.rate ?? DEFAULT_PHILHEALTH_CONFIG.rate,
        minSalary: parsed.minSalary ?? parsed.floor ?? DEFAULT_PHILHEALTH_CONFIG.minSalary,
        maxSalary: parsed.maxSalary ?? parsed.ceiling ?? DEFAULT_PHILHEALTH_CONFIG.maxSalary,
        employeeSharePercentage: parsed.employeeSharePercentage ?? (parsed.eeShareRatio ? parsed.eeShareRatio * 100 : DEFAULT_PHILHEALTH_CONFIG.employeeSharePercentage),
        employerSharePercentage: parsed.employerSharePercentage ?? DEFAULT_PHILHEALTH_CONFIG.employerSharePercentage
      }
    }
  } catch (e) {
    console.error('Failed to parse PhilHealth config', e)
  }
  return DEFAULT_PHILHEALTH_CONFIG
}

export function savePhilHealthConfig(cfg: PhilHealthConfig): void {
  localStorage.setItem(STORAGE_KEY_PHILHEALTH, JSON.stringify(cfg))
  window.dispatchEvent(new CustomEvent('smartguys:statutory-rates-updated'))
}

export function getPagIbigConfig(): PagIbigConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAGIBIG)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        employeeRateBelow1500: parsed.employeeRateBelow1500 ?? (parsed.lowIncomeRateEE ? parsed.lowIncomeRateEE * 100 : DEFAULT_PAGIBIG_CONFIG.employeeRateBelow1500),
        employeeRateAbove1500: parsed.employeeRateAbove1500 ?? (parsed.standardRateEE ? parsed.standardRateEE * 100 : DEFAULT_PAGIBIG_CONFIG.employeeRateAbove1500),
        employerRate: parsed.employerRate ?? DEFAULT_PAGIBIG_CONFIG.employerRate,
        maxMonthlyCompensation: parsed.maxMonthlyCompensation ?? parsed.maxFundSalary ?? DEFAULT_PAGIBIG_CONFIG.maxMonthlyCompensation,
        maxContribution: parsed.maxContribution ?? parsed.maxContributionEE ?? DEFAULT_PAGIBIG_CONFIG.maxContribution
      }
    }
  } catch (e) {
    console.error('Failed to parse Pag-IBIG config', e)
  }
  return DEFAULT_PAGIBIG_CONFIG
}

export function savePagIbigConfig(cfg: PagIbigConfig): void {
  localStorage.setItem(STORAGE_KEY_PAGIBIG, JSON.stringify(cfg))
  window.dispatchEvent(new CustomEvent('smartguys:statutory-rates-updated'))
}

export function getSSSBrackets(): SSSBracket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SSS_BRACKETS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    console.error('Failed to parse SSS brackets', e)
  }
  return generateOfficial2026SSSTable()
}

export function saveSSSBrackets(brackets: SSSBracket[]): void {
  localStorage.setItem(STORAGE_KEY_SSS_BRACKETS, JSON.stringify(brackets))
  window.dispatchEvent(new CustomEvent('smartguys:statutory-rates-updated'))
}

export function resetSSSBracketsTo2026(): SSSBracket[] {
  const defaults = generateOfficial2026SSSTable()
  saveSSSBrackets(defaults)
  return defaults
}

/**
 * 2026 SSS Calculation Lookup
 */
export function calculateSSS2026(monthlySalary: number, customBrackets?: SSSBracket[]) {
  const brackets = customBrackets || getSSSBrackets()
  const salary = Math.max(0, monthlySalary)

  // Find matching bracket
  const match = brackets.find((b) => {
    if (b.maxComp === null) {
      return salary >= b.minComp
    }
    return salary >= b.minComp && salary <= b.maxComp
  }) || brackets[brackets.length - 1]

  return {
    bracket: match,
    eeRegular: match.eeRegular,
    eeMpf: match.eeMpf,
    totalEE: match.eeTotal,
    erRegular: match.erRegular,
    erMpf: match.erMpf,
    erEc: match.erEc,
    totalER: match.erTotal,
    totalContribution: match.totalContribution,
    totalMsc: match.totalMsc
  }
}

/**
 * 2026 PhilHealth Calculation
 */
export function calculatePhilHealth2026(monthlySalary: number, customCfg?: PhilHealthConfig) {
  const cfg = customCfg || getPhilHealthConfig()
  const salary = Math.max(0, monthlySalary)
  const clampedSalary = Math.min(cfg.maxSalary, Math.max(cfg.minSalary, salary))

  const totalPremium = Math.round(clampedSalary * (cfg.rate / 100) * 100) / 100
  const eeRatio = (cfg.employeeSharePercentage || 50) / 100
  const eeShare = Math.round(totalPremium * eeRatio * 100) / 100
  const erShare = Math.round((totalPremium - eeShare) * 100) / 100

  return {
    salary,
    clampedSalary,
    totalPremium,
    eeShare,
    erShare
  }
}

/**
 * 2026 Pag-IBIG Calculation
 */
export function calculatePagIbig2026(monthlySalary: number, customCfg?: PagIbigConfig) {
  const cfg = customCfg || getPagIbigConfig()
  const salary = Math.max(0, monthlySalary)
  const mfs = Math.min(cfg.maxMonthlyCompensation || 10000, salary)

  const eePct = salary <= 1500 ? (cfg.employeeRateBelow1500 || 1.0) : (cfg.employeeRateAbove1500 || 2.0)
  const erPct = cfg.employerRate || 2.0

  let eeShare = Math.round(mfs * (eePct / 100) * 100) / 100
  let erShare = Math.round(mfs * (erPct / 100) * 100) / 100

  const maxCap = cfg.maxContribution || 200
  eeShare = Math.min(maxCap, eeShare)
  erShare = Math.min(maxCap, erShare)

  return {
    salary,
    mfs,
    eeShare,
    erShare,
    totalContribution: eeShare + erShare
  }
}

// -------------------------------------------------------------
// BIR TRAIN LAW WITHHOLDING TAX (OFFICIAL 2023–2026+ SCHEDULE)
// -------------------------------------------------------------
export const DEFAULT_MONTHLY_TAX_BRACKETS: WithholdingTaxBracket[] = [
  {
    id: 1,
    rangeLabel: '₱20,833 and below',
    minIncome: 0,
    maxIncome: 20833,
    baseTax: 0,
    rate: 0,
    ratePercentage: 0,
    excessOver: 0,
    description: 'No tax'
  },
  {
    id: 2,
    rangeLabel: '₱20,833 – ₱33,332',
    minIncome: 20833.01,
    maxIncome: 33332,
    baseTax: 0,
    rate: 0.15,
    ratePercentage: 15,
    excessOver: 20833,
    description: '15% of excess over ₱20,833'
  },
  {
    id: 3,
    rangeLabel: '₱33,333 – ₱66,666',
    minIncome: 33333,
    maxIncome: 66666,
    baseTax: 1875.00,
    rate: 0.20,
    ratePercentage: 20,
    excessOver: 33333,
    description: '₱1,875.00 + 20% of excess over ₱33,333'
  },
  {
    id: 4,
    rangeLabel: '₱66,667 – ₱166,666',
    minIncome: 66667,
    maxIncome: 166666,
    baseTax: 8541.80,
    rate: 0.25,
    ratePercentage: 25,
    excessOver: 66667,
    description: '₱8,541.80 + 25% of excess over ₱66,667'
  },
  {
    id: 5,
    rangeLabel: '₱166,667 – ₱666,666',
    minIncome: 166667,
    maxIncome: 666666,
    baseTax: 33541.80,
    rate: 0.30,
    ratePercentage: 30,
    excessOver: 166667,
    description: '₱33,541.80 + 30% of excess over ₱166,667'
  },
  {
    id: 6,
    rangeLabel: '₱666,667 and above',
    minIncome: 666667,
    maxIncome: null,
    baseTax: 183541.80,
    rate: 0.35,
    ratePercentage: 35,
    excessOver: 666667,
    description: '₱183,541.80 + 35% of excess over ₱666,667'
  }
]

export const DEFAULT_SEMI_MONTHLY_TAX_BRACKETS: WithholdingTaxBracket[] = [
  {
    id: 1,
    rangeLabel: '₱10,417 and below',
    minIncome: 0,
    maxIncome: 10417,
    baseTax: 0,
    rate: 0,
    ratePercentage: 0,
    excessOver: 0,
    description: 'No tax'
  },
  {
    id: 2,
    rangeLabel: '₱10,417 – ₱16,666',
    minIncome: 10417.01,
    maxIncome: 16666,
    baseTax: 0,
    rate: 0.15,
    ratePercentage: 15,
    excessOver: 10417,
    description: '15% of excess over ₱10,417'
  },
  {
    id: 3,
    rangeLabel: '₱16,667 – ₱33,332',
    minIncome: 16667,
    maxIncome: 33332,
    baseTax: 937.50,
    rate: 0.20,
    ratePercentage: 20,
    excessOver: 16667,
    description: '₱937.50 + 20% of excess over ₱16,667'
  },
  {
    id: 4,
    rangeLabel: '₱33,333 – ₱83,332',
    minIncome: 33333,
    maxIncome: 83332,
    baseTax: 4270.70,
    rate: 0.25,
    ratePercentage: 25,
    excessOver: 33333,
    description: '₱4,270.70 + 25% of excess over ₱33,333'
  },
  {
    id: 5,
    rangeLabel: '₱83,333 – ₱333,332',
    minIncome: 83333,
    maxIncome: 333332,
    baseTax: 16770.70,
    rate: 0.30,
    ratePercentage: 30,
    excessOver: 83333,
    description: '₱16,770.70 + 30% of excess over ₱83,333'
  },
  {
    id: 6,
    rangeLabel: '₱333,333 and above',
    minIncome: 333333,
    maxIncome: null,
    baseTax: 91770.70,
    rate: 0.35,
    ratePercentage: 35,
    excessOver: 333333,
    description: '₱91,770.70 + 35% of excess over ₱333,333'
  }
]

export const STORAGE_KEY_TAX_BRACKETS = 'smartguys_bir_tax_brackets_2026_v2'
export const STORAGE_KEY_SEMI_MONTHLY_TAX_BRACKETS = 'smartguys_bir_semi_monthly_tax_brackets_2026_v2'

export function formatTaxBracketDescription(
  baseTax: number,
  ratePercentage: number,
  excessOver: number
): string {
  if (ratePercentage <= 0) return 'No tax'
  const pctStr = `${ratePercentage}%`
  const excessStr = `over ₱${Math.round(excessOver).toLocaleString('en-US')}`
  const baseFormatted =
    baseTax % 1 !== 0
      ? baseTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : baseTax.toLocaleString('en-US')
  if (baseTax <= 0) {
    return `0.00 + ${pctStr} ${excessStr}`
  }
  return `₱${baseFormatted} + ${pctStr} ${excessStr}`
}

export function formatTaxBracketRangeLabel(minIncome: number, maxIncome: number | null): string {
  if (maxIncome === null || maxIncome === undefined || maxIncome <= 0) {
    return `₱${Math.round(minIncome).toLocaleString('en-US')} and above`
  }
  if (minIncome <= 0) {
    return `₱${Math.round(maxIncome).toLocaleString('en-US')} and below`
  }
  return `₱${Math.round(minIncome).toLocaleString('en-US')} – ₱${Math.round(maxIncome).toLocaleString('en-US')}`
}

export function getWithholdingTaxBrackets(period: 'MONTHLY' | 'SEMI_MONTHLY' = 'MONTHLY'): WithholdingTaxBracket[] {
  try {
    const key = period === 'SEMI_MONTHLY' ? STORAGE_KEY_SEMI_MONTHLY_TAX_BRACKETS : STORAGE_KEY_TAX_BRACKETS
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    console.error('Failed to parse tax brackets', e)
  }
  return period === 'SEMI_MONTHLY' ? DEFAULT_SEMI_MONTHLY_TAX_BRACKETS : DEFAULT_MONTHLY_TAX_BRACKETS
}

export function saveWithholdingTaxBrackets(
  brackets: WithholdingTaxBracket[],
  period: 'MONTHLY' | 'SEMI_MONTHLY' = 'MONTHLY'
): void {
  const key = period === 'SEMI_MONTHLY' ? STORAGE_KEY_SEMI_MONTHLY_TAX_BRACKETS : STORAGE_KEY_TAX_BRACKETS
  localStorage.setItem(key, JSON.stringify(brackets))
  window.dispatchEvent(new CustomEvent('smartguys:statutory-rates-updated'))
}

export function resetWithholdingTaxBrackets(period: 'MONTHLY' | 'SEMI_MONTHLY' = 'MONTHLY'): WithholdingTaxBracket[] {
  const defaults = period === 'SEMI_MONTHLY' ? DEFAULT_SEMI_MONTHLY_TAX_BRACKETS : DEFAULT_MONTHLY_TAX_BRACKETS
  saveWithholdingTaxBrackets(defaults, period)
  return defaults
}

export function calculateTRAINWithholdingTax(
  taxableIncome: number,
  period: 'MONTHLY' | 'SEMI_MONTHLY' = 'MONTHLY',
  customBrackets?: WithholdingTaxBracket[]
) {
  const brackets = customBrackets || getWithholdingTaxBrackets(period)
  const income = Math.max(0, taxableIncome)

  const match = brackets.find((b) => {
    if (b.maxIncome === null) return income >= b.minIncome
    return income >= b.minIncome && income <= b.maxIncome
  }) || brackets[brackets.length - 1]

  if (match.rate <= 0) {
    return {
      taxableIncome: income,
      bracket: match,
      baseTax: 0,
      excess: 0,
      variableTax: 0,
      totalTax: 0
    }
  }

  const excess = Math.max(0, income - match.excessOver)
  const variableTax = Math.round(excess * match.rate * 100) / 100
  const totalTax = Math.round((match.baseTax + variableTax) * 100) / 100

  return {
    taxableIncome: income,
    bracket: match,
    baseTax: match.baseTax,
    excess,
    variableTax,
    totalTax
  }
}

