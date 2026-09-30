# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
Complete overhaul of the HR & Payroll module for Smartguys Community Healthcare Inc. Features configurable DOLE-compliant premium rate multipliers, comprehensive attendance/demerits processing (Lates, Undertime, Absences), Philippine statutory contributions (SSS, PhilHealth, Pag-IBIG, BIR Withholding Tax), itemized PDF payslip generation, and automated General Ledger accounting entry integration.

## Goals
1. **Configurable Premium Rates Engine**: Support dynamic percentage multipliers for all 16 DOLE work categories (Regular, Rest Day, Legal Holiday, Special Holiday, Night Diff, Overtime, ND-OT) customizable via system settings.
2. **Gross-to-Net Payroll Processing**: Calculate exact base pay, attendance demerits (lates/undertime/absences), taxable/non-taxable allowances, government statutory contributions (SSS, PhilHealth, Pag-IBIG), withholding tax, and government/company loans.
3. **Interactive Payroll Grid & Overhaul UI**: Provide an expanded multi-tab payroll interface matching clinic rate sheets with real-time calculations and DTR CSV import.
4. **Payslip & Accounting Integration**: One-click PDF payslip export and automated General Ledger journal entry creation (`Salaries Expense`, `Statutory Payables`, `Payroll Payable`) upon payroll approval.

## Non-Goals (Out of Scope)
- Direct USB biometrics hardware device drivers (DTR logs will be imported via CSV/Excel upload).
- Direct bank API disbursement integration (manual/CSV bank payout batch export is supported).

## Users
- **HR Administrator**: Manages employee profiles, rates, allowances, and attendance records.
- **Clinic Manager / Approver**: Reviews payroll computations, unlocks period overrides, approves payroll runs.
- **Accountant**: Inspects statutory report schedules and automatically posted GL entries.

## Constraints
- Compliance with Philippine Labor Code (DOLE) and BIR TRAIN Law tax schedules.
- System environment: Electron 39 desktop app + React 19 + TypeScript + Prisma ORM.

## Success Criteria
- [ ] Multipliers for all 16 premium rate combinations configurable and saved in database settings.
- [ ] Accurate Gross-to-Net calculation matching paper rate sheet calculations to 2 decimal places.
- [ ] Automated generation of itemized PDF payslips per employee.
- [ ] Automated posting of balanced General Ledger journal entries upon payroll approval.
