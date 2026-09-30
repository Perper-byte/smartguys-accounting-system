# Phase 1 Research: Payroll Settings, Schema Extensions, and Service Helpers

## 1. SystemSetting Structure & Dynamic Payroll Rate Multipliers

### Current Structure (`prisma/schema.prisma:281-288`)
```prisma
model SystemSetting {
  id            String    @id @default(uuid())
  lock_date     DateTime? @db.Date
  auto_lock_day Int?      
  override_pin  String?   @db.VarChar(50)

  @@map("system_settings")
}
```

### Required Modifications for Rate Multipliers
To support dynamic Philippine payroll multiplier rates without hardcoding constants in service functions, add decimal rate fields to `SystemSetting`:

```prisma
model SystemSetting {
  id            String    @id @default(uuid())
  lock_date     DateTime? @db.Date
  auto_lock_day Int?      
  override_pin  String?   @db.VarChar(50)

  // Dynamic Payroll Multipliers (Default Philippine DOLE standard multipliers)
  ot_rate            Decimal @default(1.25) @db.Decimal(5, 4) // Regular Overtime (125%)
  night_diff_rate    Decimal @default(0.10) @db.Decimal(5, 4) // Night Differential (10%)
  rest_day_rate      Decimal @default(1.30) @db.Decimal(5, 4) // Rest Day Work (130%)
  special_holiday_rate Decimal @default(1.30) @db.Decimal(5, 4) // Special Non-Working Day (130%)
  legal_holiday_rate   Decimal @default(2.00) @db.Decimal(5, 4) // Regular/Legal Holiday (200%)

  @@map("system_settings")
}
```

---

## 2. New Prisma Models & Fields for Allowances, Loans, and Statutory Contributions

### A. Employee Allowances (`EmployeeAllowance`)
Allowances can be taxable or non-taxable and recurring or one-time.
```prisma
model EmployeeAllowance {
  id           String   @id @default(uuid()) @db.VarChar(50)
  employee_id  Int
  name         String   @db.VarChar(100) // e.g., "De Minimis / Transportation"
  amount       Decimal  @default(0.00) @db.Decimal(15, 2)
  is_taxable   Boolean  @default(false)
  is_recurring Boolean  @default(true)
  created_at   DateTime @default(now())

  employee Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  @@map("employee_allowances")
}
```

### B. Employee Loans / Amortization (`EmployeeLoan`)
Supports SSS Loan, Pag-IBIG Loan, Cash Advance, etc. with balance tracking.
```prisma
model EmployeeLoan {
  id             String   @id @default(uuid()) @db.VarChar(50)
  employee_id    Int
  type           String   @db.VarChar(50) // "SSS", "PAGIBIG", "CASH_ADVANCE"
  principal      Decimal  @db.Decimal(15, 2)
  monthly_amort  Decimal  @db.Decimal(15, 2)
  balance        Decimal  @db.Decimal(15, 2)
  is_active      Boolean  @default(true)
  created_at     DateTime @default(now())

  employee Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  @@map("employee_loans")
}
```

### C. Statutory Contribution Rates (`StatutoryRateTable`)
Stores thresholds and contribution rates for SSS, PhilHealth, and Pag-IBIG (or standard rate configuration).
```prisma
model StatutoryRateTable {
  id              String   @id @default(uuid()) @db.VarChar(50)
  agency          String   @db.VarChar(20) // "SSS", "PHILHEALTH", "PAGIBIG"
  min_salary      Decimal  @default(0.00) @db.Decimal(15, 2)
  max_salary      Decimal  @default(999999.99) @db.Decimal(15, 2)
  ee_rate         Decimal  @default(0.00) @db.Decimal(7, 4) // Employee share rate/amount
  er_rate         Decimal  @default(0.00) @db.Decimal(7, 4) // Employer share rate/amount
  fixed_ee_amount Decimal? @db.Decimal(15, 2)               // For fixed tiered amounts (SSS/Pag-IBIG cap)
  fixed_er_amount Decimal? @db.Decimal(15, 2)
  effective_year  Int      @default(2026)

  @@map("statutory_rate_tables")
}
```

### D. Updating `Employee` (`prisma/schema.prisma:199-214`)
Add relation links:
```prisma
model Employee {
  // ... existing fields ...
  allowances EmployeeAllowance[]
  loans      EmployeeLoan[]
  payslips   Payslip[]

  @@map("employees")
}
```

---

## 3. Rate Helpers Placement & Service Structure

### Location
Place rate calculation functions in `src/main/services/payroll.service.ts` or a new standalone helper module at `src/main/services/payroll-calculator.ts` imported by `PayrollService`.

### Proposed Helper Methods (`src/main/services/payroll.service.ts`)
1. `getPayrollSettings()` — Fetches dynamic rate multipliers from `SystemSetting` (or fallback defaults if not configured).
2. `calculateHourlyRate(monthlySalary: number)` — Derives hourly rate using DOLE standard formula (`(monthlySalary * 12) / 261 / 8` or company multiplier).
3. `calculateOvertimeAndDiff(hourlyRate: number, hours: OvertimeHours, multipliers: PayrollMultipliers)` — Calculates precise overtime, night differential, and holiday premiums based on dynamic `SystemSetting` rates.
4. `calculateStatutoryDeductions(monthlySalary: number)` — Queries `StatutoryRateTable` to calculate exact EE and ER contributions for SSS, PhilHealth, and Pag-IBIG.
