import { PrismaClient } from '@prisma/client'
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
    
    const sss = calculateSSSContribution(monthlySalary).total_ee / 2;
    const philhealth = calculatePhilHealthContribution(monthlySalary).eeShare / 2;
    const pagibig = calculatePagIbigContribution(monthlySalary).eeShare / 2;
    
    const grossIncomeForTax = basePay - totalDemerits + overtimeAndDiff + taxableAllowances;
    const taxableBase = grossIncomeForTax - sss - philhealth - pagibig;
    const tax_withheld = calculateWithholdingTax(taxableBase > 0 ? taxableBase : 0, 'SEMI_MONTHLY');
    
    let cash_advance = 0;
    let other_deductions = 0;
    const processedLoans = [];
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
      philhealth,
      pagibig,
      cash_advance,
      license_fee: 0,
      other_deductions,
      total_deductions,
      tax_withheld,
      net_pay,
      processedLoans
    };
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

  async processPayroll(data: any) {
    try {
      return await prisma.$transaction(async (tx) => {
        let totalGross = 0
        let totalSSS = 0
        let totalPhilhealth = 0
        let totalPagibig = 0
        let totalTax = 0
        let totalOtherDeductions = 0
        let totalNet = 0

        for (const emp of data.employees) {
          totalGross += Number(emp.gross_pay || 0)
          totalSSS += Number(emp.sss || 0)
          totalPhilhealth += Number(emp.philhealth || 0)
          totalPagibig += Number(emp.pagibig || 0)
          totalTax += Number(emp.tax_withheld || 0)
          totalOtherDeductions += Number(emp.cash_advance || 0) + Number(emp.other_deductions || 0) + Number(emp.license_fee || 0)
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

        // 1. DEBIT: Total Salaries and Wages Expense (5100)
        lines.push({ account_id: '5100', debit: totalGross, credit: 0 })

        // 2. CREDIT: Statutory Payables and other deductions (2040)
        const totalStatutoryAndOther = totalSSS + totalPhilhealth + totalPagibig + totalOtherDeductions
        if (totalStatutoryAndOther > 0) {
          lines.push({ account_id: '2040', debit: 0, credit: totalStatutoryAndOther })
        }

        // CREDIT: Withholding Tax Payable (2050)
        if (totalTax > 0) {
          lines.push({ account_id: '2050', debit: 0, credit: totalTax })
        }

        // 3. CREDIT: Cash in Bank (1010)
        lines.push({ account_id: '1010', debit: 0, credit: totalNet })

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
