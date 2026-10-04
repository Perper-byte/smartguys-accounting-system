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

      const entries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          status: { not: 'VOID' }
        },
        include: {
          lines: { include: { account: { include: { account_type: true } } } }
        }
      })

      let sales = 0, payments = 0, disbursements = 0

      for (const entry of entries) {
        for (const line of entry.lines) {
          const typeName = (line.account?.account_type?.name || '').toLowerCase()
          const debit = Number(line.debit) || 0
          const credit = Number(line.credit) || 0

          if (typeName.includes('revenue') || typeName.includes('income') || typeName.includes('sales')) {
            sales += credit - debit
          }

          if (typeName.includes('asset')) {
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
        const isOutflow = entry.lines.some((l) => {
          const t = (l.account.account_type?.name || '').toLowerCase()
          return (t.includes('asset') && Number(l.credit) > 0) || 
                 (t.includes('expense') && Number(l.debit) > 0)
        })
        const direction = isOutflow ? 'OUT' : 'IN'

        let type = entry.description || 'Clinic Service'
        const primaryLine = entry.lines.find((l) => {
          const t = (l.account.account_type?.name || '').toLowerCase()
          return isOutflow ? (t.includes('expense') || t.includes('liability')) : (t.includes('revenue') || t.includes('income'))
        })
        
        if (primaryLine) type = primaryLine.account.name

        const amount = Math.max(...entry.lines.map((l) => Number(l.debit)), 0)

        return {
          id: entry.id,
          createdAt: entry.created_at || entry.date,
          patientName: entry.payee?.name || (isOutflow ? 'Vendor / Staff' : 'Walk-in Patient'),
          type,
          paymentMethod: 'GENERAL',
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
      const periodsData: { start: Date; end: Date; label: string }[] = []
      
      let periods = 6
      if (timeframe === 'daily') periods = 7
      if (timeframe === 'weekly') periods = 4
      if (timeframe === 'quarterly') periods = 4
      if (timeframe === 'yearly') periods = 5

      // 1. Generate chronological period boundaries (Oldest to Newest)
      for (let i = periods - 1; i >= 0; i--) {
        let startOfPeriod: Date, endOfPeriod: Date, label: string

        if (timeframe === 'daily') {
          startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0)
          endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999)
          label = startOfPeriod.toLocaleString('default', { weekday: 'short', day: 'numeric' })
        } else if (timeframe === 'weekly') {
          startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7 - 6, 0, 0, 0)
          endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7, 23, 59, 59, 999)
          label = `${startOfPeriod.getMonth() + 1}/${startOfPeriod.getDate()} - ${endOfPeriod.getMonth() + 1}/${endOfPeriod.getDate()}`
        } else if (timeframe === 'quarterly') {
          const currentQ = Math.floor(now.getMonth() / 3)
          const targetQ = currentQ - i
          const yearAdjust = Math.floor(targetQ / 4)
          const normalizedQ = ((targetQ % 4) + 4) % 4
          const targetYear = now.getFullYear() + yearAdjust
          startOfPeriod = new Date(targetYear, normalizedQ * 3, 1, 0, 0, 0)
          endOfPeriod = new Date(targetYear, normalizedQ * 3 + 3, 0, 23, 59, 59, 999)
          label = `Q${normalizedQ + 1} ${targetYear}`
        } else if (timeframe === 'yearly') {
          startOfPeriod = new Date(now.getFullYear() - i, 0, 1, 0, 0, 0)
          endOfPeriod = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999)
          label = `${now.getFullYear() - i}`
        } else {
          // Monthly
          startOfPeriod = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0)
          endOfPeriod = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
          label = startOfPeriod.toLocaleString('default', { month: 'short', year: '2-digit' })
        }
        periodsData.push({ start: startOfPeriod, end: endOfPeriod, label })
      }

      const overallStart = periodsData[0].start
      const currentEnd = periodsData[periodsData.length - 1].end

      // 2. Fetch ALL relevant data for the chart in one single fast query
      const allEntries = await prisma.journalEntry.findMany({
        where: {
          date: { gte: overallStart, lte: currentEnd },
          status: 'ACTIVE'
        },
        include: {
          payee: true,
          lines: { include: { account: { include: { account_type: true } } } }
        },
        orderBy: { date: 'desc' }
      })

      // 3. Setup data structures
      const trendLabels = periodsData.map(p => p.label)
      const trendRevenue = periodsData.map(() => 0)
      const trendExpenses = periodsData.map(() => 0)
      
      // THESE WILL NOW TOTAL THE ENTIRE CHART
      let totalRevenue = 0
      let totalExpenses = 0
      const expenseBreakdownMap: Record<string, number> = {}

      // 4. Process all transactions in memory
      for (const entry of allEntries) {
        const entryTime = entry.date.getTime()
        const periodIndex = periodsData.findIndex(p => entryTime >= p.start.getTime() && entryTime <= p.end.getTime())
        if (periodIndex === -1) continue

        for (const line of entry.lines) {
          const typeName = (line.account.account_type?.name || '').toLowerCase()
          const debit = Number(line.debit) || 0
          const credit = Number(line.credit) || 0

          // Calculate Revenue
          if (typeName.includes('revenue') || typeName.includes('income') || typeName.includes('sales')) {
            const amount = credit - debit
            trendRevenue[periodIndex] += amount
            totalRevenue += amount // Add to overall KPI total
          }
          
          // Calculate Expenses
          if (typeName.includes('expense') || typeName.includes('cost')) {
            const amount = debit - credit
            trendExpenses[periodIndex] += amount
            totalExpenses += amount // Add to overall KPI total
            
            if (amount > 0) {
              expenseBreakdownMap[line.account.name] = (expenseBreakdownMap[line.account.name] || 0) + amount
            }
          }
        }
      }

      // 5. Calculate ALL-TIME Net Cash Balance for the "Till" card
      const allAccounts = await prisma.account.findMany({ include: { account_type: true } })
      const validCashAccountIds = allAccounts
        .filter(a => {
           const tName = (a.account_type?.name || '').toLowerCase()
           const aName = (a.name || '').toLowerCase()
           return tName.includes('asset') && (aName.includes('cash') || aName.includes('bank') || aName.includes('till'))
        })
        .map(a => a.code)

      let allTimeNetCash = 0
      if (validCashAccountIds.length > 0) {
        const cashLines = await prisma.journalLine.groupBy({
          by: ['account_id'],
          where: { account_id: { in: validCashAccountIds }, entry: { status: 'ACTIVE' } },
          _sum: { debit: true, credit: true }
        })
        for (const group of cashLines) {
          allTimeNetCash += (Number(group._sum.debit) - Number(group._sum.credit))
        }
      }

      // Format Expense Breakdown for ECharts
      const expenseBreakdown = Object.entries(expenseBreakdownMap)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value)

      const netProfit = totalRevenue - totalExpenses

      // 6. Generate Accurate AI Narrative based on the SUMMED period
      let narrative = `For the selected ${timeframe} timeframe, the clinic has generated ₱${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} in revenue against ₱${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} in operating expenses. `

      if (netProfit > 0) {
        narrative += `This resulted in a net profit of ₱${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}, indicating healthy operational efficiency for the selected period.`
      } else if (netProfit < 0) {
        narrative += `This resulted in a net loss of ₱${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}. Management should review expenditures against expected cash inflows.`
      } else {
        narrative += `The clinic is currently breaking even.`
      }

      // 7. Format Recent Transactions specifically for UI
      const recentTransactions = allEntries.slice(0, 8).map((entry) => {
        const primaryLine = entry.lines.find((l) => {
            const t = (l.account.account_type?.name || '').toLowerCase()
            return t.includes('revenue') || t.includes('income') || t.includes('expense')
        }) || entry.lines[0]

        const isOutflow = entry.lines.some((l) => {
            const t = (l.account.account_type?.name || '').toLowerCase()
            return (t.includes('asset') && Number(l.credit) > 0) ||
                   (t.includes('expense') && Number(l.debit) > 0) ||
                   (t.includes('liability') && Number(l.debit) > 0)
        })

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
          revenue: totalRevenue,
          expenses: totalExpenses,
          netCash: allTimeNetCash,
          netProfit 
        },
        trendData: {
          labels: trendLabels,
          revenue: trendRevenue.map(v => Number(v.toFixed(2))),
          expenses: trendExpenses.map(v => Number(v.toFixed(2)))
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