---
phase: 3
plan: 1
wave: 1
gap_closure: false
---

# Plan 3.1: Backend IPC Wiring & DTR Classifier Utility

## Objective
Extend the backend `payroll.service.ts` to support DOLE rate multiplier updates and batch payroll calculations, and establish the IPC bridge to expose these to the frontend. Additionally, create a pure utility for classifying raw DTR (Daily Time Record) shift logs into standard DOLE categories.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/phases/3/RESEARCH.md
- src/main/services/payroll.service.ts
- src/main/index.ts
- src/preload/index.ts
- src/preload/index.d.ts

## Tasks

<task type="auto">
  <name>Backend IPC & Services for Payroll</name>
  <files>
    src/main/services/payroll.service.ts
    src/main/index.ts
    src/preload/index.ts
    src/preload/index.d.ts
  </files>
  <action>
    Implement backend support for DOLE rate settings and batch payroll calculation.
    
    Steps:
    1. In `src/main/services/payroll.service.ts`, add `updatePayrollSettings(multipliers: Partial<PayrollMultipliers>)` to update `SystemSetting` using Prisma.
    2. Add `batchCalculatePayroll(employeeInputs)` to `payroll.service.ts` that loops through employee inputs, fetches their active allowances and loans via Prisma, and computes the gross-to-net via `this.calculateEmployeePayroll`.
    3. In `src/main/index.ts`, add IPC handlers for `payroll:getSettings`, `payroll:updateSettings`, `payroll:calculateEmployee`, and `payroll:batchCalculate`.
    4. In `src/preload/index.ts` and `src/preload/index.d.ts`, expose `getPayrollSettings`, `updatePayrollSettings`, `calculateEmployeePayroll`, and `batchCalculatePayroll` on `window.api`.
    
    AVOID: Modifying existing `process-payroll` logic, we are just adding new getters and calculators.
    USE: The existing `AuditService.logAction` when updating settings.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    TypeScript compiles cleanly, indicating the IPC channels and preload types are correctly aligned.
  </done>
</task>

<task type="auto">
  <name>DTR Classifier Utility</name>
  <files>
    src/renderer/src/utils/dtr-classifier.ts
  </files>
  <action>
    Create a pure utility module for categorizing raw shift times into DOLE standard categories.
    
    Steps:
    1. Create `src/renderer/src/utils/dtr-classifier.ts`.
    2. Define interfaces for `DailyPunchLog` (Date, Time In, Time Out, Shift Type) and `ConsolidatedTimesheetRow`.
    3. Implement `classifyDailyPunch(punch: DailyPunchLog): { baseHours: number, overtimeHours: OvertimeHours, demerits: AttendanceDemerits }`.
       - Night Differential window spans 22:00 to 06:00.
       - First 8 hours (excluding 1hr break) apply to base shift rates; >8h applies to OT rates.
       - Calculate Late Minutes, Undertime Minutes, and Absences.
    4. Implement `aggregateDtrRecords(records: DailyPunchLog[]): { totalHours: OvertimeHours, totalDemerits: AttendanceDemerits }`.
    
    AVOID: Including any DOM or Electron dependencies in this file. It must be a pure function testable via Jest.
    USE: Simple Date mathematics for minute/hour interval calculations.
  </action>
  <verify>
    npx jest --init || echo "Just verify it compiles if jest not set up" && npx tsc --noEmit src/renderer/src/utils/dtr-classifier.ts
  </verify>
  <done>
    The module compiles without TypeScript errors and provides pure functions for DTR classification.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Configurable DOLE rate multipliers logic is present in backend.
- [ ] DTR classifier utility is implemented.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in build
