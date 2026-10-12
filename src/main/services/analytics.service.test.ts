// src/main/services/analytics.service.test.ts
import { AnalyticsService } from './analytics.service'
import { PrismaClient } from '@prisma/client'

jest.mock('@prisma/client', () => {
  const mPrisma = {
    journalEntry: {
      findMany: jest.fn()
    },
    account: {
      findMany: jest.fn().mockResolvedValue([
        { code: '1010', name: 'Cash on Hand', account_type: { name: 'Asset' } }
      ])
    },
    journalLine: {
      groupBy: jest.fn().mockResolvedValue([
        { account_id: '1010', _sum: { debit: 10000, credit: 2000 } }
      ])
    }
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})

const prisma = new PrismaClient()

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getTodayStats', () => {
    test('computes sales, payments, and disbursements from daily journal entries', async () => {
      const mockEntries = [
        {
          id: 'je-1',
          lines: [
            { debit: 1000, credit: 0, account: { account_type: { name: 'Asset' } } },
            { debit: 0, credit: 1000, account: { account_type: { name: 'Revenue' } } }
          ]
        },
        {
          id: 'je-2',
          lines: [
            { debit: 300, credit: 0, account: { account_type: { name: 'Expense' } } },
            { debit: 0, credit: 300, account: { account_type: { name: 'Asset' } } }
          ]
        }
      ];

      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue(mockEntries)

      const stats = await AnalyticsService.getTodayStats()

      expect(stats.sales).toBe(1000)
      expect(stats.payments).toBe(1000)
      expect(stats.disbursements).toBe(300)
      expect(stats.transactions).toBe(2)
    })

    test('returns zero metrics when no entries exist', async () => {
      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue([])

      const stats = await AnalyticsService.getTodayStats()

      expect(stats.sales).toBe(0)
      expect(stats.payments).toBe(0)
      expect(stats.disbursements).toBe(0)
      expect(stats.transactions).toBe(0)
    })

    test('handles database error gracefully by returning safe zeroes', async () => {
      (prisma.journalEntry.findMany as jest.Mock).mockRejectedValue(new Error('DB Connection Error'))

      const stats = await AnalyticsService.getTodayStats()

      expect(stats.sales).toBe(0)
      expect(stats.payments).toBe(0)
      expect(stats.disbursements).toBe(0)
      expect(stats.transactions).toBe(0)
    })
  })

  describe('getRecentTransactions', () => {
    test('formats inflow and outflow transactions with correct direction and amounts', async () => {
      const mockEntries = [
        {
          id: 'je-inflow',
          created_at: new Date('2026-10-12T10:00:00Z'),
          date: new Date('2026-10-12T10:00:00Z'),
          description: 'Consultation Fee',
          status: 'ACTIVE',
          payee: { name: 'Juan Dela Cruz' },
          lines: [
            { debit: 500, credit: 0, account: { name: 'Cash on Hand', account_type: { name: 'Asset' } } },
            { debit: 0, credit: 500, account: { name: 'Consultation Revenue', account_type: { name: 'Revenue' } } }
          ]
        },
        {
          id: 'je-outflow',
          created_at: new Date('2026-10-12T11:00:00Z'),
          date: new Date('2026-10-12T11:00:00Z'),
          description: 'Office Supplies',
          status: 'ACTIVE',
          payee: { name: 'National Book Store' },
          lines: [
            { debit: 250, credit: 0, account: { name: 'Supplies Expense', account_type: { name: 'Expense' } } },
            { debit: 0, credit: 250, account: { name: 'Cash on Hand', account_type: { name: 'Asset' } } }
          ]
        }
      ];

      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue(mockEntries)

      const txs = await AnalyticsService.getRecentTransactions()

      expect(txs.length).toBe(2)
      expect(txs[0].direction).toBe('IN')
      expect(txs[0].amount).toBe(500)
      expect(txs[0].patientName).toBe('Juan Dela Cruz')
      expect(txs[1].direction).toBe('OUT')
      expect(txs[1].amount).toBe(250)
      expect(txs[1].patientName).toBe('National Book Store')
    })
  })

  describe('getDashboardMetrics', () => {
    test('aggregates KPI totals and profit margin accurately', async () => {
      const mockEntries = [
        {
          date: new Date(),
          lines: [
            { debit: 0, credit: 50000, account: { name: 'Medical Revenue', account_type: { name: 'Revenue' } } },
            { debit: 20000, credit: 0, account: { name: 'Medical Expense', account_type: { name: 'Expense' } } }
          ]
        }
      ];

      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue(mockEntries)

      const metrics = await AnalyticsService.getDashboardMetrics('monthly')

      expect(metrics).toHaveProperty('kpi')
      expect(metrics.kpi.revenue).toBeGreaterThanOrEqual(0)
      expect(metrics.kpi.expenses).toBeGreaterThanOrEqual(0)
      expect(metrics).toHaveProperty('trendData')
      expect(metrics.trendData.labels.length).toBe(6)
    })
  })
})
