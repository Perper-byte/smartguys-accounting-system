# Phase 6 Research: Dynamic Accounting Calendar & Period-End Books Closing Engine

## Executive Summary
This research specifies the architecture for a dynamic, user-configurable Accounting Calendar and automated Period-End / Year-End Books Closing mechanism for Smartguys Community Healthcare Inc., addressing the October 5, 2026 defense panel suggestions ("Define acctg calendar", "Determine client's accounting calendar. It must be dynamic that can be set by user", "Closing book of acct.").

---

## 1. Regulatory & Accounting Principles (PFRS for SMEs & BIR RR 09-2009)

### 1.1 The Accounting Cycle & Period Concept
- **Periodicity Assumption**: Economic activities are divided into artificial time periods (Calendar Year: Jan 1 to Dec 31, or approved Fiscal Year).
- **Temporary Accounts vs. Permanent Accounts**:
  - **Temporary Accounts**: Revenues (4000s) and Expenses (5000s). These accumulate figures during the period and must be closed to zero at period-end.
  - **Permanent Accounts**: Assets (1000s), Liabilities (2000s), and Equity (3000s). Their balances carry forward continuously.
- **Closing Journal Entry**:
  1. Debit each Revenue account for its credit balance.
  2. Credit each Expense account for its debit balance.
  3. Transfer the net difference (Net Income or Net Loss) to **Retained Earnings / Equity** (`Account 3020` / `Account 3010`).
  $$\text{Debits (Revenues)} = \text{Credits (Expenses)} + \text{Net Income to Retained Earnings}$$

### 1.2 Period States & Enforcement
| State | Behavior | Requirements to Alter |
|---|---|---|
| `OPEN` | Unrestricted posting, editing, voiding of journal entries within the period. | Default state. |
| `LOCKED` | Soft lock (grace period / month-end cutoff passed). Transactions blocked unless Manager Override PIN is provided. | Manager Override PIN. |
| `CLOSED` | Hard closed. Books are finalized, closing entry posted. **Strictly NO entries or edits permitted**, even with PIN. | Requires formal "Re-open Period" action with Manager PIN and audit logging. |

---

## 2. Dynamic Calendar Architecture

### 2.1 Fiscal Year & Period Generation
Clients may configure:
- **Fiscal Year Start Month**: 1 (January, default Calendar Year), or custom (e.g. 7 for July).
- **Active Fiscal Year**: e.g., 2026.
- Dynamic 12-month period array automatically calculated with accurate first-day (`YYYY-MM-01 00:00:00`) and last-day timestamps (`YYYY-MM-LastDay 23:59:59.999`).

### 2.2 Storage Model
Periods are stored in `SystemSetting.accounting_calendar` JSON or dedicated period records, and tracked with:
- `fiscalYear: number`
- `periodNumber: number` (1 to 12)
- `name: string` (e.g. "January 2026")
- `startDate: string` (ISO date)
- `endDate: string` (ISO date)
- `status: 'OPEN' | 'LOCKED' | 'CLOSED'`
- `closedAt?: string`
- `closedBy?: string`
- `closingEntryId?: string`

---

## 3. Implementation Plan for Phase 6

### Plan 6.1: Accounting Calendar Service & Period Status Enforcement
- Implement `AccountingPeriodService` managing dynamic period generation, status transitions (`OPEN`, `LOCKED`, `CLOSED`), and system setting persistence.
- Integrate validation in `LedgerService.recordEntry` and `updateEntry` blocking transactions on `CLOSED` periods.

### Plan 6.2: Period-End Books Closing Engine & Automated Closing Entries
- Implement `AccountingPeriodService.closePeriod(year, periodNumber, userId)`:
  - Aggregates revenues and expenses in the period.
  - Generates balanced closing journal entry (`CLOSE-YYYY-P{N}`) zeroing temporary accounts to Retained Earnings (`3020`).
  - Sets period status to `CLOSED`.
- Implement `reopenPeriod` with Manager PIN verification and audit trail.
- Unit test closing calculations, journal debit/credit parity, and period lock enforcement.

### Plan 6.3: Accounting Calendar UI & Period Closing Management Interface
- Enhance `SystemSettingsView.tsx` with an interactive "Accounting Calendar & Period Closing" tab.
- Visual grid of the 12 fiscal periods showing date ranges, period status badge (`OPEN`, `LOCKED`, `CLOSED`), net income preview, and "Close Books" / "Reopen" action buttons with confirmation modals.

