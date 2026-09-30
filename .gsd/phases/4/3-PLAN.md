---
phase: 4
plan: 3
wave: 3
gap_closure: false
depends_on: [2]
---

# Plan 4.3: Payroll UI Integration

## Objective
Update the interactive payroll UI to expose the new PDF export features (individual and batch) and implement the frontend Period Lock detection modal for override PIN verification during payroll approval.

## Context
Load these files for context:
- .gsd/phases/4/RESEARCH.md
- src/renderer/src/components/payroll/PayrollGridTab.tsx
- src/renderer/src/components/payroll/PayrollHistoryTab.tsx

## Tasks

<task type="auto">
  <name>Add Period Lock Security to PayrollGridTab</name>
  <files>
    src/renderer/src/components/payroll/PayrollGridTab.tsx
  </files>
  <action>
    Implement lock date detection and PIN prompt prior to calling `api.processPayroll`.
    
    Steps:
    1. On component mount or date change, fetch the system lock date (`api.getLockDate` or similar existing endpoint).
    2. Evaluate if the selected payroll period date is less than or equal to the lock date.
    3. If locked, show a warning banner in the UI informing the user that an Override PIN is required.
    4. Upon clicking "Approve & Post Payroll", if locked, pop up an Override PIN modal. Capture the PIN and pass it as `overridePin` to `api.processPayroll`.
    5. Handle the backend locked rejection gracefully by surfacing the error message.
  </action>
  <verify>
    npm run build:renderer
  </verify>
  <done>
    The UI properly displays the period lock warning and correctly gathers and forwards the override PIN when attempting to post backdated payroll.
  </done>
</task>

<task type="auto">
  <name>Add PDF Export Controls to PayrollHistoryTab</name>
  <files>
    src/renderer/src/components/payroll/PayrollHistoryTab.tsx
  </files>
  <action>
    Wire the new PDF export IPC methods into the payroll history view.
    
    Steps:
    1. Locate the single payslip view/modal in `PayrollHistoryTab.tsx`. Replace the active-window print button (`window.print()`) with a button calling `api.exportPayslipPDF(payslip.id)`.
    2. In the payroll run header/list view, add a "Batch Export PDF" button for a selected payroll run.
    3. Wire this button to call `api.exportBatchPayslipsPDF(payrollRun.journalEntryId)`.
    4. Add loading/disabled states while the export is in progress.
  </action>
  <verify>
    npm run build:renderer
  </verify>
  <done>
    Frontend builds successfully, and UI buttons are bound to the correct `api` endpoints for exporting PDFs.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Users can trigger batch and individual PDF exports from the UI.
- [ ] The override PIN modal successfully integrates with the backend process check.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
