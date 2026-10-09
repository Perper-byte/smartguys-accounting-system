# Phase 5 Research: Philippine Accounting Software Architecture & BIR Compliance

## Executive Summary
This research synthesizes the architectural patterns of Philippine-based accounting platforms (JuanTax, Oojeema, Taxumo, SAP Business One / QuickBooks Philippine Localizations) and official Bureau of Internal Revenue (BIR) regulations (RR 09-2009, RMC 10-2020, RR 7-2024 Ease of Paying Taxes Act, NIRC Section 109 & CREATE Act RA 11534). It establishes the technical blueprint for addressing the October 5, 2026 defense panel requirements: BIR-compliant books of accounts with running totals, date-filtered sales and check disbursement reports, and official printable document formatting.

---

## 1. BIR Regulatory Requirements for Books of Accounts (CAS Compliance)

Under BIR Revenue Regulations (RR 09-2009, RMC 29-2019, RMC 10-2020, and RR 7-2024 implementing the Ease of Paying Taxes Act):

### 1.1 Mandatory Official Header
All Computerized Accounting System (CAS) books of accounts and exported/printed schedules must include an official taxpayer header on every page:
- **Taxpayer Name**: SMARTGUYS COMMUNITY HEALTHCARE INC.
- **Registered Address**: Katapatan Mutual Homes, Brgy. Banay-banay, City of Cabuyao, Laguna 4025
- **TIN & Branch Code**: e.g., `000-000-000-000` (configurable in system settings)
- **RDO**: RDO 057 - San Pedro / Biñan / Cabuyao
- **Book Title**: Cash Disbursements Journal / Sales Journal / Cash Receipts Journal / General Journal
- **Period Covered**: `From: YYYY-MM-DD  To: YYYY-MM-DD`
- **Audit Stamp**: Generated on `YYYY-MM-DD HH:MM:SS` by `[Username / Role]`

### 1.2 Running Totals Requirement (Panel Suggestion: "CD should printable and have running total")
In standard Philippine accounting software (Oojeema, SAP B1 PH, JuanTax):
- **Cash Disbursements Journal (CDJ)**: Each chronological transaction row must present:
  1. Transaction Date
  2. Voucher Reference No. (`CV-XXXX` or `DV-XXXX`)
  3. Check No. / Bank Reference
  4. Payee / Supplier Name
  5. Particulars / Description
  6. Account Code & Account Title
  7. Debit (Expense, Asset, Liability)
  8. Credit (Cash in Bank / Cash on Hand, Withholding Tax Payable)
  9. **Running Total / Cumulative Balance**: Continuous cumulative disbursement total that rolls from row to row and page to page (`₱ Running Sum`).
- **Running Total Calculation**:
  $$\text{RunningTotal}_i = \sum_{k=1}^i \text{DisbursementAmount}_k$$
- Printable format must support both a clean multi-line journal ledger and a summarized voucher register with double-underline grand totals (`₱ TOTAL DEBITS = ₱ TOTAL CREDITS`).

### 1.3 Check Disbursement Report (Panel Suggestion: "Check disbursement report")
A specialized sub-register of the Cash Disbursements Book focusing strictly on check payments:
- Columns: Check Date, Check No., Bank Account / Bank Name, Payee Name & TIN, Voucher No. (`CV-XXXX`), Gross Amount, EWT Withheld (Account 2050), Net Check Amount, Status (Active, Cleared, Voided).
- Filterable by date range and bank account.
- Auto-generated and printable in 1 click.

### 1.4 Sales Journal & Sales Report (Panel Suggestion: "Sales Report (filterable by date)")
Under the Ease of Paying Taxes (EOPT) Act (RR 7-2024):
- The **Sales Invoice (SI)** is the primary proof of sale for both goods and services.
- The Sales Report must be filterable by arbitrary date ranges (`From` and `To`).
- Columns required:
  1. Date
  2. Invoice No. (`INV-XXXX`)
  3. Patient / Client Name & TIN
  4. Gross Amount
  5. VATable Sales (12%)
  6. VAT-Exempt Sales (Medical consultations / exempt items)
  7. Zero-Rated Sales
  8. Output VAT (12%)
  9. Discounts (Senior Citizen / PWD 20%)
  10. Net Accounts Receivable / Cash Collected
- Printable in landscape table format with running totals and summary reconciliation box.

---

## 2. Philippine Accounting Software Comparison

| Feature | Oojeema (PH) | JuanTax (PH) | QuickBooks (PH config) | Smartguys Target Architecture |
|---|---|---|---|---|
| **Books of Accounts** | 4 standard journals (SJ, CRJ, CDJ, GJ) with running totals | Tax-first GL with BIR electronic export | Standard journals (requires manual custom report) | Built-in SJ, CRJ, CDJ, PJ, GJ + General Ledger with real-time running total calculations |
| **Print / PDF Layout** | Dedicated printable voucher & columnar ledger with BIR header | Direct BIR form overlay (PDF / e-submission) | Standard report template | Dedicated high-res printable HTML/CSS engine (via Electron `print` / preview) with official BIR header |
| **Check Register** | Integrated check voucher to check printing report | Integrated in disbursement module | Banking module check register | Dedicated Check Disbursement Report tab with Bank, Check No., Payee, Gross, EWT, Net Check |
| **Date Filtering** | Quick presets (Today, MTD, QTD, YTD) + Custom Range | Monthly & Quarterly tax periods | Custom date picker | Flexible date picker (`From` / `To`) with instant live recalculation & persistence |
| **EOPT / VAT Rules** | Sales Invoice for services & goods, VAT breakdowns | 2550Q / SLSP / 2307 auto-population | Manual tax codes | Full EOPT invoice support + automated 2550Q & SLSP generation |

---

## 3. Implementation Blueprint for Phase 5

### Task 1: Cash Disbursements Journal (CDJ) Enhancement & Check Disbursement Report
- Add running balance computation to `ReportsService.getBooksOfAccounts` when `bookType === 'CDJ'` or across all books.
- Add dedicated `CheckDisbursementReport` query returning all check-based disbursements (`payment_method === 'check'` or `reference_no` with `CV-` / check number).
- Implement official BIR printable format with business header, taxpayer details, and running totals in `BooksOfAccountsView.tsx`.

### Task 2: Date-Filterable Sales Report & BIR Books Printable Formats
- Implement dedicated `getSalesReport(startDate, endDate)` in `ReportsService` with full VAT breakdown (Vatable Sales, VAT-Exempt Sales, Output Tax, Senior/PWD Discounts, Net Total).
- Add printable view modal / print stylesheet for Sales Report and Books of Accounts matching BIR layout standards.
- Add UI controls in `BooksOfAccountsView.tsx` and a dedicated Sales Report tab/view for date filtering and 1-click printing.

### Task 3: Unit Testing & Verification
- Unit test running total math across multiple transactions.
- Unit test Check Disbursement report data integrity and EWT withholding deductions.
- Unit test Sales Report date range boundary conditions and VAT segregation.

