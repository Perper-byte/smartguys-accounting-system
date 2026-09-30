---
phase: 1
plan: 1-GAP
wave: 1
gap_closure: true
---

# Plan 1.1-GAP: Implement All 16 DOLE Multipliers

## Objective
Update the Prisma schema and payroll calculation services to explicitly define and handle all 16 DOLE work categories and their respective multipliers, as requested in the SPEC. The initial implementation only provided 5 primitive rates and calculated them linearly instead of providing the 16 exact combinations (e.g. Rest Day Night Shift Overtime).

## Context
Load these files for context:
- .gsd/SPEC.md
- prisma/schema.prisma
- src/main/services/payroll-calculator.ts
- src/main/services/payroll.service.ts

## Tasks

<task type="auto">
  <name>Update Prisma Schema with 16 DOLE Rates</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    Update the `SystemSetting` model to include all 16 DOLE combinations.
    Instead of just 5 fields, explicitly include decimal fields for:
    - regular_ot_rate (default 1.25)
    - regular_night_rate (default 1.10)
    - regular_night_ot_rate (default 1.375)
    - rest_day_rate (default 1.30)
    - rest_day_ot_rate (default 1.69)
    - rest_day_night_rate (default 1.43)
    - rest_day_night_ot_rate (default 1.859)
    - special_holiday_rate (default 1.30)
    - special_holiday_ot_rate (default 1.69)
    - special_holiday_night_rate (default 1.43)
    - special_holiday_night_ot_rate (default 1.859)
    - special_holiday_rest_day_rate (default 1.50)
    - special_holiday_rest_day_ot_rate (default 1.95)
    - special_holiday_rest_day_night_rate (default 1.65)
    - special_holiday_rest_day_night_ot_rate (default 2.145)
    - legal_holiday_rate (default 2.00)
    (And their respective OT/Night variations if required, or ensure the matrix of 16 is fully covered). 
    
    Steps:
    1. Define all 16 DOLE multiplier combination rates as Decimal in `SystemSetting`.
    2. Remove the outdated 5 primitive rates.
  </action>
  <verify>
    npx prisma validate
  </verify>
  <done>
    Prisma validation passes and schema includes all 16 DOLE multiplier rates.
  </done>
</task>

<task type="auto">
  <name>Regenerate Prisma Client</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    Run `npx prisma db push` and `npx prisma generate` to apply the changes to the local SQLite DB and update the client.
  </action>
  <verify>
    npx prisma generate
  </verify>
  <done>
    Prisma client is updated with the new fields.
  </done>
</task>

<task type="auto">
  <name>Update Payroll Calculator Service</name>
  <files>
    src/main/services/payroll-calculator.ts
    src/main/services/payroll.service.ts
  </files>
  <action>
    Update the `PayrollMultipliers` and `OvertimeHours` interfaces to account for all 16 categories instead of just 5.
    Update `calculateOvertimeAndDiff` to use the 16 exact combinations for calculating total pay, rather than a linear addition of basic multipliers.
    Update `PayrollService.getPayrollSettings()` to retrieve and default all 16 categories correctly.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    TypeScript compiles successfully with the updated service interfaces matching the 16 DOLE combinations.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Configurable DOLE rate multipliers in database settings accurately reflect the 16 combinations required by DOLE standard matrix.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
