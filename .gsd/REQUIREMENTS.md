# REQUIREMENTS.md — HR & Payroll System Overhaul

## Requirements Matrix

| ID | Requirement | Source | Status |
|----|-------------|--------|--------|
| REQ-01 | **Configurable Premium Rates Engine**: Store and edit percentage multipliers for OT (125%), ND (110%), Rest Day (130%), Legal Holiday (200%), Special Holiday (130%), and ND-OT combinations in database. | SPEC Goal 1 | Complete |
| REQ-02 | **Attendance & Demerit Processing**: Calculate deductions for Late (minutes), Undertime (hours), and Absences (days) based on hourly/daily rates. | SPEC Goal 2 | Pending |
| REQ-03 | **Multi-Category Premium Breakdown**: Expand payroll calculations to compute Regular, Rest Day, Legal Holiday, and Special Holiday hours x rate multipliers. | SPEC Goal 2 | Complete |
| REQ-04 | **Statutory Contributions Calculator**: Implement SSS table lookup, PhilHealth 5% split calculation, Pag-IBIG contribution, and BIR TRAIN Law Withholding Tax table. | SPEC Goal 2 | Pending |
| REQ-05 | **Loan & Allowance Management**: Manage recurring taxable/de minimis allowances and deductions for SSS, Pag-IBIG, and Cash Advance (Vale) loans. | SPEC Goal 2 | Pending |
| REQ-06 | **Interactive Overhaul Payroll Grid**: Build a multi-tab React grid component supporting batch entry, real-time formula updates, and DTR CSV log import. | SPEC Goal 3 | Pending |
| REQ-07 | **Itemized PDF Payslip Generator**: Generate and export printable/downloadable PDF payslips showing complete breakdown of earnings, premiums, deductions, and Net Pay. | SPEC Goal 4 | Pending |
| REQ-08 | **General Ledger Auto-Posting**: Automatically generate balanced journal entries (`Salaries Expense`, `SSS Payable`, `PhilHealth Payable`, `Pag-IBIG Payable`, `Withholding Tax Payable`, `Net Payroll Payable`) when payroll is approved. | SPEC Goal 4 | Pending |

