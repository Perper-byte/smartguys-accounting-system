// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');

    // 1. Seed Account Types with their Standard Normal Balances
    const assetType = await prisma.accountType.upsert({
        where: { id: 'type-asset' },
        update: {},
        create: { id: 'type-asset', name: 'Asset', normal_balance: 'DEBIT' },
    });

    const liabilityType = await prisma.accountType.upsert({
        where: { id: 'type-liability' },
        update: {},
        create: { id: 'type-liability', name: 'Liability', normal_balance: 'CREDIT' },
    });

    const equityType = await prisma.accountType.upsert({
        where: { id: 'type-equity' },
        update: {},
        create: { id: 'type-equity', name: 'Equity', normal_balance: 'CREDIT' },
    });

    const revenueType = await prisma.accountType.upsert({
        where: { id: 'type-revenue' },
        update: {},
        create: { id: 'type-revenue', name: 'Revenue', normal_balance: 'CREDIT' },
    });

    const expenseType = await prisma.accountType.upsert({
        where: { id: 'type-expense' },
        update: {},
        create: { id: 'type-expense', name: 'Expense', normal_balance: 'DEBIT' },
    });

    console.log('✅ Standard Account Types seeded.');

    // 2. Seed Standard Chart of Accounts (COA)
    const accounts = [
        // ==========================================
        // 1000s - ASSETS (What the clinic owns)
        // ==========================================
        { code: '1010', name: 'Cash in Bank', type_id: 'type-asset' },
        { code: '1020', name: 'Petty Cash Fund', type_id: 'type-asset' },
        { code: '1200', name: 'Accounts Receivable', type_id: 'type-asset' },
        { code: '1300', name: 'Input VAT', type_id: 'type-asset' },
        { code: '1310', name: 'Creditable Withholding Tax (CWT)', type_id: 'type-asset' },
        { code: '1400', name: 'Prepaid Rent', type_id: 'type-asset' },
        { code: '1500', name: 'Medical Equipment', type_id: 'type-asset' },
        { code: '1501', name: 'Accumulated Depreciation', type_id: 'type-asset' },

        // ==========================================
        // 2000s - LIABILITIES (What the clinic owes)
        // ==========================================
        { code: '2010', name: 'Accounts Payable', type_id: 'type-liability' },
        { code: '2020', name: 'Output VAT', type_id: 'type-liability' },
        { code: '2030', name: 'VAT Payable', type_id: 'type-liability' },
        { code: '2040', name: 'Salaries Payable', type_id: 'type-liability' },
        { code: '2050', name: 'Expanded Withholding Tax (EWT) Payable', type_id: 'type-liability' },
        { code: '2100', name: 'Bank Loans Payable', type_id: 'type-liability' },

        // ==========================================
        // 3000s - EQUITY (Owner's worth in  the business)
        // ==========================================
        { code: '3010', name: 'Owner\'s Capital', type_id: 'type-equity' },
        { code: '3020', name: 'Owner\'s Drawings', type_id: 'type-equity' },

        // ==========================================
        // 4000s - REVENUE (Money earned)
        // ==========================================
        { code: '4010', name: 'Consultation Fees', type_id: 'type-revenue' },
        { code: '4020', name: 'Laboratory / Diagnostic Income', type_id: 'type-revenue' },

        // ==========================================
        // 5000s - EXPENSES (Money spent to run the business)
        // ==========================================
        { code: '5010', name: 'Medical Supplies Expense', type_id: 'type-expense' },
        { code: '5020', name: 'Utilities Expense', type_id: 'type-expense' },
        { code: '5040', name: 'Rent Expense', type_id: 'type-expense' },
        { code: '5050', name: 'Depreciation Expense', type_id: 'type-expense' },
        { code: '5100', name: 'Salaries and Wages', type_id: 'type-expense' },
    ];

    for (const acc of accounts) {
        await prisma.account.upsert({
            where: { code: acc.code },
            update: {},
            create: {
                code: acc.code,
                name: acc.name,
                type_id: acc.type_id
            },
        });
    }

    // 3. Seed Default Users for testing
    const dummyAccountantPassword = 'password123';
    // Standard SHA-256 hash matching our AuthService rules
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(dummyAccountantPassword).digest('hex');

    const users = [
        { username: 'cashier', role: 'CASHIER' },
        { username: 'accountant', role: 'ACCOUNTANT' },
        { username: 'manager', role: 'MANAGER' },
        { username: 'it_admin', role: 'IT_PERSONNEL' }
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { username: u.username },
            update: {
                is_active: true // Ensures they are re-activated if seed is run again
            },
            create: {
                username: u.username,
                password_hash: passwordHash,
                role: u.role as any,
                is_active: true, // <--- ADDED THIS HERE
            },
        });
    }

    console.log('✅ ALL Users seeded (Passwords are all: password123)');
    console.log('   - cashier');
    console.log('   - accountant');
    console.log('   - manager');
    console.log('   - it_admin');
    console.log('🌱 Database seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });