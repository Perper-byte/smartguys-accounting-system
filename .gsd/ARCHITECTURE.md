# Application Architecture

## High-Level Architecture Overview
SmartGuys Accounting is a desktop accounting and clinic operations platform built using Electron, React, TypeScript, and Prisma ORM backed by a MySQL database.

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│    React 19 + Lucide Icons + ECharts + Tailwind CSS     │
│   (App.tsx, Navigation Tabs, Financial/POS Views)       │
└────────────────────────────┬────────────────────────────┘
                             │ window.electronAPI / window.api
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     Preload Layer                       │
│    (src/preload/index.ts - ContextBridge Expositions)   │
└────────────────────────────┬────────────────────────────┘
                             │ ipcRenderer.invoke / ipcMain.handle
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│       (src/main/index.ts - Window & IPC Control)        │
├─────────────────────────────────────────────────────────┤
│                     Service Layer                       │
│  Ledger, Auth, Reports, Tax, Payroll, Analytics, etc.   │
├────────────────────────────┬────────────────────────────┤
│   Offline-First Sync Engine│   Prisma ORM (MySQL DB)    │
│  (JSON Caches & Queue)     │   (schema.prisma)          │
└────────────────────────────┴────────────────────────────┘
```

## Architectural Components

### 1. Process Separation & Security Layer
- **Main Process** ([src/main/index.ts:1-1097](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L1-L1097)): Manages application lifecycle, window instantiation, cron scheduling, and IPC signal registration. Window options configure `contextIsolation: true` and `nodeIntegration: false` ([src/main/index.ts:35-37](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L35-L37)).
- **Preload Bridge** ([src/preload/index.ts:1-147](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/preload/index.ts#L1-L147)): Safely exposes `electronAPI` and `api` interfaces to the Renderer window using Electron's `contextBridge`.
- **Renderer Process** ([src/renderer/src/App.tsx:1-318](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/renderer/src/App.tsx#L1-L318)): Single-page application rendering navigation groups ('Home', 'Clinic Operations', 'Accounting', 'Reports & Taxes', 'System Admin') and role-based access enforcement (`CASHIER`, `ACCOUNTANT`, `MANAGER`, `IT_PERSONNEL`).

### 2. Service Layer Architecture
Business logic is organized into modular services under `src/main/services/`:
- **AuthService** (`auth.service.ts`): Handles credential validation and DB ping check ([src/main/index.ts:57](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L57)).
- **UserService** (`user.service.ts`): User creation, role/permission updates, password resets, and petty cash management ([src/main/index.ts:91-163](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L91-L163)).
- **LedgerService** (`ledger.service.ts`): Core double-entry bookkeeping engine, COA, payee contacts, journal entries, reference sequencing, and void approvals ([src/main/index.ts:171-455](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L171-L455)).
- **ReportsService** (`reports.service.ts`): Financial statement generation (Trial Balance, Income Statement, Balance Sheet, Cash Flow), Books of Accounts, and Aged Receivables ([src/main/index.ts:656-717](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L656-L717)).
- **TaxService** (`tax.service.ts`): Philippine BIR tax compliance forms (BIR 2550Q, 0619-E, 1601-EQ, and RELIEF annexes) ([src/main/index.ts:840-884](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L840-L884)).
- **PayrollService** (`payroll.service.ts`): HR employee records, compensation, government contributions (SSS, PhilHealth, Pag-IBIG), and payslip generation ([src/main/index.ts:720-799](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L720-L799)).
- **InventoryService** (`inventory.service.ts`): Stock quantities, location tracking, movement logs, and expiry date management ([src/main/index.ts:560-617](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L560-L617)).
- **AnalyticsService** (`analytics.service.ts`): Aggregates daily sales stats, dashboard metrics, and recent transaction feeds ([src/main/index.ts:887-939](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L887-L939)).
- **BackupService** (`backup.service.ts`): Manual and automated database dumps/restores ([src/main/index.ts:894-915](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L894-L915)).
- **AuditService** (`audit.service.ts`): Immutable logging of user activities and system actions ([src/main/index.ts:916-925](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L916-L925)).
- **ExportService** (`export.service.ts`): Formats financial reports into downloadable Excel spreadsheets ([src/main/index.ts:802-810](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L802-L810)).

### 3. Data Model & Database Design
Managed via Prisma ORM schema (`prisma/schema.prisma`):
- **Core Entities**: `User` ([prisma/schema.prisma:14](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L14)), `Account` & `AccountType` ([prisma/schema.prisma:105-126](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L105-L126)), `JournalEntry` & `JournalLine` ([prisma/schema.prisma:152-193](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L152-L193)), `Payee` ([prisma/schema.prisma:131](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L131)).
- **Operations & Management**: `InventoryItem` & `InventoryLog` ([prisma/schema.prisma:53-87](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L53-L87)), `ServiceItem` ([prisma/schema.prisma:253](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L253)), `BankAccount`, `BankTransaction`, and `Reconciliation` ([prisma/schema.prisma:216-276](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L216-L276)).
- **HR & Security**: `Employee` & `Payslip` ([prisma/schema.prisma:198-214, 289-319](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L198-L214,L289-L319)), `AuditLog` ([prisma/schema.prisma:89](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L89)), `Attachment` ([prisma/schema.prisma:38](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L38)), `SystemSetting` ([prisma/schema.prisma:281](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/prisma/schema.prisma#L281)).

### 4. Offline-First Resilience & Sync Engine
- Local JSON cache files created in `app.getPath('userData')` for accounts, payees, and user logins ([src/main/index.ts:10-13, 62-67, 175, 212](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L10-L13,L62-L67,L175,L212)).
- When network disconnects occur, journal transactions are appended to `offline-transactions.json` ([src/main/index.ts:385-402](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L385-L402)).
- Fast 1-second TCP socket ping (`system:ping`) checks MySQL port 3306 directly without waiting for standard Prisma timeout ([src/main/index.ts:983-1016](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L983-L1016)).
- Background sync worker polls every 5 seconds; once DB connectivity returns, it flushes queued transactions to MySQL and clears local file storage ([src/main/index.ts:1043-1089](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L1043-L1089)).

## What Could Not Be Determined
- External remote server IP configuration defaults to `127.0.0.1` unless specified in `server-config.json` ([src/main/index.ts:944-950](file:///C:/Users/MY%20PC/.gemini/antigravity/worktrees/7ecb2df6-06d6-441a-b3b9-513b2e039ea5/subagent-Codebase-Mapper-gsd-researcher-519e6723/src/main/index.ts#L944-L950)). Real production deployment database topology (host IP addresses) is configured dynamically at runtime.
