// src/main/services/analytics.service.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class AnalyticsService {
  /**
   * Calculates Today's Sales, Payments Received, Disbursements, and Transaction Count
   */
  static async getTodayStats() {
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

      // Fetch all non-void transactions for today
      const entries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          status: { not: 'VOID' }
        },
        include: {
          lines: {
            include: {
              account: {
                include: {
                  account_type: true
                }
              }
            }
          }
        }
      })

      let sales = 0
      let payments = 0
      let disbursements = 0

      for (const entry of entries) {
        for (const line of entry.lines) {
          const typeName = (line.account?.account_type?.name || '').toLowerCase()
          const typeId = (line.account?.type_id || '').toLowerCase()
          const debit = Number(line.debit) || 0
          const credit = Number(line.credit) || 0

          if (typeName.includes('revenue') || typeId.includes('revenue')) {
            sales += credit - debit
          }

          if (typeName.includes('asset') || typeId.includes('asset')) {
            if (debit > 0) payments += debit
            if (credit > 0) disbursements += credit
          }
        }
      }

      return {
        sales: Number(Math.max(0, sales).toFixed(2)),
        payments: Number(payments.toFixed(2)),
        disbursements: Number(disbursements.toFixed(2)),
        transactions: entries.length
      }
    } catch (error) {
      console.error("Error fetching today's stats:", error)
      return { sales: 0, payments: 0, disbursements: 0, transactions: 0 }
    }
  }

  /**
   * Retrieves Today's Transactions for the Cashier dashboard table
   */
  static async getRecentTransactions() {
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

      const entries = await prisma.journalEntry.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { created_at: 'desc' },
        take: 10,
        include: {
          payee: true,
          lines: { include: { account: { include: { account_type: true } } } }
        }
      })

      return entries.map((entry) => {
        const isOutflow = entry.lines.some(
          (l) => l.account.account_type.name === 'Asset' && Number(l.credit) > 0
        )
        const direction = isOutflow ? 'OUT' : 'IN'

        let type = entry.description || 'Clinic Service'
        if (!isOutflow) {
          const revenueLine = entry.lines.find((l) => l.account.account_type.name === 'Revenue')
          if (revenueLine) type = revenueLine.account.name
        } else {
          const expenseLine = entry.lines.find(
            (l) =>
              l.account.account_type.name === 'Expense' ||
              l.account.account_type.name === 'Liability'
          )
          if (expenseLine) type = expenseLine.account.name
        }

        const amount = Math.max(...entry.lines.map((l) => Number(l.debit)), 0)

        const paymentLine = entry.lines.find(
          (l) =>
            l.account.account_type.name === 'Asset' &&
            (isOutflow ? Number(l.credit) > 0 : Number(l.debit) > 0)
        )
        let paymentMethod = 'CASH'
        if (paymentLine) {
          const accName = paymentLine.account.name.toUpperCase()
          if (accName.includes('GCASH') || accName.includes('G-CASH')) paymentMethod = 'GCASH'
          else if (accName.includes('MAYA') || accName.includes('PAYMAYA'))
            paymentMethod = 'PAYMAYA'
          else if (accName.includes('BANK') || accName.includes('BDO') || accName.includes('BPI'))
            paymentMethod = 'BANK TRANSFER'
          else if (accName.includes('CARD') || accName.includes('CREDIT')) paymentMethod = 'CARD'
          else paymentMethod = paymentLine.account.name
        }

        return {
          id: entry.id,
          createdAt: entry.created_at || entry.date,
          patientName: entry.payee?.name || (isOutflow ? 'Vendor / Staff' : 'Walk-in Patient'),
          type,
          paymentMethod,
          amount: Number(amount.toFixed(2)),
          direction,
          status: entry.status === 'ACTIVE' ? (isOutflow ? 'COMPLETED' : 'PAID') : entry.status
        }
      })
    } catch (error) {
      console.error('Error fetching recent transactions:', error)
      return []
    }
  }

  /**
   * Analytics Dashboard calculation
   */
  static async getDashboardMetrics(
    timeframe: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly'
  ) {
    try {
      const now = new Date()

      const trendLabels: string[] = []
      const trendRevenue: number[] = []
      const trendExpenses: number[] = []

      let currentPeriodRevenue = 0
      let currentPeriodExpenses = 0

      let periods = 6
      if (timeframe === 'daily') periods = 7
      if (timeframe === 'weekly') periods = 4
      if (timeframe === 'quarterly') periods = 4
      if (timeframe === 'yearly') periods = 5

      let overallStartOfTrend: Date | null = null

      for (let i = periods - 1; i >= 0; i--) {
        let startOfPeriod: Date, endOfPeriod: Date, label: string

        if (timeframe === 'daily') {
          startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
          endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59)
          label = startOfPeriod.toLocaleString('default', { weekday: 'short', day: 'numeric' })
        } else if (timeframe === 'weekly') {
          startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7 - 6)
          endOfPeriod = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - i * 7,
            23,
            59,
            59
          )
          label = `${startOfPeriod.getMonth() + 1}/${startOfPeriod.getDate()} - ${endOfPeriod.getMonth() + 1}/${endOfPeriod.getDate()}`
        } else if (timeframe === 'quarterly') {
          const currentQ = Math.floor(now.getMonth() / 3)
          const targetQ = currentQ - i
          const yearAdjust = Math.floor(targetQ / 4)
          const normalizedQ = ((targetQ % 4) + 4) % 4
          const targetYear = now.getFullYear() + yearAdjust
          startOfPeriod = new Date(targetYear, normalizedQ * 3, 1)
          endOfPeriod = new Date(targetYear, normalizedQ * 3 + 3, 0, 23, 59, 59)
          label = `Q${normalizedQ + 1} ${targetYear}`
        } else if (timeframe === 'yearly') {
          startOfPeriod = new Date(now.getFullYear() - i, 0, 1)
          endOfPeriod = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59)
          label = `${now.getFullYear() - i}`
        } else {
          startOfPeriod = new Date(now.getFullYear(), now.getMonth() - i, 1)
          endOfPeriod = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
          label = startOfPeriod.toLocaleString('default', { month: 'short', year: '2-digit' })
        }

        if (i === periods - 1) overallStartOfTrend = startOfPeriod

        trendLabels.push(label)

        const revLines = await prisma.journalLine.findMany({
          where: {
            account: { account_type: { name: 'Revenue' } },
            entry: { date: { gte: startOfPeriod, lte: endOfPeriod }, status: 'ACTIVE' }
          }
        })
        const intervalRev = revLines.reduce(
          (sum, ln) => sum + Number(ln.credit) - Number(ln.debit),
          0
        )
        trendRevenue.push(Number(intervalRev.toFixed(2)))

        const expLines = await prisma.journalLine.findMany({
          where: {
            account: { account_type: { name: 'Expense' } },
            entry: { date: { gte: startOfPeriod, lte: endOfPeriod }, status: 'ACTIVE' }
          }
        })
        const intervalExp = expLines.reduce(
          (sum, ln) => sum + Number(ln.debit) - Number(ln.credit),
          0
        )
        trendExpenses.push(Number(intervalExp.toFixed(2)))

        if (i === 0) {
          currentPeriodRevenue = intervalRev
          currentPeriodExpenses = intervalExp
        }
      }

      const expenseAccounts = await prisma.account.findMany({
        where: { account_type: { name: 'Expense' } }
      })
      const expenseBreakdown: { name: string; value: number }[] = []

      for (const acc of expenseAccounts) {
        const lines = await prisma.journalLine.findMany({
          where: {
            account_id: acc.code,
            entry: { date: { gte: overallStartOfTrend || new Date(0) }, status: 'ACTIVE' }
          }
        })
        const netBalance = lines.reduce((sum, ln) => sum + Number(ln.debit) - Number(ln.credit), 0)
        if (netBalance > 0) {
          expenseBreakdown.push({ name: acc.name, value: Number(netBalance.toFixed(2)) })
        }
      }

      expenseBreakdown.sort((a, b) => b.value - a.value)

      const cashLines = await prisma.journalLine.findMany({
        where: { account_id: { in: ['1010', '1020'] }, entry: { status: 'ACTIVE' } }
      })
      const netCash = cashLines.reduce((sum, ln) => sum + Number(ln.debit) - Number(ln.credit), 0)

      // Fix: Use Net Profit logic instead of misleading margins
      const netProfit = currentPeriodRevenue - currentPeriodExpenses

      let narrative = `For the current ${timeframe} reporting period, the clinic has generated ₱${currentPeriodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} in revenue against ₱${currentPeriodExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} in operating expenses. `

      if (netProfit > 0) {
        narrative += `This resulted in a net profit of ₱${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}, indicating healthy operational efficiency for the period.`
      } else if (netProfit < 0) {
        narrative += `This resulted in a net loss of ₱${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}. Management should review recent expenditures against expected cash inflows.`
      } else {
        narrative += `The clinic is currently breaking even exactly.`
      }

      const recentEntries = await prisma.journalEntry.findMany({
        orderBy: { date: 'desc' },
        take: 8, // Extended to 8 items to fill space better
        include: {
          payee: true,
          lines: { include: { account: { include: { account_type: true } } } }
        }
      })

      const recentTransactions = recentEntries.map((entry) => {
        const primaryLine =
          entry.lines.find(
            (l) =>
              l.account.account_type.name === 'Revenue' || l.account.account_type.name === 'Expense'
          ) || entry.lines[0]

        // Determine outflow logic to color red vs green
        const isOutflow = entry.lines.some((l) =>
          (l.account.account_type.name === 'Asset' && Number(l.credit) > 0) ||
          (l.account.account_type.name === 'Expense' && Number(l.debit) > 0) ||
          (l.account.account_type.name === 'Liability' && Number(l.debit) > 0)
        );

        const amount = Math.max(...entry.lines.map((l) => Number(l.debit)))

        return {
          id: entry.id,
          date: entry.date,
          category: primaryLine ? primaryLine.account.name : 'General Transfer',
          payee: entry.payee?.name || 'Walk-in / General',
          amount: Number(amount.toFixed(2)),
          isOutflow
        }
      })

      return {
        kpi: {
          revenue: currentPeriodRevenue,
          expenses: currentPeriodExpenses,
          netCash,
          netProfit // Replaced margin
        },
        trendData: {
          labels: trendLabels,
          revenue: trendRevenue,
          expenses: trendExpenses
        },
        expenseBreakdown,
        narrative,
        recentTransactions
      }
    } catch (error) {
      console.error('Analytics Error:', error)
      return { error: 'Failed to compute analytics.' }
    }
  }
}