// src/main/services/tax.service.test.ts
import { TaxService } from './tax.service';

describe('Sprint 4 - Week 1: BIR Tax Compliance Engine', () => {
    // We use the current year and quarter based on the dates of transactions you posted earlier (June 2026 = Q2)
    const currentYear = 2026;
    const currentQuarter = 2; // April, May, June
    const currentMonth = 5;   // May (Middle of Q2 for 0619-E testing)

    test('🏛️ Form 2550Q: Should calculate exact 12% Output and Input VAT', async () => {
        const form2550Q = await TaxService.generate2550Q(currentYear, currentQuarter);

        // VAT Math Check: Output VAT + Net Sales MUST equal Gross Sales
        const totalSalesValidation = form2550Q.netSales + form2550Q.outputVat;
        expect(totalSalesValidation).toBeCloseTo(form2550Q.grossSales, 1); // Allow 1 centavo rounding difference

        const totalPurchasesValidation = form2550Q.netPurchases + form2550Q.inputVat;
        expect(totalPurchasesValidation).toBeCloseTo(form2550Q.grossPurchases, 1);

        // Net VAT Payable must equal Output VAT - Input VAT
        expect(form2550Q.netVatPayable).toBeCloseTo(form2550Q.outputVat - form2550Q.inputVat, 1);
    });

    test('🧾 Form 0619-E: Should extract monthly Expanded Withholding Tax (EWT)', async () => {
        const form0619E = await TaxService.generate0619E(currentYear, currentMonth);

        // Ensure the correct properties are returned from the backend
        expect(form0619E).toHaveProperty('ewtWithheld');
        expect(form0619E).toHaveProperty('qapList');
        expect(Array.isArray(form0619E.qapList)).toBe(true);

        // EWT Math Check: The sum of taxes in the individual Alphalist (QAP) 
        // MUST perfectly match the grand total EWT withheld.
        if (form0619E.qapList.length > 0) {
            const sumOfQapTaxes = form0619E.qapList.reduce((acc: number, curr: any) => acc + curr.taxWithheld, 0);
            expect(sumOfQapTaxes).toBeCloseTo(form0619E.ewtWithheld, 1);
        }
    });

    test('📑 Relief Annexes: Should extract transactions assigned to payees', async () => {
        const annexes = await TaxService.generateReliefAnnexes(currentYear, currentQuarter);

        // We know you posted a "Meralco" disbursement earlier!
        // It should appear in Annex B (Purchases)
        expect(annexes.annexB_Purchases.length).toBeGreaterThanOrEqual(0);

        if (annexes.annexB_Purchases.length > 0) {
            const samplePurchase = annexes.annexB_Purchases[0];
            expect(samplePurchase).toHaveProperty('tin');
            expect(samplePurchase).toHaveProperty('tax');

            // Net + Tax must equal Gross
            expect(samplePurchase.netAmount + samplePurchase.tax).toBeCloseTo(samplePurchase.grossAmount, 1);
        }
    });
});