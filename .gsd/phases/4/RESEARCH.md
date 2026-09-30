# Phase 4: Payslip PDF Generator & General Ledger Integration — Research

## Executive Summary

Phase 4 completes the DOLE-compliant HR & Payroll Overhaul by implementing:
1. Itemized individual and batch payslip PDF generation (REQ-07).
2. Automated posting of balanced General Ledger journal entries upon payroll approval (REQ-08).
3. Integration with the application's Period Lock security controls and Manager Override PIN verification.

This document details the architectural mechanisms, exact Chart of Accounts (COA) debit/credit mapping, and the approval security workflow required for Phase 4 implementation.

---

## 1. Export & PDF Generation Architecture

### Current Implementation in the Application
- **Excel Export**:
  - Located in [src/main/services/export.service.ts](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/export.service.ts#L7-L84).
  - Uses `exceljs` to assemble structured workbooks in memory, prompts user destination via `dialog.showSaveDialog`, and writes output using `fs.writeFileSync`.
- **Existing PDF Export**:
  - Registered via IPC handler `export:printToPDF` in [src/main/index.ts](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/index.ts#L872-L898).
  - Works by capturing the active `BrowserWindow` from `event.sender`, injecting temporary `@media print` CSS, and calling `win.webContents.printToPDF(...)`.
  - Consumed by `FinancialStatementsView.tsx` (lines 85–115) and `GeneralLedgerView.tsx` (line 277), where UI controls and sidebars are temporarily hidden via direct DOM mutations before export.
- **Current Payslip UI & Printing**:
  - In [src/renderer/src/components/payroll/PayrollHistoryTab.tsx](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/renderer/src/components/payroll/PayrollHistoryTab.tsx#L296), viewing an individual payslip renders a modal with a simple `<button onClick={() => window.print()}>Print Payslip</button>`, triggering Electron's browser print dialog for the entire application window.
  - No batch payslip PDF export or direct PDF file export exists yet.

### Limitations of Active-Window `printToPDF` for Payslips
1. **Screen Disruption & DOM Mutations**: Active window capture requires modifying the renderer DOM, hiding sidebars, showing/hiding modals, and causes visual flashing.
2. **Inability to Generate Batch Payslips**: A payroll run typically contains 10 to 50 employees. In the active window approach, generating individual or batch payslips would require cycling through 50 modal states or presenting 50 separate save dialogs.

### Recommended Pattern: Headless BrowserWindow in Main Process (`ExportService`)
The optimal pattern for Electron 39 desktop apps is generating the PDF off-screen in the main process:
1. **Offscreen Headless Window**:
   - Instantiate an invisible `new BrowserWindow({ show: false, webPreferences: { offscreen: true } })`.
2. **Standard HTML/CSS Template**:
   - Render clean, itemized payslip HTML with inline styles and `@media print` CSS rules.
   - For **Batch Payslip PDF**: Include all employee payslips in a single HTML document separated by `<div style="page-break-after: always;"></div>`. This produces a single multi-page PDF document (1 page per employee).
   - For **Individual Payslip PDF**: Render the single employee payslip (1 page).
3. **Load and Print**:
   - Load HTML via `hiddenWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)})`.
   - On `did-finish-load`, invoke `hiddenWin.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 } })`.
4. **File Persistence & Cleanup**:
   - Prompt user destination once via `dialog.showSaveDialog` (defaulting to e.g. `Payslip_PY-001_JuanDelaCruz.pdf` or `Batch_Payslips_PY-001.pdf`).
   - Write PDF buffer to disk via `fs.writeFileSync(filePath, data)`.
   - Destroy `hiddenWin`.
   - Log activity in `AuditService.logAction`.
5. **IPC Endpoints**:
   - `export:payslipPDF(payslipId: string)`: Exports single employee payslip.
   - `export:batchPayslipsPDF(journalEntryId: string)`: Exports multi-page PDF of all payslips in that payroll run.

---

## 2. General Ledger Integration & Chart of Accounts (COA) Mapping

### Accounting Requirements (REQ-08)
When a payroll run is approved, the system must automatically create a balanced General Ledger journal entry reflecting gross earnings, statutory withholdings (employee and employer shares), loan deductions, and net payroll liability.

### Current Database State
In [prisma/seed.ts](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/prisma/seed.ts#L48-L81), existing accounts include:
- `1010`: Cash in Bank (Asset)
- `1200`: Accounts Receivable (Asset)
- `2010`: Accounts Payable (Liability)
- `2040`: Salaries Payable (Liability)
- `2050`: Expanded Withholding Tax (EWT) Payable (Liability)
- `5100`: Salaries and Wages (Expense)

In [src/main/services/payroll.service.ts](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/payroll.service.ts#L278-L294), the interim Phase 2 posting:
- Debited `5100` (Gross Pay).
- Credited `2040` (Combined Statutory Payables and Other Deductions).
- Credited `2050` (Withholding Tax).
- Credited `1010` (Cash in Bank).

**Critical Conflicts with Existing Services**:
1. Account `2050` is specifically dedicated to Expanded Withholding Tax (EWT) for Form 0619-E / 1601-EQ in [src/main/services/tax.service.ts](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/tax.service.ts#L158), where it queries `line.entry.payee` for supplier TIN and ATC WI010. Posting payroll taxes to `2050` pollutes BIR Form 0619-E/1601-EQ and causes null payee crashes.
2. In Philippine accounting, Withholding Tax on Compensation is reported under BIR Form 1601-C and must have its own liability account (e.g. `2051`).
3. SSS, PhilHealth, and Pag-IBIG payables should be tracked in specific liability accounts (`2041`, `2042`, `2043`) rather than lumped into `2040`.
4. Accrual accounting dictates crediting `2040 Salaries / Net Payroll Payable` upon approval. Disbursement (cash/bank drop) occurs when payroll is paid.
5. Employer (ER) statutory contributions calculated in [src/main/services/payroll-calculator.ts](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/payroll-calculator.ts#L116-L137) represent additional company expense and must be debited to `5110 Employer Statutory Expense` and credited to the respective statutory payables alongside employee withholdings.

### Target Chart of Accounts (COA) Structure
The following accounts must be seeded or ensured in `prisma.account` (`account_id` has a strict Foreign Key reference to `Account.code` in [prisma/schema.prisma:188](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/prisma/schema.prisma#L188)):

| Account Code | Account Name | Account Type | Role in Payroll Auto-Posting |
|--------------|--------------|--------------|------------------------------|
| `5100` | Salaries and Wages Expense | `type-expense` | **DEBIT**: Total Gross Pay (Base + OT + ND + Allowances) |
| `5110` | Employer Statutory Contributions Expense | `type-expense` | **DEBIT**: Total ER Share (SSS ER + EC + PhilHealth ER + Pag-IBIG ER) |
| `2040` | Salaries / Net Payroll Payable | `type-liability` | **CREDIT**: Total Net Take-Home Pay |
| `2041` | SSS & EC Premium Payable | `type-liability` | **CREDIT**: SSS EE Share + SSS ER Share + EC Contribution |
| `2042` | PhilHealth Premium Payable | `type-liability` | **CREDIT**: PhilHealth EE Share + PhilHealth ER Share |
| `2043` | Pag-IBIG Premium Payable | `type-liability` | **CREDIT**: Pag-IBIG EE Share + Pag-IBIG ER Share |
| `2051` | Withholding Tax Payable - Compensation | `type-liability` | **CREDIT**: Total BIR Withholding Tax (Form 1601-C) |
| `1210` | Advances to Officers & Employees | `type-asset` | **CREDIT**: Total Cash Advance (Vale) & Loan Amortizations |

### Mathematical Balance Verification
$$\text{Total Debits} = \text{Gross Pay} + \text{ER Statutory}$$
$$\text{Total Credits} = \text{Net Pay} + (\text{EE Statutory} + \text{ER Statutory}) + \text{Withholding Tax} + \text{Loan Deductions}$$

Since gross compensation by definition equals:
$$\text{Gross Pay} = \text{Net Pay} + \text{EE Statutory} + \text{Withholding Tax} + \text{Loan Deductions}$$

Therefore:
$$\text{Total Debits} = \text{Total Credits}$$
The journal entry balances to the exact cent and satisfies `LedgerService.createJournalEntry` balance validation (`Math.abs(totalDebit - totalCredit) <= 0.005`).

---

## 3. Approval Workflow, Period Lock, and Override PIN Verification

### Existing Period Lock Mechanisms
- **System Settings**:
  - `SystemSetting.lock_date` and `SystemSetting.override_pin` in [prisma/schema.prisma:347](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/prisma/schema.prisma#L347).
  - Evaluated via `LedgerService.getLockDate()` in [src/main/services/ledger.service.ts:59](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/ledger.service.ts#L59).
  - PIN verified via bcrypt in `LedgerService.verifyManagerPin(pin)` ([ledger.service.ts:104](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/ledger.service.ts#L104)).
- **Ledger Security in `createJournalEntry`**:
  - In [src/main/services/ledger.service.ts:408-413](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/ledger.service.ts#L408-L413):
    ```typescript
    const setting = await prisma.systemSetting.findFirst();
    if (setting?.lock_date && entryDate <= setting.lock_date) {
      if (!verifyPinMatch(data.overridePin, setting.override_pin)) {
        throw new Error(`PERIOD LOCKED: You cannot post transactions on or before ${setting.lock_date.toISOString().split('T')[0]}. Invalid or missing Override PIN.`);
      }
    }
    ```
- **Existing Disconnect in Payroll**:
  - `PayrollService.processPayroll` directly calls `tx.journalEntry.create` ([src/main/services/payroll.service.ts:296](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/main/services/payroll.service.ts#L296)), completely skipping the period lock date check and override PIN validation.
  - `PayrollGridTab.tsx` ([src/renderer/src/components/payroll/PayrollGridTab.tsx:90](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/renderer/src/components/payroll/PayrollGridTab.tsx#L90)) does not prompt for an override PIN when backdating a payroll run.

### Target Approval Workflow & Security Enforcement
1. **Frontend Period Lock Detection (`PayrollGridTab.tsx`)**:
   - Query `api.getLockDate()` on mount.
   - Compute `isLocked = lockDate ? new Date(payrollDate) <= new Date(lockDate) : false`.
   - If `isLocked`:
     - Display a warning banner: *"Payroll cutoff date falls in a locked accounting period (on or before YYYY-MM-DD). Manager Override PIN required to approve and post."*
     - Provide an override PIN input or open the Manager Override PIN modal upon clicking "Approve & Post Payroll" (matching the pattern in [AdjustingEntryForm.tsx:431-455](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/renderer/src/components/AdjustingEntryForm.tsx#L431-L455) and [EndOfDaySummaryView.tsx:504-580](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Phase-4-Researcher-gsd-researcher-290877f7/src/renderer/src/components/EndOfDaySummaryView.tsx#L504-L580)).
2. **Backend Validation (`PayrollService.processPayroll`)**:
   - Accept `overridePin?: string` in `processPayroll(data)`.
   - Check `setting.lock_date` against `new Date(data.date)`.
   - If `date <= setting.lock_date`, call `verifyPinMatch(data.overridePin, setting.override_pin)`.
   - If missing or invalid, reject immediately with `PERIOD LOCKED: You cannot post payroll on or before ${lockDate}. Invalid or missing Override PIN.`
   - If valid, complete transaction and record audit log via `AuditService.logAction(userId, 'PAYROLL_POSTED_LOCKED_PERIOD', `Payroll ${data.referenceNo} approved in locked period with Manager Override PIN`)`.

---

## 4. Implementation Checklist for Phase 4 Plans

- [ ] **Chart of Accounts Updates**:
  - Add missing accounts (`2041`, `2042`, `2043`, `2051`, `5110`, `1210`) in `prisma/seed.ts` and ensure startup upsert in `LedgerService.init()` or migration.
- [ ] **Payroll Service Auto-Posting Overhaul**:
  - Refactor `PayrollService.processPayroll` to create balanced double-entry lines using the complete COA debit/credit breakdown (including employer statutory expenses).
  - Add lock date and manager override PIN validation before posting.
- [ ] **Headless Payslip PDF Service**:
  - Add `ExportService.generatePayslipPDF` and `ExportService.generateBatchPayslipsPDF`.
  - Wire IPC handlers in `src/main/index.ts` and expose via `src/preload/index.ts`.
- [ ] **Payroll UI Updates**:
  - Add single-click "Export PDF" to individual payslip modal in `PayrollHistoryTab.tsx`.
  - Add "Batch Export PDF" to payroll history run headers in `PayrollHistoryTab.tsx`.
  - Add Period Lock detection and Manager Override PIN modal to `PayrollGridTab.tsx`.
