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
    await prisma.serviceItem.deleteMany({}); // 🔥 Wipe old services
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
        { code: '1030', name: 'Cash in Hand', type_id: 'type-asset' },
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
        { username: 'SYSTEM', role: 'IT_PERSONNEL' }, // 🔥 Added the SYSTEM user!
        { username: 'cashier', role: 'CASHIER' }, 
        { username: 'accountant', role: 'ACCOUNTANT' }, 
        { username: 'manager', role: 'MANAGER' }, 
        { username: 'it_admin', role: 'IT_PERSONNEL' }
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
    // 4. SEED ALL PROCEDURES INTO DATABASE
    // =================================================================
    console.log('💉 Injecting Lab Procedures & Prices into database...');
    const LAB_TESTS = [
      // Blood Chemistry
      { category: 'Blood Chemistry', name: 'FBS/RBS/2 PPBS', price: 150 }, { category: 'Blood Chemistry', name: 'OGCT', price: 350 }, { category: 'Blood Chemistry', name: 'OGTT', price: 450 }, { category: 'Blood Chemistry', name: 'BUN', price: 180 }, { category: 'Blood Chemistry', name: 'CREATININE', price: 180 }, { category: 'Blood Chemistry', name: 'BUA', price: 150 }, { category: 'Blood Chemistry', name: 'CHOLESTEROL', price: 200 }, { category: 'Blood Chemistry', name: 'TRIGLYCERIDES', price: 250 }, { category: 'Blood Chemistry', name: 'HDL/LDL/VLDL (each)', price: 200 }, { category: 'Blood Chemistry', name: 'BILIRUBIN (TB, DB, IB)', price: 250 }, { category: 'Blood Chemistry', name: 'TOTAL PROTEIN', price: 200 }, { category: 'Blood Chemistry', name: 'Albumin', price: 200 }, { category: 'Blood Chemistry', name: 'TPAG', price: 350 }, { category: 'Blood Chemistry', name: 'HBA1 (with machine print out & graph)', price: 850 },
      // Enzymes
      { category: 'Enzymes', name: 'SGPT/ALT', price: 250 }, { category: 'Enzymes', name: 'SGOT/AST', price: 250 }, { category: 'Enzymes', name: 'GGTP', price: 350 }, { category: 'Enzymes', name: 'Alkaline Phosphatase', price: 250 }, { category: 'Enzymes', name: 'Acid Phosphatase', price: 350 }, { category: 'Enzymes', name: 'Amylase', price: 300 }, { category: 'Enzymes', name: 'Lipase', price: 350 }, { category: 'Enzymes', name: 'Total CPK', price: 450 }, { category: 'Enzymes', name: 'CPK-MB', price: 650 }, { category: 'Enzymes', name: 'CPK-MM', price: 650 }, { category: 'Enzymes', name: 'TROPONIN (serum) T (edta)', price: 1200 }, { category: 'Enzymes', name: 'LDH', price: 350 },
      // Electrolytes & Packages
      { category: 'Electrolytes', name: 'Sodium', price: 200 }, { category: 'Electrolytes', name: 'Potassium', price: 200 }, { category: 'Electrolytes', name: 'Chloride', price: 200 }, { category: 'Electrolytes', name: 'Magnesium', price: 250 }, { category: 'Electrolytes', name: 'Inorganic Phosphorus', price: 250 }, { category: 'Electrolytes', name: 'Total Iron', price: 350 }, { category: 'Electrolytes', name: 'TIBC + Total Iron', price: 450 }, { category: 'Electrolytes', name: 'Calcium', price: 250 }, { category: 'Electrolytes', name: 'Ionized Calcium', price: 450 }, { category: 'Electrolytes', name: 'ABG', price: 950 }, { category: 'Electrolytes', name: 'Lithium (serum) (3days)', price: 650 }, { category: 'Electrolytes', name: 'Ammonia (green top) (3days)', price: 850 },
      { category: 'Chemistry Packages', name: 'Electrolytes (Na, K, Cl)', price: 550 }, { category: 'Chemistry Packages', name: 'Lipid Profile (TC, TG, HDL, LDL, VLDL)', price: 750 }, { category: 'Chemistry Packages', name: 'Liver Profile (OT, PT, ALP, BILI, TPAG)', price: 950 }, { category: 'Chemistry Packages', name: 'Kidney Profile (CREA, BUN, BUA)', price: 650 }, { category: 'Chemistry Packages', name: 'Chem 5 (FBS, BUN, CREA, BUA, TC)', price: 850 }, { category: 'Chemistry Packages', name: 'Chem 6 (FBS, BUN, CREA, BUA, TC, TG)', price: 1000 }, { category: 'Chemistry Packages', name: 'Chem 8 (Chem 5 + TG, HDL, LDL)', price: 1200 }, { category: 'Chemistry Packages', name: 'Chem 10 (Chem 8 + SGPT, SGOT)', price: 1500 }, { category: 'Chemistry Packages', name: 'Chem 12 (Chem 10 + L, NA)', price: 1800 },
      // Hematology & Microscopy
      { category: 'Hematology', name: 'Complete Blood Count', price: 150 }, { category: 'Hematology', name: 'Platelet Count', price: 150 }, { category: 'Hematology', name: 'Hgb & Hct', price: 150 }, { category: 'Hematology', name: 'Reticulocyte Count', price: 200 }, { category: 'Hematology', name: 'ESR', price: 150 }, { category: 'Hematology', name: 'ABO Typing', price: 250 }, { category: 'Hematology', name: 'Peripheral Blood Smear (PBS)', price: 350 }, { category: 'Hematology', name: 'Malarial Smear', price: 250 }, { category: 'Hematology', name: 'LE Preparation', price: 350 }, { category: 'Hematology', name: 'Protime', price: 450 }, { category: 'Hematology', name: 'APTT', price: 450 }, { category: 'Hematology', name: 'Coombs Test', price: 550 }, { category: 'Hematology', name: 'RH Factor', price: 200 },
      { category: 'Clinical Microscopy', name: 'Urinalysis', price: 100 }, { category: 'Clinical Microscopy', name: 'Urobilinogen', price: 150 }, { category: 'Clinical Microscopy', name: 'Ketone/Acetone', price: 150 }, { category: 'Clinical Microscopy', name: 'Bile/Nitrates/Bilirubin', price: 150 }, { category: 'Clinical Microscopy', name: 'SUGAR', price: 150 }, { category: 'Clinical Microscopy', name: 'Micro-Albumin Test', price: 450 }, { category: 'Clinical Microscopy', name: 'Pregnancy Test (Urine)', price: 150 }, { category: 'Clinical Microscopy', name: 'Pregnancy Test (serum)', price: 450 }, { category: 'Clinical Microscopy', name: 'Fecalysis', price: 100 }, { category: 'Clinical Microscopy', name: 'Occult Blood', price: 200 }, { category: 'Clinical Microscopy', name: 'Concentration Technique', price: 250 }, { category: 'Clinical Microscopy', name: 'Body Fluids', price: 450 }, { category: 'Clinical Microscopy', name: 'Cell & Diff. Count', price: 350 },
      { category: '24 Hour Urine Test', name: 'Creatinine Total', price: 350 }, { category: '24 Hour Urine Test', name: 'Creatinine Clearance', price: 450 }, { category: '24 Hour Urine Test', name: 'Protein', price: 350 },
      // Serology
      { category: 'Serology', name: 'VDRL/RPR', price: 250 }, { category: 'Serology', name: 'TPHA/SCREENING', price: 350 }, { category: 'Serology', name: 'TPHA w/titer', price: 450 }, { category: 'Serology', name: 'RPE w/titer', price: 450 }, { category: 'Serology', name: 'Widal Test', price: 350 }, { category: 'Serology', name: 'Typhidot', price: 850 }, { category: 'Serology', name: 'ASO titer', price: 350 }, { category: 'Serology', name: 'Chlamdial (cervical swab)', price: 650 }, { category: 'Serology', name: 'CRP', price: 450 }, { category: 'Serology', name: 'RA/RF Latex', price: 450 }, { category: 'Serology', name: 'C3', price: 550 }, { category: 'Serology', name: 'ANA w/titer', price: 750 }, { category: 'Serology', name: 'Dengue IgM & IgG', price: 1200 }, { category: 'Serology', name: 'Leptospiral Test (ELISA)', price: 1200 }, { category: 'Serology', name: 'H. Pylori Total', price: 850 }, { category: 'Serology', name: 'NS-1', price: 950 }, { category: 'Serology', name: 'Rubella IgM', price: 850 }, { category: 'Serology', name: 'Rubella IgG', price: 850 }, { category: 'Serology', name: 'CMV IgM', price: 850 }, { category: 'Serology', name: 'CMV IgG', price: 850 }, { category: 'Serology', name: 'Toxoplasma IgM', price: 850 }, { category: 'Serology', name: 'Toxoplasma IgG', price: 850 }, { category: 'Serology', name: 'HSV 1 & 2 ELISA IGM', price: 850 }, { category: 'Serology', name: 'HSV 1 & 2 ELISA IGG', price: 850 }, { category: 'Serology', name: 'VARICELLA IgG', price: 850 }, { category: 'Serology', name: 'VARICELLA IgM', price: 850 }, { category: 'Serology', name: 'TORCH TEST ELISA (IgG/IgM each)', price: 2500 }, { category: 'Serology', name: 'HIV TEST DOH ACCREDITED', price: 850 }, { category: 'Serology', name: 'HIV (AIDS) Screening', price: 850 }, { category: 'Serology', name: 'HIV (AIDS) w/titer (ELISA)', price: 1200 },
      // Thyroid, Hepatitis, Hormones
      { category: 'Thyroid Function', name: 'T3', price: 450 }, { category: 'Thyroid Function', name: 'T4', price: 450 }, { category: 'Thyroid Function', name: 'TSH', price: 450 }, { category: 'Thyroid Function', name: 'FT3', price: 650 }, { category: 'Thyroid Function', name: 'THS', price: 450 }, { category: 'Thyroid Function', name: 'TSH IRMA (AFTER 2 DAYS)', price: 850 }, { category: 'Thyroid Function', name: 'PARATHYROID HORMONE', price: 1200 }, { category: 'Thyroid Function', name: 'FT3 RIA (AFTER 2 DAYS)', price: 650 }, { category: 'Thyroid Function', name: 'FT4 RIA (AFTER 2 DAYS)', price: 650 }, { category: 'Thyroid Function', name: 'THYROGLOBULIN', price: 1200 },
      { category: 'Hepatitis', name: 'HbsAg Screening', price: 350 }, { category: 'Hepatitis', name: 'HbsAg w/Titer', price: 550 }, { category: 'Hepatitis', name: 'Anti-HBS', price: 650 }, { category: 'Hepatitis', name: 'HbeAg', price: 650 }, { category: 'Hepatitis', name: 'Anti-Hbe', price: 650 }, { category: 'Hepatitis', name: 'Anti-HBC IgM', price: 650 }, { category: 'Hepatitis', name: 'Anti-HBC IgG', price: 650 }, { category: 'Hepatitis', name: 'Anti-HAV IgM', price: 650 }, { category: 'Hepatitis', name: 'Anti-HAV IgG', price: 650 }, { category: 'Hepatitis', name: 'Anti-HCV', price: 650 }, { category: 'Hepatitis', name: 'Hepatitis Profile', price: 1500 }, { category: 'Hepatitis', name: 'Hepatitis B Profile', price: 1200 }, { category: 'Hepatitis', name: 'Hepatitis A & B Profile', price: 2000 }, { category: 'Hepatitis', name: 'Hepatitis A,B,C Profile', price: 3000 },
      { category: 'Hormones', name: 'FSH/LH (each)', price: 850 }, { category: 'Hormones', name: 'Prolactin', price: 850 }, { category: 'Hormones', name: 'Estrogen/Estradiol', price: 850 }, { category: 'Hormones', name: 'Progesterone', price: 850 }, { category: 'Hormones', name: 'Testosterone', price: 850 }, { category: 'Hormones', name: 'Cortisol', price: 850 }, { category: 'Hormones', name: 'Ferritin', price: 850 },
      // Tumor Markers, Bacteriology, Histopathology
      { category: 'Tumor Markers', name: 'AFP', price: 1200 }, { category: 'Tumor Markers', name: 'CEA (COLON)', price: 1200 }, { category: 'Tumor Markers', name: 'PSA (PROSTATE)', price: 1200 }, { category: 'Tumor Markers', name: 'B-HCG', price: 1200 }, { category: 'Tumor Markers', name: 'CA-125 (OVARY)', price: 1200 }, { category: 'Tumor Markers', name: 'CA-15-3 (BREAST)', price: 1200 }, { category: 'Tumor Markers', name: 'CA-19-9 (PANCREAS)', price: 1200 },
      { category: 'Bacteriology', name: 'All Culture & Sensitivy', price: 1500 }, { category: 'Bacteriology', name: 'Culture only', price: 850 }, { category: 'Bacteriology', name: 'Gram Stain', price: 250 }, { category: 'Bacteriology', name: 'AFB', price: 250 }, { category: 'Bacteriology', name: 'KOH', price: 250 }, { category: 'Bacteriology', name: 'India Ink', price: 350 }, { category: 'Bacteriology', name: 'ARD (ADULT/PEDIA) BLOOD only', price: 1200 },
      { category: 'Histopathology', name: 'Small', price: 1200 }, { category: 'Histopathology', name: 'Medium', price: 1800 }, { category: 'Histopathology', name: 'Large', price: 2500 }, { category: 'Histopathology', name: 'XL', price: 3500 }, { category: 'Histopathology', name: 'TAHBSO', price: 4500 }, { category: 'Histopathology', name: 'Cell Block', price: 1500 }, { category: 'Histopathology', name: 'FNAB', price: 2000 }, { category: 'Histopathology', name: 'PAPS SMEAR', price: 850 }, { category: 'Histopathology', name: 'Stone Analysis (urinary)', price: 850 }, { category: 'Histopathology', name: 'Semen Analysis', price: 550 },
      { category: 'Others', name: 'ECG', price: 450 }, { category: 'Others', name: 'ACCUPUNCTURE', price: 1500 },
    ];
    await prisma.serviceItem.createMany({ data: LAB_TESTS });
    console.log('✅ Procedures and Prices seeded successfully!');

    // =================================================================
    // 5. DUMMY PAYEES, DOCTORS, AND EMPLOYEES
    // =================================================================
    const hmo = await prisma.payee.create({ data: { name: 'Maxicare Healthcare', type: 'HMO', tin: '000-111-222-000' } });
    const vendor = await prisma.payee.create({ data: { name: 'MedSupplies Corp', type: 'SUPPLIER', tin: '999-888-777-000' } });
    const doctor = await prisma.payee.create({ data: { name: 'Dr. Jose Rizal', type: 'DOCTOR', tin: '123-456-789-000' } });
    const patient = await prisma.payee.create({ data: { name: 'Maria Clara', type: 'PATIENT' } });

    await prisma.employee.create({ data: { first_name: 'Ana', last_name: 'Nurse', position: 'Head Nurse', monthly_salary: 25000, is_active: true } });
    await prisma.employee.create({ data: { first_name: 'Pedro', last_name: 'Guard', position: 'Security Guard', monthly_salary: 15000, is_active: true } });
    console.log('✅ Payees and Employees seeded.');

    // =================================================================
    // 6. REALISTIC DUMMY TRANSACTIONS
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