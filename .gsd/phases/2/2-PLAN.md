---
phase: 2
plan: 2
wave: 2
depends_on:
  - 1-PLAN.md
gap_closure: false
---

# Plan 2.2: Refactor Payroll Pipeline & Persistence

## Objective
Refactor the main `PayrollService` to process the end-to-end Gross-to-Net pipeline, including allowances, statutory deductions, tax, and loan amortizations. Update the payroll atomic transaction to post mapped General Ledger lines and save itemized Payslips.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/phases/2/RESEARCH.md
- prisma/schema.prisma
- src/main/services/payroll-calculator.ts
- src/main/services/payroll.service.ts

## Tasks

<task type="auto">
  <name>Refactor Employee Payroll Calculation Pipeline</name>
  <files>
    src/main/services/payroll.service.ts
  </files>
  <action>
    Refactor `calculateEmployeePayroll` to accept `monthlySalary`, `hours` (OvertimeHours), `demerits` (AttendanceDemerits), `allowances`, and `loans` arrays.
    
    Steps:
    1. Base pay and demerits: Subtract demerits from (monthlySalary / 2).
    2. Premium Pay: calculateOvertimeAndDiff.
    3. Allowances: sum taxable and non-taxable allowances (divide by 2 for semi-monthly).
    4. Deductions: call SSS, PhilHealth, Pag-IBIG calculators (divide by 2).
    5. Tax: compute taxable base and call `calculateWithholdingTax(base, 'SEMI_MONTHLY')`.
    6. Loans: compute deductions for active loans up to balance.
    7. Return full detailed breakdown object matching Payslip fields.
  </action>
  <verify>
    npx ts-node -e "import { PayrollService } from './src/main/services/payroll.service.ts'; console.log(typeof PayrollService.calculateEmployeePayroll);"
  </verify>
  <done>
    Function compiles and accepts the extended parameters.
  </done>
</task>

<task type="auto">
  <name>Update Atomic Transaction for Journal Entries & Loans</name>
  <files>
    src/main/services/payroll.service.ts
  </files>
  <action>
    Refactor `processPayroll` to handle the expanded data from the new pipeline.
    
    Steps:
    1. For each employee, generate `Payslip` creation data mapped to all new fields (sss, philhealth, pagibig, cash_advance, tax_withheld, net_pay, etc.).
    2. Decrement loan balances in `employee_loans` (update balance = balance - deduction, set is_active = false if balance <= 0).
    3. Map detailed General Ledger lines:
       - Debit 5100 (Total Gross Pay)
       - Credit Statutory Payables (SSS, PhilHealth, Pag-IBIG - assuming accounts for now or just group under 2040)
       - Credit 2050 (Withholding Tax Payable)
       - Credit 1010 (Net Pay / Cash in Bank)
    4. Save Payslips and JournalEntry in the $transaction.
  </action>
  <verify>
    npx ts-node -e "import { PayrollService } from './src/main/services/payroll.service.ts'; console.log(typeof PayrollService.processPayroll);"
  </verify>
  <done>
    Function compiles and is prepared to handle the full payslip object structure in its transaction.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Gross-to-Net payroll service with statutory contributions & tax computation (Pipeline portion)
- [ ] PDF payslip generator & auto-posted GL journal entries (GL entry posting portion)

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
