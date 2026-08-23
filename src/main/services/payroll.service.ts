// src/main/services/payroll.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const PayrollService = {
    
    async getEmployees() {
        // 🔥 FIX: Removed "where: { is_active: true }" so archived employees stay in the directory!
        const employees = await prisma.employee.findMany({
            orderBy: { first_name: 'asc' }
        });

        // ---> THE FIX: Convert Prisma Decimal to normal Number so Electron doesn't crash! <---
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
                    tin: data.tin,
                    sss_no: data.sss,
                    philhealth_no: data.philhealth,
                    pagibig_no: data.pagibig
                }
            });
            return { success: true };
        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    },

    async toggleEmployeeStatus(id: string, isActive: boolean) {
        try {
            await prisma.employee.update({
                where: { id },
                data: { is_active: isActive }
            });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    async processPayroll(data: any) {
        try {
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
            // Note: We route this to '2040 - Salaries Payable' to act as our holding account for the BIR/SSS
            if (totalDeductionsAndTax > 0) {
                lines.push({ account_id: '2040', debit: 0, credit: totalDeductionsAndTax });
            }

            // 3. CREDIT: Cash in Bank (1010) - The actual net pay leaving the bank
            lines.push({ account_id: '1010', debit: 0, credit: totalNet });

            await prisma.journalEntry.create({
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

            return { success: true };
        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    }
};