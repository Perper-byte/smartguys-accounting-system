---
phase: 4
plan: 2
wave: 2
gap_closure: false
depends_on: [1]
---

# Plan 4.2: Headless Payslip PDF Export Service

## Objective
Implement off-screen, headless PDF generation for individual and batch payslips using Electron's `printToPDF` and `BrowserWindow` without disrupting the active renderer view. Expose the functionality via IPC to the frontend.

## Context
Load these files for context:
- .gsd/phases/4/RESEARCH.md
- src/main/services/export.service.ts
- src/main/index.ts
- src/preload/index.ts

## Tasks

<task type="auto">
  <name>Implement PDF Generation Engine</name>
  <files>
    src/main/services/export.service.ts
  </files>
  <action>
    Create a headless PDF export mechanism for payslips.
    
    Steps:
    1. In `ExportService`, implement `generatePayslipPDF(payslipId)` and `generateBatchPayslipsPDF(journalEntryId)`.
    2. Inside these methods, query the database for the required payslip/payroll data.
    3. Construct an HTML string (using a simple template literal with inline CSS) representing the itemized payslip. For batches, combine payslips separated by `<div style="page-break-after: always;"></div>`.
    4. Instantiate an off-screen `BrowserWindow` (`{ show: false, webPreferences: { offscreen: true } }`), load the HTML string using `loadURL` with a data URI.
    5. On `did-finish-load`, call `webContents.printToPDF` to generate the PDF buffer.
    6. Use `dialog.showSaveDialog` to prompt the user for the save path, and `fs.writeFileSync` to save it. Clean up the headless window.
    
    AVOID: Relying on the currently focused renderer window for printing.
  </action>
  <verify>
    npm run test -- --testPathPattern="export.service.spec.ts" (or manually invoke the export service logic in a scratch script)
  </verify>
  <done>
    `ExportService` successfully creates and writes a PDF file to disk with the correct formatting and page breaks (for batches).
  </done>
</task>

<task type="auto">
  <name>Register IPC Interfaces for Export</name>
  <files>
    src/main/index.ts
    src/preload/index.ts
    src/preload/index.d.ts
  </files>
  <action>
    Wire the backend export service to the frontend.
    
    Steps:
    1. In `src/main/index.ts`, register IPC handlers for `export:payslipPDF` and `export:batchPayslipsPDF` that route to the new `ExportService` methods.
    2. In `src/preload/index.ts`, expose these methods to the renderer via `contextBridge.exposeInMainWorld('api', { ... })`.
    3. Ensure `src/preload/index.d.ts` is updated with strict types for the new API methods.
  </action>
  <verify>
    npm run typecheck
  </verify>
  <done>
    IPC channels are successfully bridged, and TypeScript compilation passes with the new API methods.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Payslips are generated as PDF files.
- [ ] Batch generation produces a single PDF with multiple pages.
- [ ] No visual disruption occurs on the UI during generation.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
