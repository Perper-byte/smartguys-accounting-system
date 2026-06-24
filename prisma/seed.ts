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

    // 2. Seed Standard Chart of Accounts (COA) based on proposal Table 4 (Page-58-59)
    const accounts = [
        // Assets
        { code: '1010', name: 'Cash in Bank', type_id: 'type-asset' },
        { code: '1200', name: 'Accounts Receivable', type_id: 'type-asset' },

        // Liabilities
        { code: '2010', name: 'Accounts Payable', type_id: 'type-liability' },

        // Equity
        { code: '3010', name: 'Retained Earning', type_id: 'type-equity' },

        // Revenue
        { code: '4010', name: 'Service Revenue', type_id: 'type-revenue' },

        // Expenses
        { code: '5010', name: 'Medical Supplies Expense', type_id: 'type-expense' },
        { code: '5020', name: 'Utilities Expense', type_id: 'type-expense' },
        { code: '5030', name: 'Salaries Expense', type_id: 'type-expense' },
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

    // 3. Seed a Default Accountant User for testing
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
            update: {},
            create: {
                username: u.username,
                password_hash: passwordHash,
                role: u.role as any,
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