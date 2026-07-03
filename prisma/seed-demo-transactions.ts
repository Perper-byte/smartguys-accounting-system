// prisma/seed-demo-transactions.ts
//
// OPTIONAL second seed pass that layers realistic dummy TRANSACTIONS on top
// of the base Chart of Accounts / Users from prisma/seed.ts.
//
// Run AFTER the normal seed:
//   npx prisma db seed
//   npx ts-node prisma/seed-demo-transactions.ts
//
// This gives you real numbers to look at in the General Ledger, Financial
// Statements, BIR Reports, and Analytics Dashboard screens instead of an
// empty system.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to build a balanced journal entry + its lines in one go
async function post(
  date: Date,
  referenceNo: string,
  description: string,
  vatType: 'VATABLE' | 'EXEMPT' | 'ZERO_RATED',
  userId: string,
  payeeId: string | null,
  lines: { accountId: string; debit?: number; credit?: number }[]
) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (totalDebit.toFixed(2) !== totalCredit.toFixed(2)) {
    throw new Error(`Entry ${referenceNo} is unbalanced: DR ${totalDebit} vs CR ${totalCredit}`);
  }

  const entry = await prisma.journalEntry.create({
    data: {
      date,
      reference_no: referenceNo,
      description,
      vat_type: vatType,
      payee_id: payeeId || null,
      user_id: userId,
    },
  });

  await prisma.journalLine.createMany({
    data: lines.map((l) => ({
      entry_id: entry.id,
      account_id: l.accountId,
      debit: l.debit || 0,
      credit: l.credit || 0,
    })),
  });

  console.log(`  ↳ posted ${referenceNo}: ${description}`);
}

async function main() {
  console.log('🌱 Seeding demo transactions (Q1 2026, Jan–Mar)...');

  // Look up the seeded users so we attribute entries to the right role
  const cashier = await prisma.user.findUniqueOrThrow({ where: { username: 'cashier' } });
  const accountant = await prisma.user.findUniqueOrThrow({ where: { username: 'accountant' } });

  // 1. Create a handful of dummy payees (patients / suppliers)
  const payeeNames = [
    { name: 'Juan Dela Cruz', tin: '123-456-789-000' },
    { name: 'Maria Santos', tin: '234-567-890-000' },
    { name: 'Pedro Reyes', tin: '345-678-901-000' },
    { name: 'Meralco (Electric Utility)', tin: '000-111-222-000' },
    { name: 'MedSupply Philippines Inc.', tin: '000-333-444-000' },
    { name: 'Landlord Corp - Clinic Space', tin: '000-555-666-000' },
  ];

  const payees: Record<string, string> = {};
  for (const p of payeeNames) {
    const created = await prisma.payee.upsert({
      where: { id: `payee-${p.name.split(' ')[0].toLowerCase()}` },
      update: {},
      create: { id: `payee-${p.name.split(' ')[0].toLowerCase()}`, name: p.name, tin: p.tin },
    });
    payees[p.name] = created.id;
  }
  console.log('✅ Payees seeded (patients + suppliers).');

  // 2. OWNER'S INITIAL CAPITAL INJECTION (Jan 1)
  await post(
    new Date('2026-01-01'),
    'OR-1000',
    "Owner's initial cash investment to start clinic operations",
    'EXEMPT',
    accountant.id,
    null,
    [
      { accountId: '1010', debit: 500000 },
      { accountId: '3010', credit: 500000 },
    ]
  );

  // 3. PATIENT CONSULTATION REVENUE (cash, VATable) — several dates in January
  await post(new Date('2026-01-05'), 'OR-1001', 'Consultation fee - Juan Dela Cruz', 'VATABLE', cashier.id, payees['Juan Dela Cruz'], [
    { accountId: '1010', debit: 1120 },
    { accountId: '4010', credit: 1000 },
    { accountId: '2020', credit: 120 }, // Output VAT
  ]);

  await post(new Date('2026-01-08'), 'OR-1002', 'Laboratory / diagnostic fee - Maria Santos', 'VATABLE', cashier.id, payees['Maria Santos'], [
    { accountId: '1010', debit: 2800 },
    { accountId: '4020', credit: 2500 },
    { accountId: '2020', credit: 300 },
  ]);

  await post(new Date('2026-01-15'), 'OR-1003', 'Consultation fee - Pedro Reyes (on account)', 'VATABLE', cashier.id, payees['Pedro Reyes'], [
    { accountId: '1200', debit: 1680 }, // Accounts Receivable
    { accountId: '4010', credit: 1500 },
    { accountId: '2020', credit: 180 },
  ]);

  // 4. COLLECTION OF PEDRO'S RECEIVABLE (February)
  await post(new Date('2026-02-03'), 'OR-1010', 'Collection of A/R - Pedro Reyes', 'EXEMPT', cashier.id, payees['Pedro Reyes'], [
    { accountId: '1010', debit: 1680 },
    { accountId: '1200', credit: 1680 },
  ]);

  // 5. RENT PAID IN ADVANCE (Jan 2)
  await post(new Date('2026-01-02'), 'CV-2001', 'Prepaid rent for clinic space - 3 months', 'VATABLE', cashier.id, payees['Landlord Corp - Clinic Space'], [
    { accountId: '1400', debit: 30000 }, // Prepaid Rent
    { accountId: '1300', debit: 3600 },  // Input VAT
    { accountId: '1010', credit: 33600 },
  ]);

  // 6. UTILITIES DISBURSEMENT (Meralco) — how CashDisbursementForm posts it
  await post(new Date('2026-01-20'), 'CV-2002', 'Disbursement to Meralco (Electric Utility) - January electric bill', 'VATABLE', cashier.id, payees['Meralco (Electric Utility)'], [
    { accountId: '5020', debit: 4500 },
    { accountId: '1010', credit: 4500 },
  ]);

  await post(new Date('2026-02-19'), 'CV-2005', 'Disbursement to Meralco (Electric Utility) - February electric bill', 'VATABLE', cashier.id, payees['Meralco (Electric Utility)'], [
    { accountId: '5020', debit: 4750 },
    { accountId: '1010', credit: 4750 },
  ]);

  // 7. MEDICAL SUPPLIES PURCHASED ON ACCOUNT (creates Accounts Payable)
  await post(new Date('2026-01-25'), 'PV-3001', 'Medical supplies purchased on credit - MedSupply Philippines Inc.', 'VATABLE', accountant.id, payees['MedSupply Philippines Inc.'], [
    { accountId: '5010', debit: 12000 },
    { accountId: '1300', debit: 1440 },
    { accountId: '2010', credit: 13440 },
  ]);

  // 8. PARTIAL PAYMENT OF THAT PAYABLE (February)
  await post(new Date('2026-02-10'), 'CV-2004', 'Partial payment to MedSupply Philippines Inc.', 'EXEMPT', cashier.id, payees['MedSupply Philippines Inc.'], [
    { accountId: '2010', debit: 8000 },
    { accountId: '1010', credit: 8000 },
  ]);

  // 9. MORE FEBRUARY / MARCH REVENUE
  await post(new Date('2026-02-14'), 'OR-1015', 'Consultation fee - Juan Dela Cruz', 'VATABLE', cashier.id, payees['Juan Dela Cruz'], [
    { accountId: '1010', debit: 1120 },
    { accountId: '4010', credit: 1000 },
    { accountId: '2020', credit: 120 },
  ]);

  await post(new Date('2026-03-02'), 'OR-1020', 'Laboratory / diagnostic fee - Maria Santos', 'VATABLE', cashier.id, payees['Maria Santos'], [
    { accountId: '1010', debit: 3360 },
    { accountId: '4020', credit: 3000 },
    { accountId: '2020', credit: 360 },
  ]);

  // 10. PAYROLL (Salaries) for staff, end of March
  await post(new Date('2026-03-31'), 'CV-2010', 'March payroll for clinic staff', 'EXEMPT', accountant.id, null, [
    { accountId: '5100', debit: 45000 },
    { accountId: '1010', credit: 45000 },
  ]);

  // 11. MEDICAL EQUIPMENT PURCHASE (capitalized asset, Feb 1)
  await post(new Date('2026-02-01'), 'CV-2003', 'Purchase of diagnostic medical equipment', 'VATABLE', accountant.id, null, [
    { accountId: '1500', debit: 120000 },
    { accountId: '1300', debit: 14400 },
    { accountId: '1010', credit: 134400 },
  ]);

  // 12. ADJUSTING ENTRIES (accountant only, end of quarter - March 31)
  //  a) Depreciation on the equipment purchased above (straight-line, 1 month for simplicity)
  await post(new Date('2026-03-31'), 'ADJ-9001', 'Adjusting Entry: Monthly depreciation - medical equipment', 'EXEMPT', accountant.id, null, [
    { accountId: '5050', debit: 2000 },
    { accountId: '1501', credit: 2000 }, // Accumulated Depreciation
  ]);

  //  b) Expired prepaid rent (1 month of the 3 months prepaid in January)
  await post(new Date('2026-03-31'), 'ADJ-9002', 'Adjusting Entry: Rent expense for the month (expired prepaid rent)', 'EXEMPT', accountant.id, payees['Landlord Corp - Clinic Space'], [
    { accountId: '5040', debit: 10000 },
    { accountId: '1400', credit: 10000 },
  ]);

  console.log('✅ Demo transactions posted for Jan–Mar 2026.');
  console.log('🌱 Demo data seeding completed successfully!');
  console.log('');
  console.log('Try these next in the app:');
  console.log('  • General Ledger (accountant) → look up account 1010 (Cash in Bank)');
  console.log('  • Financial Statements (accountant/manager) → Jan 1 - Mar 31 2026');
  console.log('  • BIR Tax Reports (manager) → Year 2026, Quarter 1 (2550Q)');
  console.log('  • Analytics Dashboard (accountant/manager)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
