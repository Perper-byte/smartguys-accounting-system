# Phase 2 Research: Gross-to-Net Payroll Computation Service

> **Phase**: 2  
> **Topic**: Philippine Statutory Tables, Attendance Demerits, Allowances & Loans Pipeline  
> **Related Requirements**: REQ-02, REQ-04, REQ-05  

---

## 1. Philippine Statutory Rules & Contribution Tables (2025–2026)

### A. Social Security System (SSS) — RA 11199 & Circular No. 2024-006

Pursuant to the Social Security Act of 2018 (RA 11199) and SSS Circular No. 2024-006 (effective January 2025 onwards):

1. **Contribution Rates & Split**:
   - Total Regular Contribution Rate: **15.0%** of Monthly Salary Credit (MSC).
   - **Employee (EE) Share**: **5.0%**
   - **Employer (ER) Share**: **10.0%**
   - **Monthly Salary Credit (MSC) Range**:
     - Minimum MSC: **₱5,000.00** (for compensation below ₱5,250.00).
     - Maximum MSC: **₱35,000.00** (for compensation ₱34,750.00 and above).
     - Bracket Increment: ₱500.00 steps.

2. **Workers' Investment and Savings Program (WISP / MySSS Pension Booster)**:
   - For MSCs **up to ₱20,000.00**, contributions apply solely to the **Regular Social Security Program**.
     - Regular SS EE Max: `₱20,000 × 5% = ₱1,000.00`
     - Regular SS ER Max: `₱20,000 × 10% = ₱2,000.00`
   - For MSCs **exceeding ₱20,000.00** (up to ₱35,000.00, max WISP MSC = ₱15,000.00), the excess is automatically allocated to **WISP**:
     - `WISP_MSC = min(15000, max(0, MSC - 20000))`
     - WISP EE Share: `WISP_MSC × 5%` (Max: ₱750.00)
     - WISP ER Share: `WISP_MSC × 10%` (Max: ₱1,500.00)
   - **Combined SSS EE Deduction**: `MSC × 5%` (Min: ₱250.00, Max: ₱1,750.00).

3. **Employees' Compensation (EC) Program** (Paid 100% by Employer; no deduction from employee):
   - For MSC < ₱20,000.00: **₱10.00**
   - For MSC ≥ ₱20,000.00: **₱30.00**
   - **Total SSS ER Share**: `(MSC × 10%) + EC` (Min: ₱510.00, Max: ₱3,530.00).

4. **MSC Bracket Lookup Algorithm**:
   ```typescript
   export function getSSSMonthlySalaryCredit(compensation: number): number {
     if (compensation < 5250) return 5000;
     if (compensation >= 34750) return 35000;
     // Increments of 500 with midpoints at 250 and 750
     return Math.min(35000, Math.floor((compensation - 5250) / 500) * 500 + 5500);
   }
   ```

---

### B. Philippine Health Insurance Corporation (PhilHealth) — RA 11223

Under the Universal Health Care (UHC) Act (RA 11223) and PhilHealth directives:

1. **Contribution Rate & Split**:
   - Premium Rate: **5.0%** of basic monthly salary.
   - Shared equally: **50% Employee (2.5%)** and **50% Employer (2.5%)**.
2. **Floor & Ceiling**:
   - Monthly Income Floor: **₱10,000.00** (Minimum total premium: ₱500.00; EE: ₱250.00, ER: ₱250.00).
   - Monthly Income Ceiling: **₱100,000.00** (Maximum total premium: ₱5,000.00; EE: ₱2,500.00, ER: ₱2,500.00).
3. **Computation Formula**:
   ```typescript
   export function calculatePhilHealth(monthlySalary: number) {
     const clamped = Math.min(100000, Math.max(10000, monthlySalary));
     const totalPremium = Math.round(clamped * 0.05 * 100) / 100;
     const eeShare = Math.round((totalPremium / 2) * 100) / 100;
     const erShare = Math.round((totalPremium - eeShare) * 100) / 100;
     return { totalPremium, eeShare, erShare };
   }
   ```
   *Semi-monthly cutoff*: Divide by 2 (`eeShare / 2`), or deduct full amount in the 2nd monthly cutoff.

---

### C. Home Development Mutual Fund (Pag-IBIG / HDMF) — Circular No. 460

Under Pag-IBIG Fund Circular No. 460 (effective February 2024 onwards):

1. **Maximum Fund Salary (MFS)**:
   - Raised from ₱5,000.00 to **₱10,000.00**.
2. **Standard Mandatory Rates**:
   - Monthly compensation ≤ ₱1,500.00: EE 1.0%, ER 2.0%.
   - Monthly compensation > ₱1,500.00: EE 2.0%, ER 2.0%.
3. **Standard Mandatory Contribution Amounts**:
   - For employees earning ₱10,000.00 and above:
     - **Employee (EE) Share**: **₱200.00 / month** (capped).
     - **Employer (ER) Share**: **₱200.00 / month** (capped).
     - Total Standard Contribution: **₱400.00 / month**.
4. **Voluntary / Upgraded Contributions**:
   - Employees may opt for additional voluntary deductions (e.g., MP2 or upgraded regular savings beyond ₱200.00).
   - Employer is **not required** to match voluntary excess contributions beyond the ₱200.00 statutory cap.

---

### D. BIR TRAIN Law Withholding Tax on Compensation (RA 10963)

Under the Tax Reform for Acceleration and Inclusion (TRAIN) Law (RA 10963) and BIR Revenue Regulations No. 11-2018 (effective January 1, 2023 onwards):

1. **Taxable Base Definition**:
   `Taxable Base = (Gross Taxable Compensation) - (Employee SSS + PhilHealth + Pag-IBIG mandatory contributions)`
   - *Exemptions*: Statutory Minimum Wage Earners (SMW) are exempt from withholding tax on basic wage, holiday pay, overtime, and night differential.
   - De minimis benefits within statutory caps and non-taxable allowances are excluded from the Taxable Base.

2. **Semi-Monthly Withholding Tax Table (Standard for 15th/30th Cutoffs)**:

| Tier | Semi-Monthly Taxable Base | Prescribed Withholding Tax Formula |
|:----:|:--------------------------|:-----------------------------------|
| 1 | ₱10,417.00 and below | ₱0.00 (0.0%) |
| 2 | ₱10,417.01 – ₱16,666.00 | ₱0.00 + 15% of excess over ₱10,417.00 |
| 3 | ₱16,666.01 – ₱33,332.00 | ₱937.50 + 20% of excess over ₱16,667.00 |
| 4 | ₱33,332.01 – ₱83,332.00 | ₱4,270.70 + 25% of excess over ₱33,333.00 |
| 5 | ₱83,332.01 – ₱333,332.00 | ₱16,770.70 + 30% of excess over ₱83,333.00 |
| 6 | Over ₱333,332.00 | ₱91,770.70 + 35% of excess over ₱333,333.00 |

3. **Monthly Withholding Tax Table**:

| Tier | Monthly Taxable Base | Prescribed Withholding Tax Formula |
|:----:|:---------------------|:-----------------------------------|
| 1 | ₱20,833.00 and below | ₱0.00 (0.0%) |
| 2 | ₱20,833.01 – ₱33,332.00 | ₱0.00 + 15% of excess over ₱20,833.00 |
| 3 | ₱33,332.01 – ₱66,666.00 | ₱1,875.00 + 20% of excess over ₱33,333.00 |
| 4 | ₱66,666.01 – ₱166,666.00 | ₱8,541.80 + 25% of excess over ₱66,667.00 |
| 5 | ₱166,666.01 – ₱666,666.00 | ₱33,541.80 + 30% of excess over ₱166,667.00 |
| 6 | Over ₱666,666.00 | ₱183,541.80 + 35% of excess over ₱666,667.00 |

---

## 2. Attendance Demerits Calculation

### A. Legal Basis & DOLE Principles
1. **"No Work, No Pay" Principle**: Under Philippine Labor Law, employees are compensated for time worked. Unworked hours during scheduled shifts are deducted proportionately.
2. **Prohibition of Offsetting (Labor Code Article 88)**: Undertime cannot be offset by overtime on another day or even on the same day.
3. **No Arbitrary Penalties (Labor Code Article 113/114)**: Employers may not impose arbitrary fines for tardiness (e.g., deducting 1 hour for 5 minutes late). Deductions must strictly equal the monetary value of the exact unworked minutes.

### B. Base Rate Derivation
Under the DOLE Handbook on Workers' Statutory Monetary Benefits, rates are determined by annual factor:
- **Factor 261**: 5 working days/week (M-F), rest days unworked and unpaid (`(Daily Rate × 261) / 12 = Monthly Salary`). Already in `src/main/services/payroll-calculator.ts:46`.
- **Factor 313**: 6 working days/week (M-Sat).
- **Factor 365**: All 365 days paid.

**Formulas**:
- `Daily Rate = (Monthly Salary × 12) / Factor` (Default Factor = 261)
- `Hourly Rate = Daily Rate / 8`
- `Minute Rate = Hourly Rate / 60`

### C. Demerit Formulas
1. **Tardiness / Late Minutes**:
   `Deduction_Late = late_minutes × Minute Rate`
2. **Undertime Hours / Minutes**:
   `Deduction_Undertime = (undertime_hours × Hourly Rate) + (undertime_minutes × Minute Rate)`
3. **Unexcused Absences**:
   `Deduction_Absence = absence_days × Daily Rate`
4. **Total Attendance Demerits**:
   `Total Demerits = Deduction_Late + Deduction_Undertime + Deduction_Absence`

### D. Impact on Gross-to-Net Computation
- For semi-monthly payroll: Scheduled base pay is `Monthly Salary / 2`.
- `Net Basic Pay = Scheduled Base Pay - Total Attendance Demerits`.
- Attendance demerits directly reduce the Gross Taxable Income base (wages not earned are non-taxable).

---

## 3. Recurring Allowances & Loan Amortizations in Gross-to-Net Pipeline

### A. Existing Schema Foundations
- `EmployeeAllowance` (`prisma/schema.prisma:341-353`):
  - `employee_id`: Int
  - `name`: String
  - `amount`: Decimal
  - `is_taxable`: Boolean
  - `is_recurring`: Boolean
- `EmployeeLoan` (`prisma/schema.prisma:356-368`):
  - `employee_id`: Int
  - `type`: String (`"SSS"`, `"PAGIBIG"`, `"CASH_ADVANCE"`)
  - `principal`: Decimal
  - `monthly_amort`: Decimal
  - `balance`: Decimal
  - `is_active`: Boolean

### B. Allowances: Taxable vs. De Minimis (BIR RR 5-2011 & RR 11-2018)
1. **De Minimis / Non-Taxable Allowances (`is_taxable == false`)**:
   - Exempt benefits: Rice allowance (up to ₱2,000/mo), uniform/clothing (₱6,000/yr), laundry (₱300/mo), medical cash allowance (₱1,500/semester).
   - **Pipeline Rule**: Included in Gross Pay, but **EXCLUDED** from Taxable Base when computing BIR Withholding Tax.
2. **Taxable Allowances (`is_taxable == true`)**:
   - Representation, performance bonuses, taxable stipends.
   - **Pipeline Rule**: Included in Gross Pay and **INCLUDED** in Taxable Base.
3. **Period Pro-rating**:
   - For semi-monthly runs, recurring monthly allowance is divided by 2: `allowance_amount / 2`.

### C. Loan Amortizations (SSS, Pag-IBIG, Vale / Cash Advance)
1. **Nature of Deduction**:
   - Loan amortizations are strictly **POST-TAX** deductions. They do not reduce BIR Withholding Tax.
2. **Amortization Deduction Rule**:
   - Scheduled semi-monthly deduction: `target_deduction = monthly_amort / 2`.
   - Capped by remaining balance: `actual_deduction = Math.min(target_deduction, loan.balance)`.
   - Cannot exceed remaining net pay after statutory deductions and withholding tax.
3. **Ledger & Balance Decrementing**:
   - When payroll is processed in `payroll.service.ts`:
     - Within the `prisma.$transaction`:
       `new_balance = loan.balance - actual_deduction`
       `is_active = new_balance > 0`
       Update `EmployeeLoan` record with `new_balance` and `is_active`.
4. **General Ledger Mapping (REQ-08)**:
   - Debit: `Salaries and Wages Expense` (`5100`) -> Total Gross Pay
   - Credit: `SSS Payable` -> Employee SSS + Employer SSS
   - Credit: `PhilHealth Payable` -> Employee PhilHealth + Employer PhilHealth
   - Credit: `Pag-IBIG Payable` -> Employee Pag-IBIG + Employer Pag-IBIG
   - Credit: `Withholding Tax Payable` (`2050` / tax account) -> Withholding Tax
   - Credit: `Advances to Officers & Employees` / `Accounts Receivable - Employees` -> Cash Advance (Vale) repayments
   - Credit: `SSS/Pag-IBIG Loan Payable` (or clearing liability) -> Government loan deductions
   - Credit: `Salaries Payable` (`2040`) or `Cash in Bank` (`1010`) -> Total Net Pay

---

## 4. End-to-End Gross-to-Net Pipeline Sequence (`payroll.service.ts`)

```text
[Input: Employee Profile, Monthly Salary, DTR Attendance Demerits, Overtime Hours, System Settings]
   │
   ├── Step 1: Base Rates
   │     Daily Rate   = (Monthly Salary × 12) / Factor (261)
   │     Hourly Rate  = Daily Rate / 8
   │     Minute Rate  = Hourly Rate / 60
   │
   ├── Step 2: Demerits
   │     Demerits = (Late Mins × Minute Rate) + (Undertime Hours × Hourly Rate) + (Absence Days × Daily Rate)
   │     Net Base Pay = (Monthly Salary / 2) - Demerits
   │
   ├── Step 3: Premium Pay (16 DOLE Categories via calculateOvertimeAndDiff)
   │     Total Overtime & Premium Pay = Σ (Category Hours × Hourly Rate × Multiplier)
   │
   ├── Step 4: Allowances (from EmployeeAllowance)
   │     Taxable Allowances     = Σ (is_taxable == true ? amount / 2 : 0)
   │     Non-Taxable Allowances = Σ (is_taxable == false ? amount / 2 : 0)
   │
   ├── Step 5: Gross Pay
   │     Total Gross Pay = Net Base Pay + Total Premium Pay + Taxable Allowances + Non-Taxable Allowances
   │
   ├── Step 6: Statutory Deductions (Pre-tax)
   │     SSS EE        = (getSSSMonthlySalaryCredit(Monthly Salary) × 5%) / 2
   │     PhilHealth EE = (calculatePhilHealth(Monthly Salary).eeShare) / 2
   │     Pag-IBIG EE   = (min(Monthly Salary, 10000) × 2%) / 2   // Capped at ₱100/semi-mo (₱200/mo)
   │     Total Statutory EE = SSS EE + PhilHealth EE + Pag-IBIG EE
   │
   ├── Step 7: Withholding Tax (BIR TRAIN Law)
   │     Taxable Income Base = (Net Base Pay + Total Premium Pay + Taxable Allowances) - Total Statutory EE
   │     Withholding Tax = calculateSemiMonthlyBIRTax(Taxable Income Base)
   │
   ├── Step 8: Post-Tax Loan Deductions (from EmployeeLoan)
   │     For each active loan:
   │       Deduction = min(monthly_amort / 2, loan.balance)
   │       Categorize: sss_loan, pagibig_loan, cash_advance
   │
   ├── Step 9: Net Pay & Total Deductions
   │     Total Deductions = Total Statutory EE + Withholding Tax + Total Loans + Other Deductions
   │     Net Pay = Total Gross Pay - Total Deductions
   │
   └── Step 10: Atomic Persistence ($transaction)
         1. Update EmployeeLoan balances and is_active flag.
         2. Post balanced multi-line JournalEntry (GL accounts: 5100, statutory payables, 2050, 1010/2040).
         3. Insert itemized Payslip records.
```

---

## 5. Architectural Recommendations for Phase 2 Implementation

1. **`payroll-calculator.ts`**:
   - Implement `calculateAttendanceDemerits(hourlyRate, demerits: AttendanceDemerits): DemeritBreakdown`.
   - Implement `calculateSSSContribution(monthlySalary): SSSContributionResult` (returning regular EE, regular ER, WISP EE, WISP ER, EC, total EE, total ER).
   - Implement `calculatePhilHealthContribution(monthlySalary): PhilHealthResult` (5% with ₱10k floor and ₱100k ceiling).
   - Implement `calculatePagIbigContribution(monthlySalary, voluntaryEE?): PagIbigResult` (2% up to ₱10k MFS cap = ₱200 EE / ₱200 ER).
   - Implement `calculateWithholdingTax(taxableIncome, period: 'SEMI_MONTHLY' | 'MONTHLY'): number` (TRAIN Law 6-tier schedule).

2. **`payroll.service.ts`**:
   - Refactor `calculateEmployeePayroll` to accept attendance demerits, pull active `EmployeeAllowance` and `EmployeeLoan` records for the employee, and run the 10-step pipeline.
   - Refactor `processPayroll` transaction to:
     - Decrement loan balances in `employee_loans` table.
     - Post itemized GL journal lines (debiting salaries expense, crediting separate statutory payables, tax payable, cash advance receivables, bank/salaries payable).
     - Save complete breakdown in `payslips` table.

3. **Prisma & Seed Considerations**:
   - Seed `StatutoryRateTable` with standard 2026 reference entries for SSS, PhilHealth, and Pag-IBIG for administrative visibility.
   - Ensure GL Chart of Accounts has specific statutory payable accounts if required (or map to existing accounts `2040`, `2050`).
