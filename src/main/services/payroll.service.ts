// src/main/services/payroll.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const PayrollService = {
    
    async getEmployees() {
        const employees = await prisma.employee.findMany({
            orderBy: { first_name: 'asc' }
        });
        return employees.map(emp => ({
            ...emp,
            monthly_salary: Number(emp.monthly_salary)
        }));
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
            });
            return { success: true };
        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    },

    async toggleEmployeeStatus(id: string | number, isActive: boolean) {
        try {
            await prisma.employee.update({
                where: { id: Number(id) }, 
                data: { is_active: isActive }
            });
            return { success: true };
        } catch (error: any) {
            console.error("Failed to toggle status:", error);
            return { success: false, error: error.message };
        }
    },

    async processPayroll(data: any) {
        try {
            return await prisma.$transaction(async (tx) => {
                let totalGross = 0;
                let totalDeductionsAndTax = 0;
                let totalNet = 0;

                data.employees.forEach((emp: any) => {
                    totalGross += Number(emp.gross);
                    totalDeductionsAndTax += (Number(emp.deductions) + Number(emp.tax));
                    totalNet += Number(emp.net);
                });

                const lines: any[] = [];

                // 1. DEBIT: Total Salaries and Wages Expense (5100)
                lines.push({ account_id: '5100', debit: totalGross, credit: 0 });

                // 2. CREDIT: Total Deductions & Withholding Taxes 
                if (totalDeductionsAndTax > 0) {
                    lines.push({ account_id: '2040', debit: 0, credit: totalDeductionsAndTax });
                }

                // 3. CREDIT: Cash in Bank (1010)
                lines.push({ account_id: '1010', debit: 0, credit: totalNet });

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
                });

                // Create individual database Payslips
                const payslipsData = data.employees.map((emp: any) => ({
                    employee_id: Number(emp.id),
                    journal_entry_id: entry.id,
                    date: new Date(data.date),
                    reference_no: `${data.referenceNo}-${emp.id}`, 
                    base_pay: emp.basePay || 0,
                    overtime: emp.overtime || 0,
                    night_diff: emp.nightDiff || 0,
                    other_earnings: emp.otherEarnings || 0,
                    gross_pay: emp.gross || 0,
                    sss: emp.sss || 0,
                    philhealth: emp.philhealth || 0,
                    pagibig: emp.pagibig || 0,
                    cash_advance: emp.cashAdvance || 0,
                    license_fee: emp.licenseFee || 0,
                    other_deductions: emp.otherDeductions || 0,
                    total_deductions: emp.deductions || 0,
                    tax_withheld: emp.tax || 0,
                    net_pay: emp.net || 0
                }));

                await tx.payslip.createMany({ data: payslipsData });

                return { success: true, referenceNo: entry.reference_no };
            });
        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    },

    async getPayrollHistory() {
        try {
            const history = await prisma.journalEntry.findMany({
                where: { reference_no: { startsWith: 'PY-' }, status: 'ACTIVE' },
                include: { payslips: { include: { employee: true } } },
                orderBy: { date: 'desc' }
            });

            // Convert ALL Prisma Decimals to normal Javascript Numbers
            return history.map(h => ({
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
                    employee: p.employee ? {
                        ...p.employee,
                        monthly_salary: Number(p.employee.monthly_salary)
                    } : null
                }))
            }));
        } catch (error) {
            console.error("Failed to fetch payroll history", error);
            return [];
        }
    }
};