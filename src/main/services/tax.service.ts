import { PrismaClient } from '@prisma/client'
import { ReliefGeneratorEngine, ReliefCompileOptions } from '../../shared/relief-engine'

const prisma = new PrismaClient()

export class TaxService {
  // 1. VAT REPORT (Form 2550Q)
  static async generate2550Q(year: number, quarter: number) {
    try {
      const startMonth = (quarter - 1) * 3
      const startDate = new Date(year, startMonth, 1)
      const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)

      const outputVatLines = await prisma.journalLine.findMany({
        where: {
          account_id: '2020',
          credit: { gt: 0 },
          entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' }
        }
      })
      const outputVat = outputVatLines.reduce((sum, line) => sum + Number(line.credit), 0)

      let vatableSales = 0
      let exemptSales = 0
      const salesEntries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          status: 'ACTIVE',
          lines: { some: { account_id: { in: ['4010', '4020', '4040'] } } }
        },
        include: { lines: true }
      })

      salesEntries.forEach((entry) => {
        const isVatable = entry.lines.some((l) => l.account_id === '2020')
        const revenueLines = entry.lines.filter((l) =>
          ['4010', '4020', '4040'].includes(l.account_id)
        )
        const revenueAmount = revenueLines.reduce((sum, l) => sum + Number(l.credit), 0)

        if (isVatable) vatableSales += revenueAmount
        else exemptSales += revenueAmount
      })

      const netSales = vatableSales + exemptSales
      const grossSales = netSales + outputVat

      const inputVatLines = await prisma.journalLine.findMany({
        where: {
          account_id: '1300',
          debit: { gt: 0 },
          entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' }
        }
      })
      const inputVat = inputVatLines.reduce((sum, line) => sum + Number(line.debit), 0)

      const purchaseEntries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          status: 'ACTIVE',
          lines: { some: { account_id: '1300' } }
        },
        include: { lines: true }
      })

      let vatablePurchases = 0
      purchaseEntries.forEach((entry) => {
        const expenseLines = entry.lines.filter(
          (l) =>
            l.account_id !== '1300' &&
            l.account_id !== '1010' &&
            l.account_id !== '1020' &&
            l.account_id !== '1030' &&
            l.account_id !== '2010' &&
            Number(l.debit) > 0
        )
        vatablePurchases += expenseLines.reduce((sum, l) => sum + Number(l.debit), 0)
      })

      const netPurchases = vatablePurchases
      const grossPurchases = netPurchases + inputVat

      const cwtLines = await prisma.journalLine.findMany({
        where: {
          account_id: '1310',
          debit: { gt: 0 },
          entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' }
        }
      })
      const creditableVatWithheld = cwtLines.reduce((sum, line) => sum + Number(line.debit), 0)
      const netVatPayable = outputVat - inputVat - creditableVatWithheld

      return {
        grossSales,
        netSales,
        vatableSales,
        exemptSales,
        outputVat,
        grossPurchases,
        netPurchases,
        vatablePurchases,
        inputVat,
        creditableVatWithheld,
        netVatPayable
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  // 2. RELIEF / DAT FILE GENERATOR (Annex A: Sales & Annex B: Purchases)
  static async generateReliefAnnexes(year: number, quarter: number) {
    try {
      const startMonth = (quarter - 1) * 3
      const startDate = new Date(year, startMonth, 1)
      const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)

      // Taxpayer / Clinic Profile Header
      const header = {
        tin: '000-000-000-000',
        branchCode: '0000',
        registeredName: 'SMARTGUYS COMMUNITY HEALTHCARE INC.',
        tradeName: 'SMARTGUYS CLINIC',
        address: 'Katapatan Mutual Homes, Brgy. Banay-banay, City of Cabuyao, Laguna 4025',
        year: year,
        quarter: quarter,
        periodMonth: String(startMonth + 3).padStart(2, '0') // Closing month of the quarter (e.g. 03, 06, 09, 12)
      }

      // --- ANNEX A: SALES (SLSS) ---
      const salesEntries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          status: 'ACTIVE',
          lines: { some: { account_id: { in: ['4010', '4020', '4040'] } } }
        },
        include: { lines: true, payee: true }
      })

      const annexA_Sales: any[] = []
      salesEntries.forEach((entry) => {
        const vatLine = entry.lines.find((l) => l.account_id === '2020') // Output VAT (2020)
        const outputTax = vatLine ? Number(vatLine.credit) : 0
        const revenueLines = entry.lines.filter((l) =>
          ['4010', '4020', '4040'].includes(l.account_id)
        )
        const netAmount = revenueLines.reduce((sum, l) => sum + Number(l.credit), 0)
        if (netAmount === 0 && outputTax === 0) return

        // If transaction has Output VAT or VAT is applicable, classify accordingly
        const vatableSales = outputTax > 0 ? netAmount : 0
        const exemptSales = outputTax === 0 ? netAmount : 0
        const zeroRatedSales = 0
        const grossAmount = netAmount + outputTax

        annexA_Sales.push({
          date: entry.date,
          customerName: entry.payee?.name || 'Walk-in Patient',
          tin: entry.payee?.tin || '000-000-000-000',
          branchCode: '0000',
          address: entry.payee?.address || 'Cabuyao, Laguna',
          grossAmount: grossAmount,
          exemptSales: exemptSales,
          zeroRatedSales: zeroRatedSales,
          taxableSales: vatableSales,
          outputTax: outputTax
        })
      })

      // --- ANNEX B: PURCHASES (SLSP) ---
      const purchaseEntries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          status: 'ACTIVE',
          lines: { some: { account_id: '1300' } }
        },
        include: { lines: true, payee: true }
      })

      const annexB_Purchases: any[] = []
      purchaseEntries.forEach((entry) => {
        const inputVatLine = entry.lines.find((l) => l.account_id === '1300')
        if (!inputVatLine) return
        const tax = Number(inputVatLine.debit)
        const expenseLines = entry.lines.filter(
          (l) => l.account_id !== '1300' && Number(l.debit) > 0
        )
        const netAmount = expenseLines.reduce((sum, l) => sum + Number(l.debit), 0)
        if (netAmount === 0 && tax === 0) return

        annexB_Purchases.push({
          date: entry.date,
          supplierName: entry.payee?.name || 'Unknown Supplier',
          tin: entry.payee?.tin || '000-000-000-000',
          branchCode: '0000',
          address: entry.payee?.address || 'Metro Manila / Laguna',
          exemptPurchases: 0,
          zeroRatedPurchases: 0,
          servicesPurchases: netAmount,
          capitalPurchases: 0,
          goodsPurchases: 0,
          netAmount: netAmount,
          tax: tax,
          grossAmount: netAmount + tax
        })
      })

      // Control Totals for Validation
      const salesTotals = {
        recordsCount: annexA_Sales.length,
        totalGross: annexA_Sales.reduce((s, r) => s + r.grossAmount, 0),
        totalExempt: annexA_Sales.reduce((s, r) => s + r.exemptSales, 0),
        totalZeroRated: annexA_Sales.reduce((s, r) => s + r.zeroRatedSales, 0),
        totalTaxable: annexA_Sales.reduce((s, r) => s + r.taxableSales, 0),
        totalOutputTax: annexA_Sales.reduce((s, r) => s + r.outputTax, 0)
      }

      const purchasesTotals = {
        recordsCount: annexB_Purchases.length,
        totalGross: annexB_Purchases.reduce((s, r) => s + r.grossAmount, 0),
        totalExempt: annexB_Purchases.reduce((s, r) => s + r.exemptPurchases, 0),
        totalZeroRated: annexB_Purchases.reduce((s, r) => s + r.zeroRatedPurchases, 0),
        totalServices: annexB_Purchases.reduce((s, r) => s + r.servicesPurchases, 0),
        totalCapital: annexB_Purchases.reduce((s, r) => s + r.capitalPurchases, 0),
        totalGoods: annexB_Purchases.reduce((s, r) => s + r.goodsPurchases, 0),
        totalInputTax: annexB_Purchases.reduce((s, r) => s + r.tax, 0)
      }

      // Compile compliant BIR RELIEF .DAT files (v2.3)
      const periodMM = header.periodMonth || (quarter === 0 ? '12' : String(quarter * 3).padStart(2, '0'))
      const taxableMonth = `${periodMM}/${year}`
      const ownerProfile = {
        tin: header.tin,
        branchCode: header.branchCode,
        registeredName: header.registeredName,
        streetAddress: 'Katapatan Mutual Homes',
        districtAddress: 'Cabuyao Laguna 4025',
        rdoCode: '057',
        fiscalYearEndMonth: '12'
      }

      const salesCompile = ReliefGeneratorEngine.compile({
        type: 'S',
        taxableMonth,
        owner: ownerProfile,
        records: annexA_Sales.map((s) => ({
          date: s.date,
          tin: s.tin,
          branchCode: s.branchCode,
          customerName: s.customerName,
          address: s.address,
          grossAmount: s.grossAmount,
          exemptAmount: s.exemptSales,
          zeroRatedAmount: s.zeroRatedSales,
          taxableAmount: s.taxableSales,
          taxAmount: s.outputTax,
          isWalkIn:
            !s.tin ||
            s.tin === '000-000-000-000' ||
            (s.customerName || '').toLowerCase().includes('walk-in')
        }))
      })

      const purchasesCompile = ReliefGeneratorEngine.compile({
        type: 'P',
        taxableMonth,
        owner: ownerProfile,
        records: annexB_Purchases.map((p) => ({
          date: p.date,
          tin: p.tin,
          branchCode: p.branchCode,
          supplierName: p.supplierName,
          address: p.address,
          grossAmount: p.grossAmount,
          exemptAmount: p.exemptPurchases,
          zeroRatedAmount: p.zeroRatedPurchases,
          taxableAmount: p.servicesPurchases || p.netAmount,
          taxAmount: p.tax
        }))
      })

      return {
        header,
        annexA_Sales,
        annexB_Purchases,
        salesTotals,
        purchasesTotals,
        salesDatFile: salesCompile.fileContent,
        salesFileName: salesCompile.fileName,
        purchasesDatFile: purchasesCompile.fileContent,
        purchasesFileName: purchasesCompile.fileName
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  // Compile BIR RELIEF DAT from raw payload
  static compileReliefDat(options: ReliefCompileOptions) {
    return ReliefGeneratorEngine.compile(options)
  }

  // Helper to resolve ATC code based on payee and entry details
  private static resolveEwtAtc(entry: any): string {
    const desc = (entry.description || '').toLowerCase()
    const payeeType = entry.payee?.type || ''
    if (payeeType === 'LANDLORD' || desc.includes('rent') || desc.includes('wi100')) {
      return 'WI100' // Real property rentals
    }
    return 'WI010' // Professional fees (medical/dental practitioners)
  }

  // 3. MONTHLY EXPANDED WITHHOLDING TAX (Form 0619-E)
  static async generate0619E(year: number, month: number) {
    try {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59, 999)

      const ewtLines = await prisma.journalLine.findMany({
        where: {
          account_id: '2050',
          credit: { gt: 0 },
          entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' }
        },
        include: { entry: { include: { payee: true, lines: true } } }
      })

      let ewtWithheld = 0
      const qapList: any[] = []
      for (const line of ewtLines) {
        ewtWithheld += Number(line.credit)
        const expenseLine = line.entry.lines.find((l) => Number(l.debit) > 0)
        qapList.push({
          date: line.entry.date,
          payeeName: line.entry.payee?.name || 'Unknown',
          tin: line.entry.payee?.tin || '000-000-000-000',
          atc: TaxService.resolveEwtAtc(line.entry),
          grossAmount: expenseLine ? Number(expenseLine.debit) : 0,
          taxWithheld: Number(line.credit)
        })
      }
      return { ewtWithheld, qapList }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  // 4. QUARTERLY EXPANDED WITHHOLDING TAX (Form 1601-EQ / 1604-E)
  static async generate1601EQ(year: number, quarter: number) {
    try {
      let startDate, endDate
      if (quarter === 0) {
        // Annual Form 1604-E
        startDate = new Date(year, 0, 1)
        endDate = new Date(year, 11, 31, 23, 59, 59, 999)
      } else {
        const startMonth = (quarter - 1) * 3
        startDate = new Date(year, startMonth, 1)
        endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)
      }

      const ewtLines = await prisma.journalLine.findMany({
        where: {
          account_id: '2050',
          credit: { gt: 0 },
          entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' }
        },
        include: { entry: { include: { payee: true, lines: true } } }
      })

      let ewtWithheld = 0
      const qapList: any[] = []
      for (const line of ewtLines) {
        ewtWithheld += Number(line.credit)
        const expenseLine = line.entry.lines.find((l) => Number(l.debit) > 0)
        qapList.push({
          date: line.entry.date,
          payeeName: line.entry.payee?.name || 'Unknown',
          tin: line.entry.payee?.tin || '000-000-000-000',
          atc: TaxService.resolveEwtAtc(line.entry),
          grossAmount: expenseLine ? Number(expenseLine.debit) : 0,
          taxWithheld: Number(line.credit)
        })
      }
      return { ewtWithheld, qapList }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  // 5. MONTHLY WITHHOLDING TAX ON COMPENSATION (Form 1601-C)
  static async generate1601C(year: number, month: number) {
    try {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59, 999)

      // Query payslips for this month
      const payslips = await prisma.payslip.findMany({
        where: {
          date: { gte: startDate, lte: endDate }
        },
        include: {
          employee: true
        }
      })

      let totalGrossCompensation = 0
      let totalNonTaxableCompensation = 0
      let totalTaxableCompensation = 0
      let totalTaxRequiredWithheld = 0

      const employeeBreakdown: any[] = []

      for (const p of payslips) {
        const gross = Number(p.gross_pay || 0)
        const sssEe = Number(p.sss || 0)
        const phEe = Number(p.philhealth || 0)
        const hdmfEe = Number(p.pagibig || 0)
        const statutoryNonTaxable = sssEe + phEe + hdmfEe
        const taxWithheld = Number(p.tax_withheld || 0)

        // Taxable compensation is gross less mandatory statutory contributions
        const taxable = Math.max(0, gross - statutoryNonTaxable)

        totalGrossCompensation += gross
        totalNonTaxableCompensation += statutoryNonTaxable
        totalTaxableCompensation += taxable
        totalTaxRequiredWithheld += taxWithheld

        employeeBreakdown.push({
          employeeId: p.employee_id,
          employeeName: `${p.employee.first_name} ${p.employee.last_name}`,
          tin: p.employee.tin || '000-000-000-000',
          grossCompensation: gross,
          nonTaxableContributions: statutoryNonTaxable,
          taxableCompensation: taxable,
          taxWithheld: taxWithheld,
          date: p.date
        })
      }

      // Also cross-reference Account 2051 credits from General Ledger
      const glTaxLines = await prisma.journalLine.findMany({
        where: {
          account_id: '2051',
          credit: { gt: 0 },
          entry: { date: { gte: startDate, lte: endDate }, status: 'ACTIVE' }
        }
      })
      const glTotalTaxWithheld = glTaxLines.reduce((sum, l) => sum + Number(l.credit), 0)

      return {
        year,
        month,
        totalGrossCompensation,
        totalNonTaxableCompensation,
        totalTaxableCompensation,
        totalTaxRequiredWithheld,
        glTotalTaxWithheld,
        employeeCount: employeeBreakdown.length,
        employees: employeeBreakdown
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
}
