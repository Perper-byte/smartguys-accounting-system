import { PrismaClient } from '@prisma/client'
import { LedgerService } from './ledger.service'
import { 
  calculateHourlyRate, 
  calculateOvertimeAndDiff, 
  calculateStatutoryDeductions, 
  OvertimeHours,
  calculateAttendanceDemerits,
  AttendanceDemerits,
  calculateSSSContribution,
  calculatePhilHealthContribution,
  calculatePagIbigContribution,
  calculateWithholdingTax
} from './payroll-calculator'

const prisma = new PrismaClient()

export const PayrollService = {
  async getPayrollSettings() {
    const settings = await prisma.systemSetting.findFirst()
    const fallback = {
      regular_ot_rate: 1.25,
      regular_night_rate: 1.10,
      regular_night_ot_rate: 1.375,
      rest_day_rate: 1.30,
      rest_day_ot_rate: 1.69,
      rest_day_night_rate: 1.43,
      rest_day_night_ot_rate: 1.859,
      special_holiday_rate: 1.30,
      special_holiday_ot_rate: 1.69,
      special_holiday_night_rate: 1.43,
      special_holiday_night_ot_rate: 1.859,
      special_holiday_rest_day_rate: 1.50,
      special_holiday_rest_day_ot_rate: 1.95,
      special_holiday_rest_day_night_rate: 1.65,
      special_holiday_rest_day_night_ot_rate: 2.145,
      legal_holiday_rate: 2.00
    };

    if (!settings) {
      return fallback;
    }

    return {
      regular_ot_rate: Number(settings.regular_ot_rate) || fallback.regular_ot_rate,
      regular_night_rate: Number(settings.regular_night_rate) || fallback.regular_night_rate,
      regular_night_ot_rate: Number(settings.regular_night_ot_rate) || fallback.regular_night_ot_rate,
      rest_day_rate: Number(settings.rest_day_rate) || fallback.rest_day_rate,
      rest_day_ot_rate: Number(settings.rest_day_ot_rate) || fallback.rest_day_ot_rate,
      rest_day_night_rate: Number(settings.rest_day_night_rate) || fallback.rest_day_night_rate,
      rest_day_night_ot_rate: Number(settings.rest_day_night_ot_rate) || fallback.rest_day_night_ot_rate,
      special_holiday_rate: Number(settings.special_holiday_rate) || fallback.special_holiday_rate,
      special_holiday_ot_rate: Number(settings.special_holiday_ot_rate) || fallback.special_holiday_ot_rate,
      special_holiday_night_rate: Number(settings.special_holiday_night_rate) || fallback.special_holiday_night_rate,
      special_holiday_night_ot_rate: Number(settings.special_holiday_night_ot_rate) || fallback.special_holiday_night_ot_rate,
      special_holiday_rest_day_rate: Number(settings.special_holiday_rest_day_rate) || fallback.special_holiday_rest_day_rate,
      special_holiday_rest_day_ot_rate: Number(settings.special_holiday_rest_day_ot_rate) || fallback.special_holiday_rest_day_ot_rate,
      special_holiday_rest_day_night_rate: Number(settings.special_holiday_rest_day_night_rate) || fallback.special_holiday_rest_day_night_rate,
      special_holiday_rest_day_night_ot_rate: Number(settings.special_holiday_rest_day_night_ot_rate) || fallback.special_holiday_rest_day_night_ot_rate,
      legal_holiday_rate: Number(settings.legal_holiday_rate) || fallback.legal_holiday_rate
    };
  },

  async calculateEmployeePayroll(
    monthlySalary: number, 
    hours: OvertimeHours,
    demerits: AttendanceDemerits,
    allowances: any[] = [],
    loans: any[] = []
  ) {
    const settings = await this.getPayrollSettings();
    const hourlyRate = calculateHourlyRate(monthlySalary);
    
    const basePay = monthlySalary / 2;
    const demeritResult = calculateAttendanceDemerits(hourlyRate, demerits);
    const totalDemerits = demeritResult.total_demerits;
    
    const overtimeAndDiff = calculateOvertimeAndDiff(hourlyRate, hours, settings);
    
    let taxableAllowances = 0;
    let nonTaxableAllowances = 0;
    for (const al of allowances) {
      const amount = Number(al.amount) / 2;
      if (al.is_taxable) {
        taxableAllowances += amount;
      } else {
        nonTaxableAllowances += amount;
      }
    }
    const other_earnings = taxableAllowances + nonTaxableAllowances;
    
    const sssCalc = calculateSSSContribution(monthlySalary);
    const sss = sssCalc.total_ee / 2;
    const sss_er = sssCalc.total_er / 2;

    const phCalc = calculatePhilHealthContribution(monthlySalary);
    const philhealth = phCalc.eeShare / 2;
    const philhealth_er = phCalc.erShare / 2;

    const piCalc = calculatePagIbigContribution(monthlySalary);
    const pagibig = piCalc.eeShare / 2;
    const pagibig_er = piCalc.erShare / 2;
    
    const grossIncomeForTax = basePay - totalDemerits + overtimeAndDiff + taxableAllowances;
    const taxableBase = grossIncomeForTax - sss - philhealth - pagibig;
    const tax_withheld = calculateWithholdingTax(taxableBase > 0 ? taxableBase : 0, 'SEMI_MONTHLY');
    
    let cash_advance = 0;
    let other_deductions = 0;
    const processedLoans: any[] = [];
    for (const loan of loans) {
      if (loan.is_active && Number(loan.balance) > 0) {
        let deduction = Number(loan.monthly_amort) / 2;
        if (deduction > Number(loan.balance)) {
          deduction = Number(loan.balance);
        }
        if (loan.type === 'CASH_ADVANCE') {
          cash_advance += deduction;
        } else {
          other_deductions += deduction;
        }
        processedLoans.push({
          id: loan.id,
          deduction: deduction
        });
      }
    }
    
    const gross_pay = basePay + overtimeAndDiff + other_earnings;
    const total_deductions = totalDemerits + sss + philhealth + pagibig + cash_advance + other_deductions;
    const net_pay = gross_pay - total_deductions - tax_withheld;

    return {
      base_pay: basePay,
      overtime: overtimeAndDiff,
      night_diff: 0,
      other_earnings,
      gross_pay,
      sss,
      sss_er,
      philhealth,
      philhealth_er,
      pagibig,
      pagibig_er,
      cash_advance,
      license_fee: 0,
      other_deductions,
      total_deductions,
      tax_withheld,
      net_pay,
      processedLoans
    };
  },

  async updatePayrollSettings(multipliers: Partial<Record<string, number>>) {
    try {
      const settings = await prisma.systemSetting.findFirst();
      if (!settings) {
        await prisma.systemSetting.create({
          data: multipliers as any
        });
      } else {
        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: multipliers as any
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: error.message };
    }
  },

  async batchCalculatePayroll(employeeInputs: any[]) {
    try {
      const results: any[] = [];
      for (const input of employeeInputs) {
        const allowances = await prisma.employeeAllowance.findMany({
          where: { employee_id: Number(input.employeeId) }
        });
        const loans = await prisma.employeeLoan.findMany({
          where: { employee_id: Number(input.employeeId), is_active: true }
        });
        
        const payrollResult = await this.calculateEmployeePayroll(
          Number(input.monthlySalary),
          input.hours,
          input.demerits,
          allowances,
          loans
        );
        
        results.push({
          employeeId: input.employeeId,
          ...payrollResult
        });
      }
      return { success: true, data: results };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: error.message };
    }
  },

  async getEmployees() {
    const employees = await prisma.employee.findMany({
      orderBy: { first_name: 'asc' }
    })
    return employees.map((emp) => ({
      ...emp,
      monthly_salary: Number(emp.monthly_salary)
    }))
  },

  async createEmployee(data: any) {
    try {
      await prisma.employee.create({
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          position: data.position,
          monthly_salary: data.monthlySalary,
          tin: data.tin || null,
          sss_no: data.sss || null,
          philhealth_no: data.philhealth || null,
          pagibig_no: data.pagibig || null,
          is_active: true
        }
      })
      return { success: true }
    } catch (error: any) {
      console.error(error)
      return { success: false, error: error.message }
    }
  },

  async toggleEmployeeStatus(id: string | number, isActive: boolean) {
    try {
      await prisma.employee.update({
        where: { id: Number(id) },
        data: { is_active: isActive }
      })
      return { success: true }
    } catch (error: any) {
      console.error('Failed to toggle status:', error)
      return { success: false, error: error.message }
    }
  },

  async bulkImportEmployees(records: any[], updateExisting: boolean = true) {
    try {
      let createdCount = 0
      let updatedCount = 0

      for (const item of records) {
        if (!item.first_name || !item.last_name) continue

        const searchConditions: any[] = [
          {
            AND: [
              { first_name: { equals: item.first_name } },
              { last_name: { equals: item.last_name } }
            ]
          }
        ]
        if (item.tin && String(item.tin).trim().length > 3) {
          searchConditions.push({ tin: String(item.tin).trim() })
        }
        if (item.sss_no && String(item.sss_no).trim().length > 3) {
          searchConditions.push({ sss_no: String(item.sss_no).trim() })
        }

        const existing = await prisma.employee.findFirst({
          where: { OR: searchConditions }
        })

        if (existing) {
          if (updateExisting) {
            await prisma.employee.update({
              where: { id: existing.id },
              data: {
                position: item.position || existing.position,
                monthly_salary: item.monthly_salary !== undefined ? Number(item.monthly_salary) : existing.monthly_salary,
                tin: item.tin !== undefined ? (item.tin || null) : existing.tin,
                sss_no: item.sss_no !== undefined ? (item.sss_no || null) : existing.sss_no,
                philhealth_no: item.philhealth_no !== undefined ? (item.philhealth_no || null) : existing.philhealth_no,
                pagibig_no: item.pagibig_no !== undefined ? (item.pagibig_no || null) : existing.pagibig_no,
                is_active: item.is_active !== undefined ? Boolean(item.is_active) : existing.is_active
              }
            })
            updatedCount++
          }
        } else {
          await prisma.employee.create({
            data: {
              first_name: String(item.first_name).trim(),
              last_name: String(item.last_name).trim(),
              position: item.position ? String(item.position).trim() : 'Staff',
              monthly_salary: Number(item.monthly_salary || 0),
              tin: item.tin ? String(item.tin).trim() : null,
              sss_no: item.sss_no ? String(item.sss_no).trim() : null,
              philhealth_no: item.philhealth_no ? String(item.philhealth_no).trim() : null,
              pagibig_no: item.pagibig_no ? String(item.pagibig_no).trim() : null,
              is_active: item.is_active !== undefined ? Boolean(item.is_active) : true
            }
          })
          createdCount++
        }
      }

      return { success: true, createdCount, updatedCount }
    } catch (error: any) {
      console.error('Failed to bulk import employees:', error)
      return { success: false, error: error.message }
    }
  },

  async ensurePayrollAccounts(tx: any) {
    const requiredAccounts = [
      { code: '5100', name: 'Salaries and Wages Expense', type_id: 'type-expense' },
      { code: '5110', name: 'Employer Statutory Contributions Expense', type_id: 'type-expense' },
      { code: '2040', name: 'Salaries / Net Payroll Payable', type_id: 'type-liability' },
      { code: '2041', name: 'SSS & EC Premium Payable', type_id: 'type-liability' },
      { code: '2042', name: 'PhilHealth Premium Payable', type_id: 'type-liability' },
      { code: '2043', name: 'Pag-IBIG Premium Payable', type_id: 'type-liability' },
      { code: '2051', name: 'Withholding Tax Payable - Compensation', type_id: 'type-liability' },
      { code: '1210', name: 'Advances to Officers & Employees', type_id: 'type-asset' }
    ]

    for (const acc of requiredAccounts) {
      await tx.account.upsert({
        where: { code: acc.code },
        update: {},
        create: acc
      })
    }
  },

  async processPayroll(data: any) {
    try {
      const entryDate = new Date(data.date)
      const lockCheck = await LedgerService.getLockDate()
      if (lockCheck.lockDate && entryDate <= new Date(lockCheck.lockDate)) {
        const verify = await LedgerService.verifyManagerPin(data.overridePin || '')
        if (!verify.success) {
          throw new Error(`PERIOD LOCKED: You cannot post payroll on or before ${lockCheck.lockDate.split('T')[0]}. Invalid or missing Override PIN.`)
        }
      }

      return await prisma.$transaction(async (tx) => {
        await PayrollService.ensurePayrollAccounts(tx)

        let totalGross = 0
        let totalSSSEe = 0
        let totalPhilhealthEe = 0
        let totalPagibigEe = 0
        let totalSSSEr = 0
        let totalPhilhealthEr = 0
        let totalPagibigEr = 0
        let totalTax = 0
        let totalLoanDeductions = 0
        let totalNet = 0

        for (const emp of data.employees) {
          totalGross += Number(emp.gross_pay || 0)
          totalSSSEe += Number(emp.sss || 0)
          totalPhilhealthEe += Number(emp.philhealth || 0)
          totalPagibigEe += Number(emp.pagibig || 0)
          totalSSSEr += Number(emp.sss_er || 0)
          totalPhilhealthEr += Number(emp.philhealth_er || 0)
          totalPagibigEr += Number(emp.pagibig_er || 0)
          totalTax += Number(emp.tax_withheld || 0)
          totalLoanDeductions += Number(emp.cash_advance || 0) + Number(emp.other_deductions || 0) + Number(emp.license_fee || 0)
          totalNet += Number(emp.net_pay || 0)

          if (emp.processedLoans) {
            for (const pl of emp.processedLoans) {
              const loan = await tx.employeeLoan.findUnique({ where: { id: pl.id } })
              if (loan) {
                const newBalance = Number(loan.balance) - Number(pl.deduction)
                await tx.employeeLoan.update({
                  where: { id: pl.id },
                  data: {
                    balance: newBalance,
                    is_active: newBalance > 0
                  }
                })
              }
            }
          }
        }

        const lines: any[] = []

        // 1. DEBIT: Salaries and Wages Expense (5100)
        lines.push({ account_id: '5100', debit: totalGross, credit: 0 })

        // 2. DEBIT: Employer Statutory Contributions Expense (5110)
        const totalErStatutory = totalSSSEr + totalPhilhealthEr + totalPagibigEr
        if (totalErStatutory > 0) {
          lines.push({ account_id: '5110', debit: totalErStatutory, credit: 0 })
        }

        // 3. CREDIT: Salaries / Net Payroll Payable (2040)
        if (totalNet > 0) {
          lines.push({ account_id: '2040', debit: 0, credit: totalNet })
        }

        // 4. CREDIT: SSS & EC Premium Payable (2041)
        const totalSSS = totalSSSEe + totalSSSEr
        if (totalSSS > 0) {
          lines.push({ account_id: '2041', debit: 0, credit: totalSSS })
        }

        // 5. CREDIT: PhilHealth Premium Payable (2042)
        const totalPhilhealth = totalPhilhealthEe + totalPhilhealthEr
        if (totalPhilhealth > 0) {
          lines.push({ account_id: '2042', debit: 0, credit: totalPhilhealth })
        }

        // 6. CREDIT: Pag-IBIG Premium Payable (2043)
        const totalPagibig = totalPagibigEe + totalPagibigEr
        if (totalPagibig > 0) {
          lines.push({ account_id: '2043', debit: 0, credit: totalPagibig })
        }

        // 7. CREDIT: Withholding Tax Payable - Compensation (2051)
        if (totalTax > 0) {
          lines.push({ account_id: '2051', debit: 0, credit: totalTax })
        }

        // 8. CREDIT: Advances to Officers & Employees (1210)
        if (totalLoanDeductions > 0) {
          lines.push({ account_id: '1210', debit: 0, credit: totalLoanDeductions })
        }

        // Create the Master Journal Entry
        const entry = await tx.journalEntry.create({
          data: {
            date: new Date(data.date),
            reference_no: data.referenceNo,
            description: `Payroll Run: ${data.description} (${data.employees.length} employees)`,
            vat_type: 'EXEMPT',
            user_id: data.userId,
            status: 'ACTIVE',
            lines: { create: lines }
          }
        })

        // Audit Trail for Lock Override
        if (lockCheck.lockDate && entryDate <= new Date(lockCheck.lockDate)) {
          await tx.auditLog.create({
            data: {
              user_id: data.userId,
              action: 'PAYROLL_POSTED_LOCKED_PERIOD',
              details: `Payroll ${data.referenceNo} approved in locked period with Manager Override PIN (Entry ${entry.id})`
            }
          })
        }

        // Create individual database Payslips
        const payslipsData = data.employees.map((emp: any) => ({
          employee_id: Number(emp.id),
          journal_entry_id: entry.id,
          date: new Date(data.date),
          reference_no: `${data.referenceNo}-${emp.id}`,
          base_pay: emp.base_pay || 0,
          overtime: emp.overtime || 0,
          night_diff: emp.night_diff || 0,
          other_earnings: emp.other_earnings || 0,
          gross_pay: emp.gross_pay || 0,
          sss: emp.sss || 0,
          philhealth: emp.philhealth || 0,
          pagibig: emp.pagibig || 0,
          cash_advance: emp.cash_advance || 0,
          license_fee: emp.license_fee || 0,
          other_deductions: emp.other_deductions || 0,
          total_deductions: emp.total_deductions || 0,
          tax_withheld: emp.tax_withheld || 0,
          net_pay: emp.net_pay || 0
        }))

        await tx.payslip.createMany({ data: payslipsData })

        return { success: true, referenceNo: entry.reference_no }
      })
    } catch (error: any) {
      console.error(error)
      return { success: false, error: error.message }
    }
  },

  async getPayrollHistory() {
    try {
      const history = await prisma.journalEntry.findMany({
        where: { reference_no: { startsWith: 'PY-' }, status: 'ACTIVE' },
        include: { payslips: { include: { employee: true } } },
        orderBy: { date: 'desc' }
      })

      // Convert ALL Prisma Decimals to normal Javascript Numbers
      return history.map((h) => ({
        id: h.id,
        date: h.date,
        referenceNo: h.reference_no,
        description: h.description,
        payslips: h.payslips.map((p: any) => ({
          ...p,
          base_pay: Number(p.base_pay),
          overtime: Number(p.overtime),
          night_diff: Number(p.night_diff),
          other_earnings: Number(p.other_earnings),
          gross_pay: Number(p.gross_pay),
          sss: Number(p.sss),
          philhealth: Number(p.philhealth),
          pagibig: Number(p.pagibig),
          cash_advance: Number(p.cash_advance),
          license_fee: Number(p.license_fee),
          other_deductions: Number(p.other_deductions),
          total_deductions: Number(p.total_deductions),
          tax_withheld: Number(p.tax_withheld),
          net_pay: Number(p.net_pay),
          // 🔥 THE FIX: Convert the nested employee's salary decimal too!
          employee: p.employee
            ? {
                ...p.employee,
                monthly_salary: Number(p.employee.monthly_salary)
              }
            : null
        }))
      }))
    } catch (error) {
      console.error('Failed to fetch payroll history', error)
      return []
    }
  }
}
