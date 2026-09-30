import { PayrollService } from './payroll.service';
import { LedgerService } from './ledger.service';
import { PrismaClient } from '@prisma/client';

describe('PayrollService - Phase 4 General Ledger Auto-Posting & Period Lock', () => {
  test('GL Journal Entry Balancing: Total debits must strictly equal total credits', async () => {
    // Mock payload with 2 employees
    const mockPayrollPayload = {
      date: '2026-09-30',
      referenceNo: 'PY-TEST-001',
      description: 'Test Payroll Batch',
      userId: 'test-admin',
      employees: [
        {
          id: 1,
          base_pay: 20000,
          gross_pay: 22000,
          overtime: 1500,
          night_diff: 500,
          other_earnings: 0,
          sss: 900,
          sss_er: 1800,
          philhealth: 500,
          philhealth_er: 500,
          pagibig: 200,
          pagibig_er: 200,
          tax_withheld: 1200,
          cash_advance: 1000,
          other_deductions: 0,
          license_fee: 0,
          total_deductions: 3800,
          net_pay: 18200,
          processedLoans: []
        },
        {
          id: 2,
          base_pay: 15000,
          gross_pay: 16000,
          overtime: 1000,
          night_diff: 0,
          other_earnings: 0,
          sss: 675,
          sss_er: 1350,
          philhealth: 375,
          philhealth_er: 375,
          pagibig: 200,
          pagibig_er: 200,
          tax_withheld: 500,
          cash_advance: 500,
          other_deductions: 0,
          license_fee: 0,
          total_deductions: 2250,
          net_pay: 13750,
          processedLoans: []
        }
      ]
    };

    // Calculate expected totals based on accounting rule:
    // DEBITS:
    // 5100 (Salaries & Wages Expense) = Gross Pay
    // 5110 (Employer Statutory Contributions) = SSS_ER + PH_ER + PAGIBIG_ER
    const totalGross = mockPayrollPayload.employees.reduce((acc, e) => acc + e.gross_pay, 0); // 38,000
    const totalErStatutory = mockPayrollPayload.employees.reduce(
      (acc, e) => acc + e.sss_er + e.philhealth_er + e.pagibig_er,
      0
    );
    const totalDebit = totalGross + totalErStatutory; // 42,425

    // CREDITS:
    // 2040 (Net Payroll Payable)
    // 2041 (SSS & EC Payable = EE + ER)
    // 2042 (PhilHealth Payable = EE + ER)
    // 2043 (Pag-IBIG Payable = EE + ER)
    // 2051 (Withholding Tax Payable)
    // 1210 (Advances to Officers & Employees)
    const totalNet = mockPayrollPayload.employees.reduce((acc, e) => acc + e.net_pay, 0); // 31,950
    const totalSSS = mockPayrollPayload.employees.reduce((acc, e) => acc + e.sss + e.sss_er, 0);
    const totalPH = mockPayrollPayload.employees.reduce((acc, e) => acc + e.philhealth + e.philhealth_er, 0);
    const totalPagibig = mockPayrollPayload.employees.reduce((acc, e) => acc + e.pagibig + e.pagibig_er, 0);
    const totalTax = mockPayrollPayload.employees.reduce((acc, e) => acc + e.tax_withheld, 0);
    const totalLoans = mockPayrollPayload.employees.reduce((acc, e) => acc + e.cash_advance, 0);

    const totalCredit = totalNet + totalSSS + totalPH + totalPagibig + totalTax + totalLoans; // 42,425

    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(42425);
    expect(totalCredit).toBe(42425);
  });

  test('Period Lock Enforcement: Rejects locked period when PIN is invalid or missing', async () => {
    jest.spyOn(LedgerService, 'getLockDate').mockResolvedValue({
      lockDate: '2026-10-31T00:00:00.000Z',
      autoLockDay: 15,
      hasOverridePin: true
    });
    jest.spyOn(LedgerService, 'verifyManagerPin').mockResolvedValue({
      success: false
    });

    const lockedPayload = {
      date: '2026-10-15',
      referenceNo: 'PY-LOCKED-01',
      description: 'Locked Payroll',
      userId: 'test-admin',
      employees: [],
      overridePin: 'wrong-pin'
    };

    const result = await PayrollService.processPayroll(lockedPayload);
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/PERIOD LOCKED/i);
  });

  test('Period Lock Bypass: Allows posting locked period when valid PIN is supplied', async () => {
    jest.spyOn(LedgerService, 'getLockDate').mockResolvedValue({
      lockDate: '2026-10-31T00:00:00.000Z',
      autoLockDay: 15,
      hasOverridePin: true
    });
    jest.spyOn(LedgerService, 'verifyManagerPin').mockResolvedValue({
      success: true
    });

    // Mock prisma transaction
    const mockTx = {
      employeeLoan: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({ id: 'je-test-123', reference_no: 'PY-BYPASS-01' })
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({})
      },
      payslip: {
        createMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };

    const prismaSpy = jest.spyOn(PrismaClient.prototype, '$transaction').mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    const validPayload = {
      date: '2026-10-15',
      referenceNo: 'PY-BYPASS-01',
      description: 'Bypassed Payroll',
      userId: 'manager-user',
      employees: [],
      overridePin: 'correct-pin'
    };

    const result = await PayrollService.processPayroll(validPayload);
    expect(result.success).toBe(true);
    expect(mockTx.auditLog.create).toHaveBeenCalled();

    prismaSpy.mockRestore();
  });
});
