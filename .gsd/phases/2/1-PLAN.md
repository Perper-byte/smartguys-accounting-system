---
phase: 2
plan: 1
wave: 1
gap_closure: false
---

# Plan 2.1: Implement Statutory & Demerit Calculators

## Objective
Implement standalone calculation functions for Philippine statutory deductions (SSS, PhilHealth, Pag-IBIG), BIR TRAIN Law withholding tax, and DOLE-based attendance demerits inside the existing `payroll-calculator.ts` module. This provides the mathematical foundation for the gross-to-net pipeline.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/phases/2/RESEARCH.md
- src/main/services/payroll-calculator.ts

## Tasks

<task type="auto">
  <name>Implement Attendance and Statutory Calculators</name>
  <files>
    src/main/services/payroll-calculator.ts
  </files>
  <action>
    Add calculation functions based on RESEARCH.md:
    
    1. Define interfaces: `AttendanceDemerits`, `DemeritBreakdown`, `StatutoryResult`.
    2. Implement `calculateAttendanceDemerits(hourlyRate: number, demerits: AttendanceDemerits): DemeritBreakdown` to compute deductions for late, undertime, and absences based on DOLE minute/hourly/daily rates.
    3. Implement `calculateSSSContribution(monthlySalary: number)` covering regular and WISP (up to 35k max MSC).
    4. Implement `calculatePhilHealthContribution(monthlySalary: number)` (5% with 10k floor and 100k ceiling).
    5. Implement `calculatePagIbigContribution(monthlySalary: number)` (2% capped at 10k max salary, 200 EE/ER).
    
    USE: Hardcoded arithmetic based on 2025-2026 RESEARCH.md rules instead of relying entirely on database rate tables for these exact formulas, as the statutory formulas have specific bracket boundaries and clamps.
  </action>
  <verify>
    npx ts-node -e "import { calculateSSSContribution } from './src/main/services/payroll-calculator.ts'; console.log(calculateSSSContribution(40000));"
  </verify>
  <done>
    Script returns correct SSS amounts (EE total = 1750, ER total = 3530) for a 40k salary.
  </done>
</task>

<task type="auto">
  <name>Implement BIR Withholding Tax Calculator</name>
  <files>
    src/main/services/payroll-calculator.ts
  </files>
  <action>
    Implement BIR TRAIN Law withholding tax tiers.
    
    1. Implement `calculateWithholdingTax(taxableIncome: number, period: 'SEMI_MONTHLY' | 'MONTHLY'): number`.
    2. Use the tables provided in RESEARCH.md for semi-monthly and monthly brackets.
    3. Export the function for use in the payroll service.
  </action>
  <verify>
    npx ts-node -e "import { calculateWithholdingTax } from './src/main/services/payroll-calculator.ts'; console.log(calculateWithholdingTax(20000, 'SEMI_MONTHLY'));"
  </verify>
  <done>
    Script returns the correct semi-monthly tax for a taxable income of 20,000 (1604.10).
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Gross-to-Net payroll service with statutory contributions & tax computation (Calculators portion)

## Success Criteria
- [ ] All tasks verified passing
- [ ] No regressions in tests
