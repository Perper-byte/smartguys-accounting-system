// prisma/seed-demo-transactions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to build a balanced journal entry
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

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
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
}

function randomDate(year: number, month: number) {
  const day = Math.floor(Math.random() * 28) + 1; // 1 to 28 avoids month-overflow bugs
  const d = new Date(year, month, day);
  d.setHours(Math.floor(Math.random() * 9) + 8); // Random hour between 8 AM and 4 PM
  return d;
}

function randomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🧹 Purging old journal entries to prevent duplication...');
  await prisma.journalLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});

  console.log('🌱 Generating ~2 Years of Simulated Historical Data (Jan 2025 - Sep 2026)...');

  // Look up the seeded users 
  const cashier = await prisma.user.findUnique({ where: { username: 'cashier' } }) || await prisma.user.findFirst();
  const accountant = await prisma.user.findUnique({ where: { username: 'accountant' } }) || await prisma.user.findFirst();

  if (!cashier || !accountant) {
    throw new Error('No users found. Please run the base seed first (npx prisma db seed).');
  }

  // 1. Create realistic Payees (HMOs, Patients, Suppliers)
  const payeesList = [
    { name: 'Maxicare HMO', type: 'HMO', tin: '111-222-333' },
    { name: 'Intellicare HMO', type: 'HMO', tin: '444-555-666' },
    { name: 'PhilHealth', type: 'HMO', tin: '777-888-999' },
    { name: 'Juan Dela Cruz', type: 'PATIENT', tin: '000-000-001' },
    { name: 'Maria Santos', type: 'PATIENT', tin: '000-000-002' },
    { name: 'Meralco (Electric Utility)', type: 'SUPPLIER', tin: '000-111-222' },
    { name: 'MedSupply Philippines Inc.', type: 'SUPPLIER', tin: '000-333-444' },
    { name: 'Landlord Corp - Clinic Space', type: 'SUPPLIER', tin: '000-555-666' },
  ];

  const payees: Record<string, string> = {};
  for (const p of payeesList) {
    const created = await prisma.payee.upsert({
      where: { id: `payee-${p.name.split(' ')[0].toLowerCase()}` },
      update: {},
      create: {
        id: `payee-${p.name.split(' ')[0].toLowerCase()}`,
        name: p.name,
        type: p.type,
        tin: p.tin
      },
    });
    payees[p.name] = created.id;
  }

  // 2. Initial Capital Injection (Jan 1, 2025)
  await post(
    new Date('2025-01-01T09:00:00'),
    'OR-2025-INIT',
    "Owner's Initial Capital Investment",
    'EXEMPT',
    accountant.id,
    null,
    [
      { accountId: '1010', debit: 1500000 }, // Cash in Bank
      { accountId: '3010', credit: 1500000 }, // Owner's Equity
    ]
  );

  let refCounter = 1000;
  let totalTransactions = 1;

  // 3. The Data Loop: Months from Jan 2025 to Sep 2026
  for (let year = 2025; year <= 2026; year++) {
    const endMonth = year === 2026 ? 8 : 11; // 8 = September

    for (let month = 0; month <= endMonth; month++) {

      // -- A. Fixed Monthly Expenses --

      // Office Rent
      await post(
        randomDate(year, month),
        `CV-${refCounter++}`,
        `Monthly Clinic Rent for ${month + 1}/${year}`,
        'VATABLE',
        cashier.id,
        payees['Landlord Corp - Clinic Space'],
        [
          { accountId: '5040', debit: 30000 }, // Rent Exp
          { accountId: '1300', debit: 3600 },  // Input VAT
          { accountId: '1010', credit: 33600 }, // Cash
        ]
      );
      totalTransactions++;

      // Utilities
      const utilityAmt = randomNumber(8000, 15000);
      await post(
        randomDate(year, month),
        `CV-${refCounter++}`,
        `Electric & Water Bill`,
        'EXEMPT',
        cashier.id,
        payees['Meralco (Electric Utility)'],
        [
          { accountId: '5020', debit: utilityAmt }, // Utilities Exp
          { accountId: '1010', credit: utilityAmt }, // Cash
        ]
      );
      totalTransactions++;

      // Payroll (End of Month)
      const lastDay = new Date(year, month + 1, 0);
      lastDay.setHours(15);
      await post(
        lastDay,
        `CV-${refCounter++}`,
        `Monthly Payroll for Clinic Staff`,
        'EXEMPT',
        accountant.id,
        null,
        [
          { accountId: '5100', debit: 85000 }, // Salaries Exp
          { accountId: '1010', credit: 85000 }, // Cash
        ]
      );
      totalTransactions++;

      // -- B. Daily Walk-in Patient Revenue (Cash) --
      const walkInCount = randomNumber(5, 12);
      for (let i = 0; i < walkInCount; i++) {
        const revenue = randomNumber(1500, 4000);
        await post(
          randomDate(year, month),
          `OR-${refCounter++}`,
          `Walk-in Consultation & Lab Fee`,
          'VATABLE',
          cashier.id,
          Math.random() > 0.5 ? payees['Juan Dela Cruz'] : payees['Maria Santos'],
          [
            { accountId: '1010', debit: revenue }, // Cash
            { accountId: '4010', credit: Math.floor(revenue * 0.7) }, // Consult Rev
            { accountId: '4020', credit: Math.floor(revenue * 0.2) }, // Lab Rev
            { accountId: '2020', credit: revenue - Math.floor(revenue * 0.7) - Math.floor(revenue * 0.2) }, // Output VAT
          ]
        );
        totalTransactions++;
      }

      // -- C. HMO Billings / Accounts Receivable --
      // Generates billings to populate Aged Receivables
      const hmoList = ['Maxicare HMO', 'Intellicare HMO', 'PhilHealth'];
      const hmoCount = randomNumber(2, 4);

      for (let i = 0; i < hmoCount; i++) {
        const hmo = hmoList[randomNumber(0, hmoList.length - 1)];
        const billedAmt = randomNumber(25000, 60000);
        const billDate = randomDate(year, month);
        const invoiceRef = `INV-${refCounter++}`;

        await post(
          billDate,
          invoiceRef,
          `HMO Billing - ${hmo}`,
          'EXEMPT',
          cashier.id,
          payees[hmo],
          [
            { accountId: '1200', debit: billedAmt }, // A/R
            { accountId: '4010', credit: Math.floor(billedAmt * 0.6) }, // Consult
            { accountId: '4020', credit: Math.ceil(billedAmt * 0.4) },  // Lab
          ]
        );
        totalTransactions++;

        // -- D. HMO Collections (Paid 30-90 days later) --
        // To make the Aging Report realistic, leave some recent ones unpaid.
        const isRecent = (year === 2026 && month >= 6); // July, Aug, Sep
        const willPay = isRecent ? Math.random() > 0.7 : Math.random() > 0.05; // 95% paid if old, 30% if recent

        if (willPay) {
          const collectionDate = new Date(billDate);
          collectionDate.setDate(collectionDate.getDate() + randomNumber(30, 95)); // Delayed payment

          // Only post collection if it hasn't exceeded the current real-world date
          if (collectionDate < new Date('2026-09-12')) {
            await post(
              collectionDate,
              `CR-${refCounter++}`,
              `HMO Collection for ${invoiceRef}`,
              'EXEMPT',
              accountant.id,
              payees[hmo],
              [
                { accountId: '1010', debit: billedAmt }, // Cash
                { accountId: '1200', credit: billedAmt }, // A/R
              ]
            );
            totalTransactions++;
          }
        }
      }

      // -- E. Accounts Payable & Inventory Purchases --
      // Buy supplies every other month
      if (month % 2 === 0) {
        const suppliesAmt = randomNumber(25000, 50000);
        const billDate = randomDate(year, month);

        // 1. Purchase on account (A/P)
        await post(
          billDate,
          `BILL-${refCounter++}`,
          `Medical Supplies Restock`,
          'VATABLE',
          accountant.id,
          payees['MedSupply Philippines Inc.'],
          [
            { accountId: '5010', debit: Math.floor(suppliesAmt * 0.88) }, // Supplies Exp
            { accountId: '1300', debit: Math.ceil(suppliesAmt * 0.12) },  // Input VAT
            { accountId: '2010', credit: suppliesAmt }, // A/P
          ]
        );
        totalTransactions++;

        // 2. Pay it 15-30 days later
        const payDate = new Date(billDate);
        payDate.setDate(payDate.getDate() + randomNumber(15, 30));

        if (payDate < new Date('2026-09-12')) {
          await post(
            payDate,
            `CV-${refCounter++}`,
            `Payment for Medical Supplies`,
            'EXEMPT',
            cashier.id,
            payees['MedSupply Philippines Inc.'],
            [
              { accountId: '2010', debit: suppliesAmt }, // A/P
              { accountId: '1010', credit: suppliesAmt }, // Cash
            ]
          );
          totalTransactions++;
        }
      }
    }
  }

  console.log(`✅ Successfully generated ${totalTransactions} transactions spanning 21 months!`);
  console.log('📊 Your Dashboard, Aged Receivables, and Income Statements will now show trends, seasonality, and depth.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });