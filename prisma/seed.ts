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
        // Assets
        { code: '1010', name: 'Cash in Bank', type_id: 'type-asset' },
        { code: '1020', name: 'Petty Cash Fund', type_id: 'type-asset' },
        { code: '1200', name: 'Accounts Receivable', type_id: 'type-asset' },
        { code: '1300', name: 'Input VAT', type_id: 'type-asset' },
        { code: '1310', name: 'Creditable Withholding Tax (CWT)', type_id: 'type-asset' },
        { code: '1400', name: 'Prepaid Rent', type_id: 'type-asset' },
        { code: '1500', name: 'Medical Equipment', type_id: 'type-asset' },
        { code: '1501', name: 'Accumulated Depreciation', type_id: 'type-asset' },

        // Liabilities
        { code: '2010', name: 'Accounts Payable', type_id: 'type-liability' },
        { code: '2020', name: 'Output VAT', type_id: 'type-liability' },
        { code: '2030', name: 'VAT Payable', type_id: 'type-liability' },
        { code: '2040', name: 'Salaries Payable', type_id: 'type-liability' },
        { code: '2050', name: 'Expanded Withholding Tax (EWT) Payable', type_id: 'type-liability' },
        { code: '2100', name: 'Bank Loans Payable', type_id: 'type-liability' },

        // Equity
        { code: '3010', name: 'Owner\'s Capital', type_id: 'type-equity' },
        { code: '3020', name: 'Owner\'s Drawings', type_id: 'type-equity' },

        // Revenue
        { code: '4010', name: 'Consultation Fees', type_id: 'type-revenue' },
        { code: '4020', name: 'Laboratory / Diagnostic Income', type_id: 'type-revenue' },
        { code: '4030', name: 'Medicine / Pharmacy Sales', type_id: 'type-revenue' },
        { code: '4040', name: 'Medical Certificate Fees', type_id: 'type-revenue' },

        // Expenses
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
            update: { is_active: true },
            create: {
                username: u.username,
                password_hash: passwordHash,
                role: u.role as any,
                is_active: true,
            },
        });
    }

    console.log('✅ ALL Users seeded (Passwords are all: password123)');

    // =================================================================
    // 4. ---> NEW: SEED THE INITIAL PETTY CASH FLOAT (₱2,000) <---
    // =================================================================
    
    // Check if the opening entry already exists so we don't duplicate it
    const openingEntryExists = await prisma.journalEntry.findFirst({
        where: { reference_no: 'OPENING-FLOAT' }
    });

    if (!openingEntryExists) {
        // Find the accountant user we just created to assign as the creator of this entry
        const accountant = await prisma.user.findUnique({ where: { username: 'accountant' }});

        if (accountant) {
            await prisma.journalEntry.create({
                data: {
                    date: new Date(),
                    reference_no: 'OPENING-FLOAT',
                    description: 'Initial System Float and Capital Funding',
                    vat_type: 'EXEMPT',
                    user_id: accountant.id,
                    lines: {
                        create: [
                            { account_id: '1020', debit: 2000, credit: 0 }, // Asset increases by 2000
                            { account_id: '3010', debit: 0, credit: 2000 }  // Equity increases by 2000
                        ]
                    }
                }
            });
            console.log('✅ Opening Balance recorded: ₱2,000 injected into Petty Cash (1020).');
        }
    }

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