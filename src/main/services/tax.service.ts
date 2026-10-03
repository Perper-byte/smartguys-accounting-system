// src/main/services/tax.service.ts
import { PrismaClient } from '@prisma/client'

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

  // 2. RELIEF / DAT FILE GENERATOR (Annex B)
  static async generateReliefAnnexes(year: number, quarter: number) {
    try {
      const startMonth = (quarter - 1) * 3
      const startDate = new Date(year, startMonth, 1)
      const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)

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

        annexB_Purchases.push({
          date: entry.date,
          supplierName: entry.payee?.name || 'Unknown Supplier',
          tin: entry.payee?.tin || '000-000-000-000',
          netAmount: netAmount,
          tax: tax,
          grossAmount: netAmount + tax
        })
      })
      return { annexB_Purchases }
    } catch (error: any) {
      return { error: error.message }
    }
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
