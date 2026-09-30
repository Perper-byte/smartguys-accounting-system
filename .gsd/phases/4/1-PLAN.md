---
phase: 4
plan: 1
wave: 1
gap_closure: false
---

# Plan 4.1: Chart of Accounts & GL Posting Overhaul

## Objective
Update the accounting system's Chart of Accounts to include new statutory and tax payables, and overhaul the payroll GL posting logic to generate perfectly balanced, DOLE-compliant double-entry journal entries, while respecting the system's period lock date and manager override PIN controls.

## Context
Load these files for context:
- .gsd/phases/4/RESEARCH.md
- prisma/seed.ts
- src/main/services/ledger.service.ts
- src/main/services/payroll.service.ts
- src/main/services/payroll-calculator.ts

## Tasks

<task type="auto">
  <name>Update Chart of Accounts Seeding</name>
  <files>
    prisma/seed.ts
    src/main/services/ledger.service.ts
  </files>
  <action>
    Add the required accounts to the database seeding and initialization processes.
    
    Steps:
    1. In `prisma/seed.ts` (and if applicable, an initialization function in `LedgerService`), add the new Phase 4 accounts to ensure they exist on startup:
       - `5100`: Salaries and Wages Expense (type-expense)
       - `5110`: Employer Statutory Contributions Expense (type-expense)
       - `2040`: Salaries / Net Payroll Payable (type-liability)
       - `2041`: SSS & EC Premium Payable (type-liability)
       - `2042`: PhilHealth Premium Payable (type-liability)
       - `2043`: Pag-IBIG Premium Payable (type-liability)
       - `2051`: Withholding Tax Payable - Compensation (type-liability)
       - `1210`: Advances to Officers & Employees (type-asset)
    2. Ensure that existing conflicting seed logic for payroll taxes mapping to `2050` is removed or corrected.
    
    AVOID: Altering unrelated account seed logic.
  </action>
  <verify>
    npm run prisma:seed
  </verify>
  <done>
    Running seed succeeds, and querying the database shows all the target Phase 4 accounts.
  </done>
</task>

<task type="auto">
  <name>Overhaul Payroll GL Posting & Approval Security</name>
  <files>
    src/main/services/payroll.service.ts
    src/main/services/ledger.service.ts
  </files>
  <action>
    Refactor `processPayroll` in `PayrollService` to enforce period lock security and build accurate double-entry GL lines.
    
    Steps:
    1. Modify `processPayroll(data: { ..., overridePin?: string })` to first fetch the system setting's `lock_date`.
    2. If the payroll `date` is <= `lock_date`, verify the `overridePin` using `LedgerService.verifyManagerPin`. If invalid/missing, throw an error.
    3. Iterate over calculated employee payslips to accumulate:
       - Total Gross Pay
       - Total Net Pay
       - Total Withholding Tax
       - Total SSS/EC/PhilHealth/Pag-IBIG (Employee + Employer shares)
       - Total Loan Deductions
    4. Generate Journal Entry lines using the new accounts (Debit `5100`, `5110`; Credit `2040`, `2041`, `2042`, `2043`, `2051`, `1210`). Ensure total debits strictly equal total credits.
    5. Save the journal entry in the transaction and log an audit trail if a locked period was overridden.
    
    USE: The exact debit/credit mapping matrix outlined in RESEARCH.md.
  </action>
  <verify>
    npm run test -- --testPathPattern="payroll.service.spec.ts" (or create a small test script invoking `processPayroll`)
  </verify>
  <done>
    `processPayroll` correctly throws an error when trying to post to a locked period without a PIN, and creates a mathematically balanced journal entry when valid.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Database contains the required payroll statutory accounts.
- [ ] Processing a payroll run automatically creates a strictly balanced double-entry journal entry.
- [ ] Backdated payroll approval strictly demands an override PIN.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
