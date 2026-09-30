---
phase: 1
plan: 2
wave: 2
gap_closure: false
depends_on: [1]
---

# Plan 1.2: Payroll Calculation Service and Helpers

## Objective
Implement the helper module and main service to compute payroll calculations, including hourly rate, overtime, night differential, and statutory deductions.

## Context
Load these files for context:
- .gsd/phases/1/RESEARCH.md
- src/main/services/payroll-calculator.ts
- src/main/services/payroll.service.ts

## Tasks

<task type="auto">
  <name>Implement Payroll Calculator Helpers</name>
  <files>
    src/main/services/payroll-calculator.ts
  </files>
  <action>
    Steps:
    1. Create `src/main/services/payroll-calculator.ts`.
    2. Implement pure functions:
       - `calculateHourlyRate(monthlySalary: number)`: (monthlySalary * 12) / 261 / 8
       - `calculateOvertimeAndDiff(hourlyRate: number, hours: any, multipliers: any)`: calculate overtime/diff using provided multipliers.
       - `calculateStatutoryDeductions(monthlySalary: number, rateTables: any)`: calculate EE and ER contributions based on tables.
    
    USE: pure functions without database calls here for easier unit testing.
  </action>
  <verify>
    npx tsc --noEmit src/main/services/payroll-calculator.ts
  </verify>
  <done>
    Helper module compiles without TypeScript errors.
  </done>
</task>

<task type="auto">
  <name>Implement Payroll Service Hooks</name>
  <files>
    src/main/services/payroll.service.ts
  </files>
  <action>
    Steps:
    1. Create or update `src/main/services/payroll.service.ts`.
    2. Implement `getPayrollSettings()` to fetch dynamic multipliers from `SystemSetting` using Prisma Client, providing defaults if none exist.
    3. Implement a preliminary function or wrapper that calls the calculator helpers using the fetched settings.
  </action>
  <verify>
    npx tsc --noEmit src/main/services/payroll.service.ts
  </verify>
  <done>
    Service compiles without TypeScript errors and uses Prisma Client properly.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Rate calculation helper handles DOLE standard multipliers.
- [ ] Payroll service fetches settings from Prisma.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
