# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
Comprehensive LAN-Based Accounting and Financial System with Descriptive Analytics for Smartguys Community Healthcare Inc. Milestone v2.0 fulfills all recommendations and compliance directives issued by the academic defense panel on October 5, 2026. This entails implementing Philippine Bureau of Internal Revenue (BIR) CAS compliance across books of accounts (Cash Disbursements with running totals, Check Disbursement report, date-filtered Sales Report), dynamic user-configurable accounting calendar and period-end books closing, global/per-category VAT configurations for medical services & medicines, enhanced user security with auto-generated passwords and role management, detailed void approval audit inspections, and a rigorous 3-dataset unit testing suite.

## Goals (Defense Panel Alignment)
1. **BIR CAS Books of Accounts & Official Reporting (Obj 3.3)**:
   - Cash Disbursements Journal (CDJ) equipped with cumulative running total balances and BIR-standard printable/PDF export.
   - Dedicated Check Disbursement Report itemizing check numbers, bank accounts, payees, gross amounts, EWT withheld, and net check amounts.
   - Sales Journal and Sales Report filterable by custom date range, reporting gross sales, 12% vatable sales, vat-exempt sales, output tax, and total receivables.
   - Standardized taxpayer business headers (Name, TIN, RDO, Address) across all generated reports.
2. **Dynamic Accounting Calendar & Books Closing**:
   - Dynamic user-configurable accounting calendar allowing clients to define fiscal/calendar year and open/locked/closed status per period.
   - Period-End and Year-End book closing engine: automated journal entries transferring net revenue/expense balances to Retained Earnings (Account 3020) and locking transactions in closed periods.
3. **Healthcare VAT & Chart of Accounts Filtering**:
   - Master configuration allowing VAT (12% vs Exempt) to be toggled globally across all medical services and medicines, or customized per category/item.
   - Context-aware filtering of the Chart of Accounts: expense forms strictly filter expense accounts by category; disbursements filter cash/bank and relevant obligation accounts.
4. **Security, User Role Management & Void Approvals**:
   - Automatic generation of secure temporary passwords upon user account creation with one-click copy and audit logging.
   - Robust role-based access control (RBAC) covering Cashier, Accountant, Manager, and IT Personnel.
   - Void Approval workflow presenting complete itemized lines and amounts prior to approval, and requiring mandatory rejection explanations upon denial.
   - Visible Accounts Receivable & Accounts Payable aging schedules with 0-30, 31-60, 61-90, 90+ day aging buckets.
5. **Flow Verification & 3-Dataset Unit Testing**:
   - End-to-end accounting flow double-check.
   - Automated unit testing suite validating journal entries, ledger postings, book computations, running totals, and trial balances across 3 distinct realistic clinic operational datasets.

## Users
- **Cashier**: Processes patient billing, medicine sales, cash receipts, and petty cash expenses.
- **Accountant**: Reviews Books of Accounts, check disbursements, EWT, aging reports, and executes period-end closing.
- **Clinic Manager / Approver**: Approves void requests, reviews financial statements, and configures accounting calendars.
- **IT Personnel**: Manages user accounts, roles, backups, and security settings.

## Constraints
- BIR Revenue Regulations (RR 09-2009, RMC 10-2020, RR 7-2024 Ease of Paying Taxes Act).
- NIRC Section 109 & CREATE Act (RA 11534) for medical service exemptions and pharmaceutical VAT treatments.
- Philippine Financial Reporting Standards (PFRS for SMEs) for period-end closing.
- Tech Stack: Electron 39 desktop app + React 19 + TypeScript + Prisma ORM + MySQL.

## Success Criteria
- [ ] Cash Disbursements Journal calculates running total per row and prints with BIR header.
- [ ] Check Disbursement Report and Date-Filterable Sales Report generated and printable.
- [ ] Dynamic accounting calendar configurable with active closing entry engine to Retained Earnings.
- [ ] VAT configuration for services and medicines toggleable globally or per item.
- [ ] Auto-generated passwords upon account creation and itemized void inspection with mandatory rejection reason.
- [ ] All unit tests pass across 3 distinct datasets without debit/credit imbalance.
