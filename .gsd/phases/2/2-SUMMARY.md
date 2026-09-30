# Phase 2 - Plan 2 Summary

## Objective
Refactor the main `PayrollService` to process the end-to-end Gross-to-Net pipeline, including allowances, statutory deductions, tax, and loan amortizations. Update the payroll atomic transaction to post mapped General Ledger lines and save itemized Payslips.

## Changes
- **Refactored `calculateEmployeePayroll`**: Added handling for demerits, allowances, taxes, and loan amortizations to provide a comprehensive gross-to-net computation.
- **Updated `processPayroll` Atomic Transaction**: Added support for decrementing loan balances based on processed deductions and refined Journal Entry lines to correctly debit 5100 and credit 2040 (Statutory Payables and other deductions), 2050 (Withholding Tax Payable), and 1010 (Cash in Bank). Mapped extended fields to Payslip creation.

## Files Touched
- `src/main/services/payroll.service.ts`

## Verification
- Checked compilation and typings for both `calculateEmployeePayroll` and `processPayroll` via `ts-node` tests. Both functions successfully evaluate.

## Risks/Debt
- Assumed standard semi-monthly deductions for statuaries (halved standard values). This may require configuration depending on company policy.
- Grouped non-statutory deductions into 2040 for the sake of simplicity instead of tracking distinct loan payables for each loan type.

## Next Steps
- Implement frontend UI mapping for the updated fields in Payslips.
- Proceed to the next phases for reporting.
