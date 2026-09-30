---
phase: 3
plan: 3
wave: 3
depends_on:
  - 2-PLAN.md
gap_closure: false
---

# Plan 3.3: React UI Refactor - Rate Settings & DTR Import

## Objective
Implement the final two tabs for the Payroll workspace: The DOLE Rate Settings tab for system configuration and the DTR CSV Import tab to automate timekeeping entry using the classifier.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/phases/3/RESEARCH.md
- src/renderer/src/components/PayrollView.tsx
- src/renderer/src/components/payroll/PayrollSettingsTab.tsx
- src/renderer/src/components/payroll/DtrImportTab.tsx

## Tasks

<task type="auto">
  <name>DOLE Rate Settings (Tab 2)</name>
  <files>
    src/renderer/src/components/payroll/PayrollSettingsTab.tsx
    src/renderer/src/components/PayrollView.tsx
  </files>
  <action>
    Implement the settings interface for DOLE multipliers.
    
    Steps:
    1. Create `PayrollSettingsTab.tsx`.
    2. Fetch current settings using `window.api.getPayrollSettings()` on mount.
    3. Render a form displaying the 16 DOLE rate multipliers (Regular, Night Diff, Rest Day, Holidays, etc.) alongside their standard statutory defaults.
    4. Implement "Save Changes" using `window.api.updatePayrollSettings(settings)`.
    5. Integrate this tab into `PayrollView.tsx` under the `'SETTINGS'` view.
    
    AVOID: Unvalidated inputs. Ensure inputs are restricted to valid decimal multipliers (e.g., 1.25, 2.00).
    USE: Clear visual indicators if a customized rate deviates from the standard DOLE baseline.
  </action>
  <verify>
    npm run build:win || npm run build
  </verify>
  <done>
    `PayrollSettingsTab` compiles cleanly and is successfully registered in `PayrollView.tsx`.
  </done>
</task>

<task type="auto">
  <name>DTR CSV Import Modal (Tab 3)</name>
  <files>
    src/renderer/src/components/payroll/DtrImportTab.tsx
    src/renderer/src/components/PayrollView.tsx
  </files>
  <action>
    Implement the DTR CSV/Excel import tab.
    
    Steps:
    1. Create `DtrImportTab.tsx`.
    2. Add a drag-and-drop file picker supporting `.csv`, `.xlsx` (via `xlsx` package).
    3. Use `XLSX.read(arrayBuffer)` to parse the file into JSON rows.
    4. Auto-match the parsed rows against the active `employees` list (via ID or fuzzy name match).
    5. Pass the raw logs through `aggregateDtrRecords` from `dtr-classifier.ts`.
    6. Render a preview table showing matched employees, their computed demerits, and DOLE hour buckets.
    7. Provide an "Apply to Payroll Grid" action that lifts the parsed state up to `PayrollView` to populate the `GRID` tab, then auto-switches the view to `'GRID'`.
    
    AVOID: Re-implementing parsing logic on the backend; all DTR processing happens strictly in the renderer.
    USE: Warning badges for rows that cannot be automatically matched to an employee profile.
  </action>
  <verify>
    npm run build:win || npm run build
  </verify>
  <done>
    `DtrImportTab` compiles cleanly, handles file drops via `xlsx`, and connects to the classifier.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Configurable DOLE rate multipliers settings UI is present.
- [ ] DTR CSV log import UI is fully implemented.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] Build completes successfully without regressions
