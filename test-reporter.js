/**
 * SmartGuys Accounting System - Custom Jest Terminal Reporter
 * Outputs for every test:
 *  1. WHAT is it testing
 *  2. WHY is it testing it
 *  3. RESULTS (PASS/FAIL, duration, error details)
 */

const SUITE_METADATA = {
  'accounting-flow-datasets.test.ts': {
    name: 'End-to-End Accounting Flow Datasets',
    what: 'Complete multi-module transaction cycles (sales, expenses, payroll)',
    why: 'Verify all journal entries remain strictly balanced across end-to-end accounting flows'
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
    what: 'BIR Form 2550M/Q (VAT), 1601-C (Withholding), and 2307 certificate calculations',
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
    what: 'Currency (₱ PHP), percentage, date, and invoice number string formatters',
    why: 'Ensure consistent and unambiguous display of financial figures across all screens'
  },
  'payroll-periods.test.ts': {
    name: 'Payroll Cutoff & Calendar Utilities',
    what: 'Semi-monthly cutoff boundaries (1-15, 16-EOM) and business day calculations',
    why: 'Prevent payroll period overlap and align wage calculations with calendar cutoffs'
  },
  'statutory-rates.test.ts': {
    name: 'Statutory Contribution Rate Tables',
    what: 'SSS monthly salary credit tiers, PhilHealth 5% table, and Pag-IBIG ₱200 cap',
    why: 'Ensure deductions mirror official government agency contribution schedules'
  },
  'App.test.tsx': {
    name: 'Application Shell & Navigation Guard',
    what: 'Root routing, authentication session persistence, role navigation, and live clock bar',
    why: 'Verify core UI shell mounts properly and gates views according to user authorization'
  },
  'BooksOfAccountsView.test.tsx': {
    name: 'Books of Accounts UI View',
    what: 'General Ledger, Cash Receipts Journal, Cash Disbursements Journal, and General Journal tabs',
    why: 'Allow accountants and BIR auditors to inspect statutory books of accounts'
  },
  'CashDisbursementForm.test.tsx': {
    name: 'Cash Disbursement Voucher Form',
    what: 'Voucher input validation, debit/credit matching, and liquid account restriction',
    why: 'Prevent unbalanced vouchers and restrict disbursements to Cash in Hand, Bank, and Petty Cash'
  },
  'CashierDisbursementView.test.tsx': {
    name: 'Cashier Petty Cash Disbursement View',
    what: 'Cashier voucher submission and petty cash limit validation',
    why: 'Enforce segregation of duties between cashier petty cash expenses and accounting disbursements'
  },
  'ChartOfAccountsView.test.tsx': {
    name: 'Chart of Accounts Management View',
    what: 'Account hierarchy tree, category dropdowns, account locking toggle, and balance display',
    why: 'Maintain standardized account structure and protect locked control accounts from unauthorized edits'
  },
  'FinancialStatementsView.test.tsx': {
    name: 'Financial Statements UI View',
    what: 'Statement of Financial Position and Income Statement date filtering, rendering, and export',
    why: 'Ensure financial reports present reliable figures and allow exporting for business analysis'
  },
  'LoginScreen.test.tsx': {
    name: 'User Authentication Login Screen',
    what: 'Credentials entry, form validation, error banners, and authentication dispatch',
    why: 'Prevent unauthorized access and provide clear feedback on authentication failures'
  },
  'POSBillingView.test.tsx': {
    name: 'Point of Sale (POS) Billing View',
    what: 'Checkout item selection, automatic VAT checkbox for taxable services, and total calculation',
    why: 'Ensure customer invoices reflect accurate 12% VAT and item pricing during POS transactions'
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

function deriveTestPurpose(title, suiteMeta) {
  const cleanTitle = title.replace(/^[✅❌✔✖√\s]+/, '').trim()
  const lower = cleanTitle.toLowerCase()

  let what = cleanTitle
  let why = suiteMeta ? suiteMeta.why : 'Verify system correctness and prevent functional regressions'

  if (lower.includes('sss')) {
    what = 'SSS contribution and WISP fund tier calculation'
    why = 'Deduct exact employee and employer shares matching official Social Security System contribution brackets'
  } else if (lower.includes('philhealth')) {
    what = 'PhilHealth premium contribution (5% rate, 50/50 split)'
    why = 'Calculate statutory health insurance contributions clamped to current statutory floor and ceiling'
  } else if (lower.includes('pag-ibig') || lower.includes('pagibig')) {
    what = 'Pag-IBIG (HDMF) contribution with statutory ₱200 cap'
    why = 'Enforce mandatory Home Development Mutual Fund contributions capped at ₱200 maximum per employee'
  } else if (lower.includes('withholding') || (lower.includes('tax') && !lower.includes('vat'))) {
    what = 'TRAIN Law withholding tax calculation on compensation'
    why = 'Accurately withhold income tax per Bureau of Internal Revenue (BIR) graduated tax tables'
  } else if (lower.includes('hourly rate') || lower.includes('divisor')) {
    what = 'Hourly wage rate computation (261 days divisor / 8 hours)'
    why = 'Comply with DOLE standards for converting monthly salary into standard hourly base pay'
  } else if (lower.includes('overtime') || lower.includes('night') || lower.includes('holiday') || lower.includes('premium')) {
    what = 'Premium pay rates calculation (overtime, night differential, holiday)'
    why = 'Ensure employee compensation adheres to Philippine Labor Code premium pay multipliers'
  } else if (/\blate\b/.test(lower) || lower.includes('tardy') || lower.includes('undertime') || lower.includes('absence') || lower.includes('demerit')) {
    what = 'Attendance demerit & salary deduction computation'
    why = 'Apply exact wage deductions for tardiness, undertime, and unexcused absences without rounding discrepancies'
  } else if (lower.includes('negative')) {
    what = 'Negative amount & input boundary validation'
    why = 'Prevent negative values from corrupting financial balances or causing mathematical anomalies'
  } else if (lower.includes('balanced') || lower.includes('balance')) {
    what = 'Double-entry debit/credit balancing verification'
    why = 'Enforce fundamental accounting rule that total debits must equal total credits (Σ Debit = Σ Credit)'
  } else if (lower.includes('void history') || lower.includes('void')) {
    what = 'Void transaction approval & audit record resolution'
    why = 'Ensure manager authorization is required to reverse transactions and decider audit trails are preserved'
  } else if (lower.includes('lock') || lower.includes('closed period')) {
    what = 'Accounting period locking & restriction verification'
    why = 'Block journal entry posting in closed fiscal periods to maintain financial reporting integrity'
  } else if (lower.includes('vat') || lower.includes('taxable')) {
    what = 'Value-Added Tax (12% VAT) rate application & auto-checkbox'
    why = 'Ensure taxable sales/services charge 12% VAT per BIR compliance guidelines'
  } else if (lower.includes('render') || lower.includes('displays') || lower.includes('shows') || lower.includes('loads')) {
    what = `UI Component rendering: ${cleanTitle}`
    why = 'Ensure required user interface elements and controls render correctly without errors'
  } else if (lower.includes('reject') || lower.includes('fail') || lower.includes('error')) {
    what = `Error handling & validation: ${cleanTitle}`
    why = 'Ensure invalid inputs or unauthorized actions are rejected gracefully with helpful error messages'
  }

  return { what, why }
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
    console.log(`${c.cyan}${c.bold}🧪 SMARTGUYS ACCOUNTING SYSTEM - UNIT TEST SUITE${c.reset}`)
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

    const suiteStatus = testResult.numFailingTests === 0 ? `${c.green}${c.bold}PASS${c.reset}` : `${c.red}${c.bold}FAIL${c.reset}`

    console.log(`\n${c.bold}--------------------------------------------------------------------------------${c.reset}`)
    console.log(`${suiteStatus} ${c.bold}${suiteMeta.name}${c.reset}`)
    console.log(`${c.gray}File: ${relPath}${c.reset}`)
    console.log(`${c.dim}Core Purpose: ${suiteMeta.why}${c.reset}`)
    console.log(`${c.bold}--------------------------------------------------------------------------------${c.reset}`)

    testResult.testResults.forEach((tr) => {
      const isPass = tr.status === 'passed'
      const icon = isPass ? `${c.green}✔ PASS${c.reset}` : `${c.red}✖ FAIL${c.reset}`
      const cleanTitle = tr.title.replace(/^[✅❌✔✖√\s]+/, '').trim()
      const duration = tr.duration !== null && tr.duration !== undefined ? `${tr.duration}ms` : '0ms'

      const { what, why } = deriveTestPurpose(tr.title, suiteMeta)

      console.log(`  ${icon} ${c.bold}${cleanTitle}${c.reset} ${c.dim}(${duration})${c.reset}`)
      console.log(`     ${c.cyan}• WHAT:${c.reset}   ${what}`)
      console.log(`     ${c.yellow}• WHY:${c.reset}    ${why}`)
      console.log(`     ${c.magenta}• RESULT:${c.reset} ${isPass ? c.green + 'PASSED' : c.red + 'FAILED'} ${c.reset}`)

      if (!isPass && tr.failureMessages && tr.failureMessages.length > 0) {
        console.log(`     ${c.red}• ERROR:${c.reset}`)
        tr.failureMessages.forEach((msg) => {
          const indented = msg.split('\n').map((l) => '       ' + l).join('\n')
          console.log(`${c.red}${indented}${c.reset}`)
        })
      }
    })
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
    console.log(`${summaryColor}${c.bold}📊 TEST EXECUTION SUMMARY${c.reset}`)
    console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`)
    console.log(`  Test Suites: ${passedSuites === totalSuites ? c.green : c.red}${passedSuites} passed${c.reset}, ${totalSuites} total`)
    console.log(`  Tests:       ${passedTests === totalTests ? c.green : c.red}${passedTests} passed${c.reset}, ${totalTests} total`)
    console.log(`  Time:        ${totalTime}s`)
    console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`)
  }
}

module.exports = TestReporter
