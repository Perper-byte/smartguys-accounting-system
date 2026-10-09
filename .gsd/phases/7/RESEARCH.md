# Phase 7 Research: Services & Medicines VAT Configuration & Account Category Filtering

## Executive Summary
This research addresses the defense panel directives:
1. "Service & medicines vat can be set on all"
2. "Properly filter the category of accounts per use"
3. "Filter expense"

---

## 1. VAT Configuration for Clinic Services & Medicines

### 1.1 Statutory Context (CREATE Act & NIRC Section 109)
In Philippine clinics:
- Medical consultations and professional treatments by physicians are generally VAT-exempt under Section 109(G).
- Pharmacy medicines: Prescription drugs for specific chronic diseases (diabetes, hypertension, cancer, mental health, TB, kidney disorders) are exempt under the CREATE Act (RA 11534), while general medical supplies, OTC pharmaceuticals, and aesthetic procedures are subject to 12% Output VAT.
- Panel Directive: The system must allow administrators to configure VAT status globally across all services and all medicines ("set on all") or customize per procedure/medicine.

### 1.2 Architecture
- **Master Data**:
  - `ServiceItem`: store `is_vatable: boolean` (or derive from item/system configuration).
  - Bulk operations: Provide IPC and UI actions to bulk-set VAT status (`setAllServicesVat(isVatable: boolean)` and `setAllMedicinesVat(isVatable: boolean)`).
- **POS Billing Engine (`POSBillingView.tsx`)**:
  - Dynamically inspect each added line's `isVatable` property rather than hardcoding `isVatable: false`.
  - Calculate 12% Output VAT on vatable lines:
    $$\text{VatableSales} = \sum \frac{\text{GrossLine}}{1.12}, \quad \text{OutputVAT} = \text{VatableSales} \times 0.12$$
    $$\text{VATExemptSales} = \sum \text{ExemptLine}$$

---

## 2. Context-Aware Account Category Filtering

### 2.1 The Issue
Currently in `CashDisbursementForm.tsx`, accounts from Asset, Liability, and Expense are displayed in a single unorganized dropdown. In `CashierDisbursementView.tsx` (Petty Cash/Expenses), all transactions are displayed without expense category filtering.

### 2.2 Solution
- In `CashDisbursementForm.tsx`:
  - Provide Category selector / filter pills: `All Categories`, `Operating Expenses (5xxx)`, `Administrative Expenses`, `Direct Medical Supplies`, `Liabilities (2xxx)`, `Assets (1xxx)`.
  - Selecting a category filters the dropdown to relevant accounts only.
- In `CashierDisbursementView.tsx`:
  - Add expense category filter dropdown: "All Expense Types", "Medical Supplies (5010)", "Utilities (5020)", "Office Supplies (5060)", "Transportation (5080)", "Meals (5070)", "Miscellaneous (5090)".
  - Add search filter allowing instant lookup by payee, voucher, or account category.

