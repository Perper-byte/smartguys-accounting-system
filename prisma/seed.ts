// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');

    // --- OPTIONAL CLEANUP: Wipe old transactions so seeding is always clean ---
    await prisma.reconciliation.deleteMany({});
    await prisma.bankTransaction.deleteMany({});
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.payee.deleteMany({});
    // -----------------------------------------------------------------------

    // 1. Seed Account Types with their Standard Normal Balances
    await prisma.accountType.upsert({ where: { id: 'type-asset' }, update: {}, create: { id: 'type-asset', name: 'Asset', normal_balance: 'DEBIT' }});
    await prisma.accountType.upsert({ where: { id: 'type-liability' }, update: {}, create: { id: 'type-liability', name: 'Liability', normal_balance: 'CREDIT' }});
    await prisma.accountType.upsert({ where: { id: 'type-equity' }, update: {}, create: { id: 'type-equity', name: 'Equity', normal_balance: 'CREDIT' }});
    await prisma.accountType.upsert({ where: { id: 'type-revenue' }, update: {}, create: { id: 'type-revenue', name: 'Revenue', normal_balance: 'CREDIT' }});
    await prisma.accountType.upsert({ where: { id: 'type-expense' }, update: {}, create: { id: 'type-expense', name: 'Expense', normal_balance: 'DEBIT' }});
    console.log('✅ Standard Account Types seeded.');

    // 2. Seed Standard Chart of Accounts (COA)
    const accounts = [
        { code: '1010', name: 'Cash in Bank', type_id: 'type-asset' },
        { code: '1020', name: 'Petty Cash Fund', type_id: 'type-asset' },
        { code: '1200', name: 'Accounts Receivable', type_id: 'type-asset' },
        { code: '1300', name: 'Input VAT', type_id: 'type-asset' },
        { code: '1310', name: 'Creditable Withholding Tax (CWT)', type_id: 'type-asset' },
        { code: '1400', name: 'Prepaid Rent', type_id: 'type-asset' },
        { code: '1500', name: 'Medical Equipment', type_id: 'type-asset' },
        { code: '1501', name: 'Accumulated Depreciation', type_id: 'type-asset' },
        { code: '2010', name: 'Accounts Payable', type_id: 'type-liability' },
        { code: '2020', name: 'Output VAT', type_id: 'type-liability' },
        { code: '2030', name: 'VAT Payable', type_id: 'type-liability' },
        { code: '2040', name: 'Salaries Payable', type_id: 'type-liability' },
        { code: '2050', name: 'Expanded Withholding Tax (EWT) Payable', type_id: 'type-liability' },
        { code: '2100', name: 'Bank Loans Payable', type_id: 'type-liability' },
        { code: '3010', name: 'Owner\'s Capital', type_id: 'type-equity' },
        { code: '3020', name: 'Owner\'s Drawings', type_id: 'type-equity' },
        { code: '4010', name: 'Consultation Fees', type_id: 'type-revenue' },
        { code: '4020', name: 'Laboratory / Diagnostic Income', type_id: 'type-revenue' },
        { code: '4030', name: 'Medicine / Pharmacy Sales', type_id: 'type-revenue' },
        { code: '4040', name: 'Medical Certificate Fees', type_id: 'type-revenue' },
        { code: '5010', name: 'Medical Supplies Expense', type_id: 'type-expense' },
        { code: '5020', name: 'Utilities Expense', type_id: 'type-expense' },
        { code: '5030', name: 'Professional Fees Expense', type_id: 'type-expense' },
        { code: '5040', name: 'Rent Expense', type_id: 'type-expense' },
        { code: '5050', name: 'Depreciation Expense', type_id: 'type-expense' },
        { code: '5100', name: 'Salaries and Wages', type_id: 'type-expense' },
    ];
    for (const acc of accounts) { await prisma.account.upsert({ where: { code: acc.code }, update: {}, create: acc }); }
    console.log('✅ Chart of Accounts seeded.');

    // 3. Seed Users
    const dummyAccountantPassword = 'password123';
    const passwordHash = crypto.createHash('sha256').update(dummyAccountantPassword).digest('hex');
    const users = [
        { username: 'cashier', role: 'CASHIER' }, { username: 'accountant', role: 'ACCOUNTANT' },
        { username: 'manager', role: 'MANAGER' }, { username: 'it_admin', role: 'IT_PERSONNEL' }
    ];
    for (const u of users) {
        await prisma.user.upsert({
            where: { username: u.username }, update: { is_active: true },
            create: { username: u.username, password_hash: passwordHash, role: u.role as any, is_active: true }
        });
    }
    const adminUser = await prisma.user.findUnique({ where: { username: 'accountant' } });
    console.log('✅ Users seeded (Passwords: password123)');

    // =================================================================
    // 4. DUMMY PAYEES, DOCTORS, AND EMPLOYEES
    // =================================================================
    const hmo = await prisma.payee.create({ data: { name: 'Maxicare Healthcare', type: 'HMO', tin: '000-111-222-000' } });
    const vendor = await prisma.payee.create({ data: { name: 'MedSupplies Corp', type: 'SUPPLIER', tin: '999-888-777-000' } });
    const doctor = await prisma.payee.create({ data: { name: 'Dr. Jose Rizal', type: 'DOCTOR', tin: '123-456-789-000' } });
    const patient = await prisma.payee.create({ data: { name: 'Maria Clara', type: 'PATIENT' } });

    await prisma.employee.create({ data: { first_name: 'Ana', last_name: 'Nurse', position: 'Head Nurse', monthly_salary: 25000, is_active: true } });
    await prisma.employee.create({ data: { first_name: 'Pedro', last_name: 'Guard', position: 'Security Guard', monthly_salary: 15000, is_active: true } });
    console.log('✅ Payees and Employees seeded.');

    // =================================================================
    // 5. REALISTIC DUMMY TRANSACTIONS
    // =================================================================
    if (adminUser) {
        const today = new Date();
        const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7);
        const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);

        console.log('🔄 Injecting realistic dummy transactions...');

        // Tx 1: Cash Walk-in Sale (Exempt)
        await prisma.journalEntry.create({
            data: {
                date: twoWeeksAgo, reference_no: 'OR-001', description: 'Walk-in Consultation - Cash', vat_type: 'EXEMPT',
                user_id: adminUser.id, payee_id: patient.id, status: 'ACTIVE',
                lines: { create: [ { account_id: '1010', debit: 1500, credit: 0 }, { account_id: '4010', debit: 0, credit: 1500 } ] }
            }
        });

        // Tx 2: HMO Billing (Vatable) -> AR + Output VAT
        await prisma.journalEntry.create({
            data: {
                date: twoWeeksAgo, reference_no: 'INV-001', description: 'HMO Billing for Medical Labs', vat_type: 'VATABLE',
                user_id: adminUser.id, payee_id: hmo.id, status: 'ACTIVE',
                lines: { create: [ 
                    { account_id: '1200', debit: 5600, credit: 0 }, // AR
                    { account_id: '4020', debit: 0, credit: 5000 }, // Revenue
                    { account_id: '2020', debit: 0, credit: 600 }   // 12% Output VAT
                ] }
            }
        });

        // Tx 3: Supplier Purchase on Account (Vatable) -> AP + Input VAT
        await prisma.journalEntry.create({
            data: {
                date: lastWeek, reference_no: 'PJ-001', description: 'Purchase of Medical Supplies', vat_type: 'VATABLE',
                user_id: adminUser.id, payee_id: vendor.id, status: 'ACTIVE',
                lines: { create: [ 
                    { account_id: '5010', debit: 10000, credit: 0 }, // Expense
                    { account_id: '1300', debit: 1200, credit: 0 },  // 12% Input VAT
                    { account_id: '2010', debit: 0, credit: 11200 }  // AP
                ] }
            }
        });

        // Tx 4: Supplier Payment (Cash Disbursement)
        await prisma.journalEntry.create({
            data: {
                date: today, reference_no: 'CV-001', description: 'Payment to MedSupplies Corp for PJ-001', vat_type: 'EXEMPT',
                user_id: adminUser.id, payee_id: vendor.id, status: 'ACTIVE',
                lines: { create: [ 
                    { account_id: '2010', debit: 11200, credit: 0 }, // Clearing AP
                    { account_id: '1010', debit: 0, credit: 11200 }  // Bank drops
                ] }
            }
        });

        // Tx 5: Doctor Payout (EWT Withholding Tax)
        await prisma.journalEntry.create({
            data: {
                date: today, reference_no: 'CV-002', description: 'Professional Fee Payout - Dr. Rizal (10% EWT)', vat_type: 'EXEMPT',
                user_id: adminUser.id, payee_id: doctor.id, status: 'ACTIVE',
                lines: { create: [ 
                    { account_id: '5030', debit: 20000, credit: 0 }, // Expense
                    { account_id: '2050', debit: 0, credit: 2000 },  // 10% Withheld Tax
                    { account_id: '1010', debit: 0, credit: 18000 }  // Bank drops
                ] }
            }
        });

        // Tx 6: Payroll Processing
        await prisma.journalEntry.create({
            data: {
                date: today, reference_no: 'PY-001', description: 'Staff Salary for Mid-Month', vat_type: 'EXEMPT',
                user_id: adminUser.id, status: 'ACTIVE',
                lines: { create: [ 
                    { account_id: '5100', debit: 20000, credit: 0 }, // Gross Salary
                    { account_id: '1010', debit: 0, credit: 20000 }  // Bank drops
                ] }
            }
        });

        console.log('✅ Transactions seeded perfectly.');
    }

    console.log('🎉 Database seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });