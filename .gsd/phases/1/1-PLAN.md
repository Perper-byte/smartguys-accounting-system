---
phase: 1
plan: 1
wave: 1
gap_closure: false
depends_on: []
---

# Plan 1.1: Database Schema Extensions for Payroll

## Objective
Update the Prisma schema to store payroll rate settings, allowances, loans, and statutory contribution parameters required for the dynamic Gross-to-Net payroll processing.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/phases/1/RESEARCH.md
- prisma/schema.prisma

## Tasks

<task type="auto">
  <name>Update Prisma Schema</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    Steps:
    1. Update the `SystemSetting` model to include dynamic payroll multipliers (e.g. ot_rate, night_diff_rate, rest_day_rate, special_holiday_rate, legal_holiday_rate) as Decimals with default values as specified in RESEARCH.md.
    2. Add new models `EmployeeAllowance`, `EmployeeLoan`, and `StatutoryRateTable` matching the definitions in RESEARCH.md.
    3. Update the `Employee` model to include relation links to `allowances` and `loans`. (Note: `payslips` will be handled when `Payslip` model is created if not already).
    
    USE: Exact field definitions and data types from `.gsd/phases/1/RESEARCH.md` because they align with DOLE standards.
  </action>
  <verify>
    npx prisma validate
  </verify>
  <done>
    Prisma validation passes with no errors, confirming schema correctness.
  </done>
</task>

<task type="auto">
  <name>Generate Prisma Client and Migrate</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    Steps:
    1. Run `npx prisma db push` to apply the schema changes to the local development database.
    2. Run `npx prisma generate` to update the Prisma Client.
    
    AVOID: Running destructive migrations on production. Use `prisma db push` for local development state synchronization.
  </action>
  <verify>
    npx prisma generate
  </verify>
  <done>
    Prisma client is generated successfully and the local database schema reflects the new models.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Configurable DOLE rate multipliers in database settings are defined.
- [ ] Allowance, Loan, and Statutory Rate models exist.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
