# ROADMAP.md — HR & Payroll Overhaul

> **Current Phase**: Not started
> **Milestone**: v1.0 — DOLE-Compliant HR & Payroll System

## Must-Haves (from SPEC)
- [x] Configurable DOLE rate multipliers in database settings
- [ ] Gross-to-Net payroll service with statutory contributions & tax computation
- [ ] Interactive multi-tab Payroll Overhaul UI grid matching clinic sheets
- [ ] PDF payslip generator & auto-posted GL journal entries

## Phases

### Phase 1: Database Schema & Dynamic Rate Multiplier Engine
**Status**: ✅ Complete
**Objective**: Update Prisma schema to store payroll rate settings, allowances, loans, and statutory contribution parameters. Implement rate calculation service.
**Requirements**: REQ-01, REQ-03

### Phase 2: Gross-to-Net Payroll Computation Service
**Status**: ⬜ Not Started
**Objective**: Build main process service for calculating attendance demerits, premium rate breakdowns, SSS, PhilHealth, Pag-IBIG, BIR tax, loans, and net pay.
**Requirements**: REQ-02, REQ-04, REQ-05

### Phase 3: Interactive Payroll Overhaul UI & DTR Import
**Status**: ⬜ Not Started
**Objective**: Develop React UI components for the expanded payroll sheet grid, rate settings editor, and DTR CSV log import modal.
**Requirements**: REQ-06

### Phase 4: Payslip PDF Generator & General Ledger Integration
**Status**: ⬜ Not Started
**Objective**: Implement PDF payslip export for employees and automated GL journal entry posting upon payroll run approval.
**Requirements**: REQ-07, REQ-08

