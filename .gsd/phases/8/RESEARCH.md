# Phase 8 Research: User Security, Role Management & Void Approvals Audit

## Executive Summary
This research specifies solutions for panel items:
1. "Once acct is created password is auto generated"
2. "Role management must exist for user and role"
3. "Show the details when approving void acct and when reject show the reason"
4. "Show me aging data"
5. "S.O.P 3.3"

---

## 1. Auto-Generated Passwords & User Security
- In standard medical and enterprise software SOPs (ISO 27001 / HIPAA / Philippine Data Privacy Act RA 10173):
  - Passwords generated on account creation should not be predictable.
  - Generate a secure 12-character high-entropy temporary password (`crypto.getRandomValues` or crypto string containing upper, lower, numbers, and special symbols).
  - Present the generated password in a secure modal with a 1-click "Copy to Clipboard" button and instructions for the user to change upon first login.
  - Log user creation event in `AuditLog`.

---

## 2. Role-Based Access Control (RBAC)
- Support system roles: `CASHIER`, `ACCOUNTANT`, `MANAGER`, `IT_PERSONNEL`.
- Each role has default module access permissions.
- In `UserManagementView.tsx`:
  - Provide a "Role Permissions Matrix" view where administrators can view and customize permissions assigned to each role.
  - Allow assigning/updating user roles and granular permission overrides per user.

---

## 3. Detailed Void Approvals & Rejection Reasons (SOP 3.3)
- Under Internal Accounting Control SOP 3.3 (Dual Authorization for Voids):
  - An approver MUST be presented with the complete transaction context before signing off:
    - Original Transaction Reference, Date, Payee, Creator, Total Amount.
    - Full itemized Journal Lines table: Account Code, Account Title, Debit, Credit.
    - Reason requested for void.
  - If rejecting:
    - The approver MUST provide an explicit rejection reason.
    - Void rejection is logged in `AuditLog` and attached to the transaction record, notifying the submitter.

---

## 4. Aging Data Presentation
- AR Aging (Aged Receivables) and AP Aging (Aged Payables):
  - Standard aging buckets: `Current (0-30 days)`, `31-60 days`, `61-90 days`, `90+ days`.
  - Accessible directly in the UI, filterable by entity (Patient / HMO / Supplier), and printable in 1 click.

