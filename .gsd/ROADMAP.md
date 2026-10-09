# ROADMAP.md — Smartguys Accounting & Financial System

> **Current Phase**: Phase 7
> **Milestone**: v2.0 — Defense Panel Compliance & Core Accounting Hardening

## Must-Haves (from October 5, 2026 Defense Panel Comments)
- [x] BIR CAS compliance: Official printable Books of Accounts with running totals (Cash Disbursements Journal)
- [x] Dedicated Check Disbursement Report & Date-Filterable Sales Report with VAT breakdowns
- [x] Dynamic user-configurable Accounting Calendar & Period-End Books Closing mechanism
- [ ] Configurable VAT on all services & medicines and Chart of Accounts category filtering
- [ ] Auto-generated secure passwords on account creation & role management
- [ ] Detailed Void Approval modal with line-item inspection & mandatory rejection reason
- [ ] Comprehensive End-to-End testing across 3 distinct datasets covering all books and entries

## Phases

### Phase 1: Database Schema & Dynamic Rate Multiplier Engine
**Status**: ✅ Complete
**Objective**: Update Prisma schema to store payroll rate settings, allowances, loans, and statutory contribution parameters. Implement rate calculation service.
**Requirements**: REQ-01, REQ-03

### Phase 2: Gross-to-Net Payroll Computation Service
**Status**: ✅ Complete
**Objective**: Build main process service for calculating attendance demerits, premium rate breakdowns, SSS, PhilHealth, Pag-IBIG, BIR tax, loans, and net pay.
**Requirements**: REQ-02, REQ-04, REQ-05

### Phase 3: Interactive Payroll Overhaul UI & DTR Import
**Status**: ✅ Complete
**Objective**: Develop React UI components for the expanded payroll sheet grid, rate settings editor, and DTR CSV log import modal.
**Requirements**: REQ-06

### Phase 4: Payslip PDF Generator & General Ledger Integration
**Status**: ✅ Complete
**Objective**: Implement PDF payslip export for employees and automated GL journal entry posting upon payroll run approval.
**Requirements**: REQ-07, REQ-08

### Phase 5: BIR Compliance & Official Books of Accounts
**Status**: ✅ Complete
**Objective**: Implement running totals for Cash Disbursements Journal (CDJ), dedicated Check Disbursement Report, date-filtered Sales Report with BIR-compliant VAT categorization, and auto-generated printable/PDF formats.
**Requirements**: PANEL-CDJ-RUNNING-TOTAL, PANEL-CHECK-DISB-REPORT, PANEL-SALES-REPORT, PANEL-OBJ-3.3-BIR

### Phase 6: Dynamic Accounting Calendar & Period-End Books Closing Engine
**Status**: ✅ Complete
**Objective**: Develop dynamic user-configurable accounting calendar (fiscal/calendar years, open/lock periods) and automated period-end/year-end closing of temporary revenue/expense accounts to Retained Earnings.
**Requirements**: PANEL-ACCTG-CALENDAR, PANEL-BOOK-CLOSING

### Phase 7: Services & Medicines VAT Configuration & Account Category Filtering
**Status**: ⚪ Pending
**Objective**: Enable global and category-level VAT configuration across services and medicines. Refine Chart of Accounts filtering per transaction use case and expense voucher.
**Requirements**: PANEL-VAT-SERVICES-MEDS, PANEL-FILTER-CATEGORY, PANEL-FILTER-EXPENSE

### Phase 8: User Security, Role Management & Void Approvals Audit
**Status**: ⚪ Pending
**Objective**: Implement auto-generated passwords on user creation, dynamic role/permission management, itemized transaction inspection in void approvals, and mandatory rejection reason capture.
**Requirements**: PANEL-AUTO-PASSWORD, PANEL-ROLE-MGMT, PANEL-VOID-APPROVAL-DETAILS

### Phase 9: End-to-End Flow Verification & 3-Dataset Unit Testing Suite
**Status**: ⚪ Pending
**Objective**: Build comprehensive unit and integration testing suite validating complete accounting flows (Sales, Disbursements, HMO, Adjustments, Closing) across 3 distinct datasets.
**Requirements**: PANEL-3-DATASETS, PANEL-UNIT-TEST-BOOKS, PANEL-DOUBLE-CHECK-FLOWS
