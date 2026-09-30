---
phase: 3
plan: 2
wave: 2
depends_on:
  - 1-PLAN.md
gap_closure: false
---

# Plan 3.2: React UI Refactor - Tab Layout & Payroll Grid

## Objective
Refactor the monolithic `PayrollView.tsx` into a modular 5-tab workspace and implement the overhauled Payroll Grid matching the clinic's comprehensive rate sheets, using the newly exposed batch calculation API.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/phases/3/RESEARCH.md
- src/renderer/src/components/PayrollView.tsx

## Tasks

<task type="auto">
  <name>Tab Navigation & Component Extraction</name>
  <files>
    src/renderer/src/components/PayrollView.tsx
    src/renderer/src/components/payroll/PayrollDirectoryTab.tsx
    src/renderer/src/components/payroll/PayrollHistoryTab.tsx
  </files>
  <action>
    Refactor `PayrollView.tsx` layout to support 5 tabs: [Payroll Grid], [DOLE Settings], [DTR Import], [History], [Directory].
    
    Steps:
    1. Create a new `src/renderer/src/components/payroll/` directory.
    2. Extract the existing DIRECTORY view logic from `PayrollView.tsx` into `PayrollDirectoryTab.tsx`.
    3. Extract the existing HISTORY view logic into `PayrollHistoryTab.tsx`.
    4. Update `PayrollView.tsx` state to support 5 views: `'GRID' | 'SETTINGS' | 'IMPORT' | 'HISTORY' | 'DIRECTORY'`.
    5. Implement a clean tabbed navigation header in `PayrollView.tsx`.
    
    AVOID: Changing the underlying functionality of Directory and History views.
    USE: React functional components and pass necessary props (like employees, history state) down from `PayrollView`.
  </action>
  <verify>
    npm run build:win || npm run build
  </verify>
  <done>
    Directory and History views are successfully extracted and `PayrollView` serves as a tab container without build errors.
  </done>
</task>

<task type="auto">
  <name>Overhauled Payroll Grid (Tab 1)</name>
  <files>
    src/renderer/src/components/payroll/PayrollGridTab.tsx
    src/renderer/src/components/PayrollView.tsx
  </files>
  <action>
    Implement the comprehensive DOLE-compliant payroll grid.
    
    Steps:
    1. Create `PayrollGridTab.tsx`.
    2. Build a multi-column table displaying Employee Profile, Attendance Demerits (Late/Undertime/Absence), DOLE Overtime & Premium Pay (16 categories), Allowances, Total Gross, Statutory Deductions, Loans, and Net Pay.
    3. Implement collapsible column groups (e.g., a toggle between "Compact" and "Full Breakdown" for the 16 DOLE categories to avoid horizontal scroll fatigue).
    4. Connect the grid to `window.api.batchCalculatePayroll` for real-time recalculation when hours/demerits are manually edited in the cells.
    5. Add a sticky bottom summary bar totaling Gross, Deductions, and Net Payout.
    6. Integrate `PayrollGridTab` into `PayrollView`'s `'GRID'` tab.
    
    AVOID: Duplicating gross-to-net math in the frontend; strictly rely on `window.api.batchCalculatePayroll` or `calculateEmployeePayroll`.
    USE: Local state for input values, debounced before sending to the IPC for recalculation.
  </action>
  <verify>
    npm run build:win || npm run build
  </verify>
  <done>
    `PayrollGridTab.tsx` is implemented and integrated, compiling successfully.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Interactive multi-tab Payroll Overhaul UI grid matching clinic sheets is present.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] Build completes successfully
