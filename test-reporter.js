/**
 * SmartGuys Accounting System - Custom Jest Terminal Reporter
 * Outputs for every test:
 *  1. WHAT is it testing
 *  2. WHY is it testing it
 *  3. RESULTS (PASS/FAIL, duration, error details)
 */

const fs = require('fs')

const SUITE_METADATA = {
  'accounting-flow-datasets.test.ts': {
    name: 'End-to-End Accounting Flow Datasets Across 3 Datasets',
    what: 'Complete multi-module transaction cycles (sales, expenses, payroll, books, and financial statements)',
    why: 'Verify all journal entries remain strictly balanced across end-to-end accounting flows'
  },
  'corrections-and-entries.test.ts': {
    name: 'Data-Driven Entry Validation & Corrections Across 3 Datasets',
    what: 'CSV-driven transaction entry, adjusting entries, void approvals, and period cutoff locks',
    why: 'Verify data integrity, validation rules, void safeguards, and period lock protections'
  },
  'accounting-period.service.test.ts': {
    name: 'Accounting Period & Fiscal Locking Service',
    what: 'Fiscal period status, cutoff enforcement, and period locking',
    why: 'Prevent retrospective entries in closed periods and preserve financial audit trail'
  },
  'analytics.service.test.ts': {
    name: 'Executive Dashboard & Financial Analytics',
    what: 'Daily revenue, expenses, transaction count, and profit margins',
    why: 'Provide reliable executive metrics with fault-tolerant fallback on DB error'
  },
  'audit.service.test.ts': {
    name: 'Immutable Audit Trail Service',
    what: 'Append-only activity logging, user action tracking, and entity history',
    why: 'Maintain non-repudiation and forensic accountability for financial record alterations'
  },
  'auth.service.test.ts': {
    name: 'Authentication & Access Control Engine',
    what: 'Password hashing, credential verification, and permission validation',
    why: 'Enforce role-based access control (RBAC) to protect sensitive accounting functions'
  },
  'backup.service.test.ts': {
    name: 'Database Backup & Recovery Service',
    what: 'mysqldump process invocation, backup archive integrity, and path verification',
    why: 'Ensure disaster recovery readiness and prevent financial data loss'
  },
  'export.service.test.ts': {
    name: 'Financial Data Export Service',
    what: 'CSV and Excel workbook generation for general ledger, cash books, and statements',
    why: 'Enable external auditor inspection and compliance reporting in standard spreadsheet formats'
  },
  'inventory.service.test.ts': {
    name: 'Inventory & Stock Management Service',
    what: 'Stock decrements, reorder alert limits, and negative-stock prevention',
    why: 'Maintain accurate Cost of Goods Sold (COGS) and prevent overselling out-of-stock items'
  },
  'ledger.service.test.ts': {
    name: 'Double-Entry General Ledger Engine',
    what: 'Journal entry commit, debit/credit equality, void approvals, and reversal tracking',
    why: 'Enforce fundamental accounting equation (Assets = Liabilities + Equity) and track reversal deciders'
  },
  'payroll-calculator.test.ts': {
    name: 'DOLE & Statutory Payroll Calculation Engine',
    what: 'Hourly rates, overtime multipliers, night diff, SSS, PhilHealth, Pag-IBIG, and tax',
    why: 'Mandatory compliance with Philippine DOLE Labor Code and statutory contribution tables'
  },
  'payroll.service.test.ts': {
    name: 'Payroll Processing & Disbursement Service',
    what: 'Cutoff period aggregation, employee payslip generation, and payroll journal posting',
    why: 'Ensure accurate wage computation and automated payroll expense ledger posting'
  },
  'reports.service.test.ts': {
    name: 'Financial Reporting Engine',
    what: 'Balance Sheet, Income Statement, Trial Balance, and Cash Flow calculations',
    why: 'Generate accurate GAAP/PFRS-compliant financial reports for stakeholders and regulatory filings'
  },
  'tax.service.test.ts': {
    name: 'BIR Tax Compliance & Withholding Engine',
    what: 'BIR Form 2550M/Q (VAT), 1601-C (Withholding), 0619-E (EWT), and 2307 certificate calculations',
    why: 'Comply with Bureau of Internal Revenue (BIR) statutory tax reporting standards and deadlines'
  },
  'user.service.test.ts': {
    name: 'User Management & Role Permissions Service',
    what: 'User CRUD, custom permissions, role inheritance, and forced permission propagation',
    why: 'Ensure account security and sync role changes across active user accounts'
  },
  'relief-engine.test.ts': {
    name: 'BIR RELIEF Data Preparation Engine',
    what: 'Pipe-delimited data formatting, TIN sanitization, and taxable amount splits',
    why: 'Comply with BIR RELIEF electronic submission guidelines for VAT cross-referencing'
  },
  'dole-rates.test.ts': {
    name: 'DOLE Premium & Overtime Multipliers',
    what: 'Overtime (1.25x), rest day (1.30x), and holiday rate multipliers (1.3x - 2.0x)',
    why: 'Strict adherence to DOLE Labor Code wage multiplier mandates'
  },
  'dtr-classifier.test.ts': {
    name: 'Biometric DTR Timecard Classifier',
    what: 'Grace period evaluation, tardiness minutes, undertime hours, and absence detection',
    why: 'Calculate payroll deductions from raw attendance punches without rounding discrepancies'
  },
  'formatters.test.ts': {
    name: 'Financial & Number Formatting Utilities',
    what: 'Currency (PHP), percentage, date, and invoice number string formatters',
    why: 'Ensure consistent and unambiguous display of financial figures across all screens'
  },
  'payroll-periods.test.ts': {
    name: 'Semi-Monthly Payroll Period Calculator',
    what: 'First half (1-15) and second half (16-EOM) date boundary resolution',
    why: 'Accurately align compensation cutoffs with standard Philippine semi-monthly pay periods'
  },
  'App.test.tsx': {
    name: 'Main Application Shell & Navigation',
    what: 'Top-level view routing, tab switching, and authentication guard integration',
    why: 'Ensure seamless view switching between modules without losing UI state'
  },
  'BIRReportsView.test.tsx': {
    name: 'BIR Tax Reports & Annexes View',
    what: 'Form 2550Q, 1601-C, 0619-E tables, and RELIEF DAT file export UI',
    why: 'Provide tax compliance officers with an intuitive interface for BIR filings'
  },
  'CashDisbursementForm.test.tsx': {
    name: 'Cash Disbursement Voucher Entry Form',
    what: 'Expense category selection, 2% EWT auto-deduction, and payee assignment',
    why: 'Enforce withholding tax compliance at the point of voucher creation'
  },
  'CashDisbursementReceipt.test.tsx': {
    name: 'Cash Disbursement Printable Receipt Component',
    what: 'Print layout, payee details, check number, and breakdown of accounts',
    why: 'Generate audit-compliant physical voucher documentation for payee signatures'
  },
  'ChartOfAccountsView.test.tsx': {
    name: 'Chart of Accounts Management View',
    what: 'Standardized account structure, account code grouping, and locked control accounts',
    why: 'Maintain standardized account structure and protect locked control accounts from unauthorized edits'
  },
  'EWTPayoutView.test.tsx': {
    name: 'Expanded Withholding Tax (EWT) Remittance View',
    what: 'Pending EWT liabilities, payment voucher generation, and remittance status tracking',
    why: 'Prevent penalties by tracking and timely settling accrued withholding tax liabilities'
  },
  'FinancialStatementsView.test.tsx': {
    name: 'Financial Statements Presentation View',
    what: 'Income Statement, Balance Sheet, and Trial Balance tab rendering and date filters',
    why: 'Provide stakeholders with accurate, real-time financial reporting views'
  },
  'GeneralLedgerView.test.tsx': {
    name: 'General Ledger Inspection View',
    what: 'Account filter dropdown, date range picker, and chronological journal line grid',
    why: 'Allow bookkeepers to trace transaction history account-by-account'
  },
  'JournalEntryForm.test.tsx': {
    name: 'Manual Journal Voucher Entry Form',
    what: 'Multi-line debit/credit entry, running balance difference indicator, and VAT split helper',
    why: 'Prevent unbalanced manual journal vouchers from being submitted to the database'
  },
  'JournalEntryModal.test.tsx': {
    name: 'Journal Entry Details Modal View',
    what: 'Modal display of entry reference, date, lines, and creator audit history',
    why: 'Provide detailed drill-down into specific journal entries from any view'
  },
  'POSBillingView.test.tsx': {
    name: 'Point of Sale (POS) Billing View',
    what: 'Customer invoicing, line item addition, 12% VAT calculation, and receipt generation',
    why: 'Ensure customer invoices reflect accurate 12% VAT and item pricing during POS transactions'
  },
  'PayrollProcessingView.test.tsx': {
    name: 'Payroll Processing & Payslip Management View',
    what: 'Employee list, salary calculation preview, payslip modal, and GL posting trigger',
    why: 'Provide HR with transparent payroll review before committing wage expenses to the ledger'
  },
  'SystemSettingsView.test.tsx': {
    name: 'System Settings & Organization Profile View',
    what: 'Company profile fields, tax configuration, and manual DB backup trigger',
    why: 'Allow administrators to configure business parameters and initiate on-demand system backups'
  },
  'UserManagementView.test.tsx': {
    name: 'User & Role Permission Management View',
    what: 'User listing, role matrix checkboxes, account lock toggle, and force-role-change button',
    why: 'Provide granular access control management and immediately propagate permission adjustments'
  },
  'VoidApprovalsView.test.tsx': {
    name: 'Void & Reversal Approvals View',
    what: 'Pending void queue, manager approve/reject actions, and void history audit trail',
    why: 'Enforce manager dual-control approval for transaction cancellations and preserve audit history'
  }
}

function parseTestJSDocs(filePath) {
  const map = {}
  try {
    if (!fs.existsSync(filePath)) return map
    const code = fs.readFileSync(filePath, 'utf8')
    const regex = /\/\*\*([\s\S]*?)\*\/\s*(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g
    let match
    while ((match = regex.exec(code)) !== null) {
      const doc = match[1]
      const title = match[2].trim()
      const featureMatch = doc.match(/FEATURE:\s*([^\r\n*]+)/i)
      const whatMatch = doc.match(/WHAT:\s*([^\r\n*]+)/i)
      const whyMatch = doc.match(/WHY:\s*([^\r\n*]+)/i)
      const typeMatch = doc.match(/TYPE:\s*([^\r\n*]+)/i)

      map[title] = {
        feature: featureMatch ? featureMatch[1].trim() : null,
        what: whatMatch ? whatMatch[1].trim() : null,
        why: whyMatch ? whyMatch[1].trim() : null,
        type: typeMatch ? typeMatch[1].trim() : null
      }
    }
  } catch (e) {
    // Ignore read errors
  }
  return map
}

function deriveTestPurpose(title, suiteMeta, jsDocMap) {
  const cleanTitle = title.replace(/^[✅❌✔✖√\s]+/, '').trim()
  const lower = cleanTitle.toLowerCase()

  if (jsDocMap && jsDocMap[cleanTitle]) {
    const doc = jsDocMap[cleanTitle]
    return {
      feature: doc.feature || (suiteMeta ? suiteMeta.name : null),
      what: doc.what || cleanTitle,
      why: doc.why || (suiteMeta ? suiteMeta.why : 'Verify system business logic and integrity'),
      type: doc.type || (lower.includes('negative') || lower.includes('reject') ? 'NON-HAPPY PATH (Negative / Edge Case)' : 'HAPPY PATH (Positive)')
    }
  }

  let feature = suiteMeta ? suiteMeta.name : null
  let what = cleanTitle
  let why = suiteMeta ? suiteMeta.why : 'Verify system correctness and prevent functional regressions'
  let type = (lower.includes('negative') || lower.includes('reject') || lower.includes('block') || lower.includes('invalid') || lower.includes('error'))
    ? 'NON-HAPPY PATH (Negative / Edge Case)'
    : 'HAPPY PATH (Positive)'

  // Form 0619-E (EWT)
  if (lower.includes('0619-e') || lower.includes('0619e') || lower.includes('ewt')) {
    feature = 'BIR Form 0619-E (Monthly EWT Remittance)'
    what = 'BIR Form 0619-E monthly Expanded Withholding Tax (EWT) remittance extraction'
    why = 'Comply with BIR monthly withholding remittance requirements on supplier payments'
  }
  // BIR RELIEF & DAT file
  else if (lower.includes('relief') || lower.includes('dat file') || lower.includes('slsp')) {
    feature = 'BIR RELIEF Data Preparation Engine'
    what = 'BIR RELIEF electronic submission DAT file generation for monthly purchases and sales'
    why = 'Comply with BIR RELIEF magnetic data requirements for automated tax cross-referencing'
  }
  // Form 1601-C (Compensation Withholding)
  else if (lower.includes('1601-c') || lower.includes('1601c') || lower.includes('compensation withholding')) {
    feature = 'BIR Form 1601-C (Compensation Withholding)'
    what = 'BIR Form 1601-C compensation withholding tax calculation'
    why = 'Accurately withhold and remit payroll taxes under the TRAIN Law graduated tax tables'
  }
  // Form 2550Q (VAT)
  else if (lower.includes('2550q') || lower.includes('2550m') || (lower.includes('vat') && !lower.includes('train'))) {
    feature = 'BIR Form 2550Q (Value-Added Tax)'
    what = 'Value-Added Tax (12% VAT) rate application, Output vs Input VAT, and tax segregation'
    why = 'Ensure taxable sales/services charge 12% VAT per BIR compliance guidelines'
  }
  // Scenario 1B / Unbalanced
  else if (lower.includes('scenario 1b') || lower.includes('unbalanced')) {
    feature = 'Double-Entry Ledger Balancing'
    what = 'Double-entry balance validation: Rejection of unbalanced journal entries'
    why = 'Enforce fundamental accounting rule that total debits must equal total credits'
  }
  // Scenario 1A / Balanced
  else if (lower.includes('scenario 1a') || (lower.includes('balanced') && !lower.includes('unbalanced'))) {
    feature = 'Double-Entry Ledger Balancing'
    what = 'Double-entry transaction acceptance: Balanced debits and credits'
    why = 'Ensure valid balanced accounting entries post successfully to general ledger'
  }
  // Scenario 2B / Negative value
  else if (lower.includes('scenario 2b') || lower.includes('negative values') || lower.includes('negative adjustment') || lower.includes('negative depreciation')) {
    feature = 'Adjusting Journal Entries'
    what = 'Input validation: Rejection of negative debit/credit values'
    why = 'Ensure accounting entries use positive magnitudes with appropriate debit/credit columns'
  }
  // Scenario 2A / Adjusting entry
  else if (lower.includes('scenario 2a') || lower.includes('adjusting entry')) {
    feature = 'Adjusting Journal Entries'
    what = 'Adjusting entry acceptance for accruals, prepayments, and reclassifications'
    why = 'Enable legitimate period-end adjusting entries to reflect accurate financial positions'
  }
  // Scenario 3B / Reconciled void lock
  else if (lower.includes('scenario 3b') || lower.includes('bank-reconciled') || lower.includes('reconciliation lock')) {
    feature = 'Void Approvals & Reconciliation Safeguard'
    what = 'Bank reconciliation lock: Prevention of voiding cleared/reconciled entries'
    why = 'Protect reconciled bank statements from post-reconciliation alteration'
  }
  // Scenario 3A / Valid void
  else if (lower.includes('scenario 3a') || lower.includes('valid void') || lower.includes('authorized void')) {
    feature = 'Void Approvals & Reversal Generation'
    what = 'Authorized void execution and automatic reversal journal entry generation'
    why = 'Allow manager-approved voiding of erroneous transactions while preserving audit trail'
  }
  // Scenario 4A / Closed period without PIN
  else if (lower.includes('scenario 4a') || (lower.includes('closed period') && lower.includes('without'))) {
    feature = 'Accounting Period Cutoff'
    what = 'Period cutoff enforcement: Rejects transaction posting in closed fiscal periods'
    why = 'Enforce financial closing finality and prevent unauthorized retrospective changes'
  }
  // Scenario 4B / Closed period with PIN
  else if (lower.includes('scenario 4b') || (lower.includes('closed period') && (lower.includes('pin') || lower.includes('override')))) {
    feature = 'Accounting Period Cutoff'
    what = 'Manager override: Permits authorized posting to locked period with valid PIN'
    why = 'Provide dual-control emergency entry capability for legitimate audit adjustments'
  }
  // General Journal
  else if (lower.includes('general journal') || lower.includes(' gj ')) {
    feature = 'General Journal (GJ)'
    what = 'General Journal: Chronological recording of non-cash and adjusting transactions'
    why = 'Verify non-cash transactions and journal vouchers are accurately recorded in the General Journal'
  }
  // General Ledger
  else if (lower.includes('general ledger') || lower.includes(' gl ')) {
    feature = 'General Ledger (GL)'
    what = 'General Ledger: Chronological journal lines with valid account details and running balances'
    why = 'Retrieve chronological journal lines with account IDs, debits, credits, and running totals'
  }
  // Trial Balance
  else if (lower.includes('trial balance')) {
    feature = 'Trial Balance'
    what = 'Trial Balance: Cumulative debits precisely equal cumulative credits'
    why = 'Fundamental double-entry bookkeeping invariant: cumulative debit balances must equal credit balances'
  }
  // Income Statement
  else if (lower.includes('income statement')) {
    feature = 'Income Statement'
    what = 'Income Statement: Net Income strictly equals Revenues minus Expenses'
    why = 'Financial accounting principle: Net Income = Total Revenues - Total Expenses'
  }
  // Balance Sheet
  else if (lower.includes('balance sheet')) {
    feature = 'Balance Sheet'
    what = 'Balance Sheet: Fundamental Equation (Assets = Liabilities + Equity + Net Income)'
    why = 'Fundamental accounting equation: Assets = Liabilities + Equity (including unclosed Net Income)'
  }
  // SSS / PhilHealth / Pag-IBIG
  else if (lower.includes('sss')) {
    feature = 'Statutory Benefits'
    what = 'SSS contribution and WISP fund tier calculation'
    why = 'Deduct exact employee and employer shares matching official Social Security System contribution brackets'
  } else if (lower.includes('philhealth')) {
    feature = 'Statutory Benefits'
    what = 'PhilHealth premium contribution (5% rate, 50/50 split)'
    why = 'Calculate statutory health insurance contributions clamped to current statutory floor and ceiling'
  } else if (lower.includes('pag-ibig') || lower.includes('pagibig')) {
    feature = 'Statutory Benefits'
    what = 'Pag-IBIG (HDMF) contribution with statutory 200 PHP cap'
    why = 'Enforce mandatory Home Development Mutual Fund contributions capped at 200 PHP maximum per employee'
  } else if (lower.includes('hourly rate') || lower.includes('divisor')) {
    feature = 'Payroll Computation'
    what = 'Hourly wage rate computation (261 days divisor / 8 hours)'
    why = 'Comply with DOLE standards for converting monthly salary into standard hourly base pay'
  } else if (lower.includes('overtime') || lower.includes('night') || lower.includes('holiday') || lower.includes('premium')) {
    feature = 'Payroll Computation'
    what = 'Premium pay rates calculation (overtime, night differential, holiday)'
    why = 'Ensure employee compensation adheres to Philippine Labor Code premium pay multipliers'
  } else if (/\blate\b/.test(lower) || lower.includes('tardy') || lower.includes('undertime') || lower.includes('absence') || lower.includes('demerit')) {
    feature = 'Attendance & Demerits'
    what = 'Attendance demerit & salary deduction computation'
    why = 'Apply exact wage deductions for tardiness, undertime, and unexcused absences without rounding discrepancies'
  } else if (lower.includes('render') || lower.includes('displays') || lower.includes('shows') || lower.includes('loads')) {
    what = `UI Component rendering: ${cleanTitle}`
    why = 'Ensure required user interface elements and controls render correctly without errors'
  } else if (lower.includes('reject') || lower.includes('fail') || lower.includes('error')) {
    what = `Error handling & validation: ${cleanTitle}`
    why = 'Ensure invalid inputs or unauthorized actions are rejected gracefully with helpful error messages'
  }

  return { feature, what, why, type }
}

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
}

class TestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig
    this._options = options
  }

  onRunStart() {
    console.log(`\n${c.cyan}${c.bold}================================================================================${c.reset}`)
    console.log(`${c.cyan}${c.bold}SMARTGUYS ACCOUNTING SYSTEM - UNIT TEST SUITE${c.reset}`)
    console.log(`${c.dim}State: WHAT is tested, WHY it is tested, and RESULTS on the terminal${c.reset}`)
    console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`)
  }

  onTestResult(test, testResult) {
    const rawPath = testResult.testFilePath.replace(/\\/g, '/')
    const fileName = rawPath.split('/').pop()
    const relPath = rawPath.split('smartguys-accounting-system/')[1] || rawPath

    const suiteMeta = SUITE_METADATA[fileName] || {
      name: fileName,
      what: 'Unit test suite verification',
      why: 'Ensure module stability and business rule compliance'
    }

    const jsDocMap = parseTestJSDocs(testResult.testFilePath)
    const suiteStatus = testResult.numFailingTests === 0 ? `${c.green}${c.bold}PASS${c.reset}` : `${c.red}${c.bold}FAIL${c.reset}`

    console.log(`\n${c.bold}--------------------------------------------------------------------------------${c.reset}`)
    console.log(`${suiteStatus} ${c.bold}${suiteMeta.name}${c.reset}`)
    console.log(`${c.gray}File: ${relPath}${c.reset}`)
    console.log(`${c.dim}Core Purpose: ${suiteMeta.why}${c.reset}`)
    console.log(`${c.bold}--------------------------------------------------------------------------------${c.reset}`)

    testResult.testResults.forEach((tr) => {
      const isPass = tr.status === 'passed'
      const icon = isPass ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`
      const cleanTitle = tr.title.replace(/^[✅❌✔✖√\s]+/, '').trim()
      const duration = tr.duration !== null && tr.duration !== undefined ? `${tr.duration}ms` : '0ms'

      const purpose = deriveTestPurpose(tr.title, suiteMeta, jsDocMap)

      console.log(`  [${icon}] ${c.bold}${cleanTitle}${c.reset} ${c.dim}(${duration})${c.reset}`)
      if (purpose.feature) {
        console.log(`     ${c.magenta}${c.bold}* FEATURE:${c.reset} ${purpose.feature}`)
      }
      console.log(`     ${c.cyan}* WHAT:${c.reset}    ${purpose.what}`)
      console.log(`     ${c.yellow}* WHY:${c.reset}     ${purpose.why}`)
      console.log(`     ${c.blue}* RESULT:${c.reset}  ${isPass ? c.green + 'PASSED' : c.red + 'FAILED'} ${c.reset}`)

      if (!isPass && tr.failureMessages && tr.failureMessages.length > 0) {
        console.log(`     ${c.red}* ERROR:${c.reset}`)
        tr.failureMessages.forEach((msg) => {
          const indented = msg.split('\n').map((l) => '       ' + l).join('\n')
          console.log(`${c.red}${indented}${c.reset}`)
        })
      }
    })

    if (testResult.console && testResult.console.length > 0) {
      console.log(`\n  ${c.cyan}${c.bold}--- DATASET RECONCILIATION & SYSTEM OUTPUT PROOF ---${c.reset}`)
      testResult.console.forEach((item) => {
        console.log(item.message)
      })
    }
  }

  onRunComplete(testContexts, aggregatedResults) {
    const passedSuites = aggregatedResults.numPassedTestSuites
    const totalSuites = aggregatedResults.numTotalTestSuites
    const passedTests = aggregatedResults.numPassedTests
    const totalTests = aggregatedResults.numTotalTests
    const totalTime = ((Date.now() - aggregatedResults.startTime) / 1000).toFixed(2)

    const allPassed = aggregatedResults.numFailedTests === 0 && aggregatedResults.numFailedTestSuites === 0
    const summaryColor = allPassed ? c.green : c.red

    console.log(`\n${c.cyan}${c.bold}================================================================================${c.reset}`)
    console.log(`${summaryColor}${c.bold}TEST EXECUTION SUMMARY${c.reset}`)
    console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`)
    console.log(`  Test Suites: ${passedSuites === totalSuites ? c.green : c.red}${passedSuites} passed${c.reset}, ${totalSuites} total`)
    console.log(`  Tests:       ${passedTests === totalTests ? c.green : c.red}${passedTests} passed${c.reset}, ${totalTests} total`)
    console.log(`  Time:        ${totalTime}s`)
    console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`)
  }
}

module.exports = TestReporter
