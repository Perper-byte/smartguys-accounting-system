// src/main/services/audit.service.test.ts
import { AuditService } from './audit.service'
import { PrismaClient } from '@prisma/client'

jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: {
      findFirst: jest.fn()
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})

const prisma = new PrismaClient()

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('logAction', () => {
    test('logs action resolved from user ID or username', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'usr-123' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-1',
        user_id: 'usr-123',
        action: 'PERIOD_CLOSED',
        details: 'Period 1 closed',
        timestamp: new Date()
      })

      const result = await AuditService.logAction('accountant', 'PERIOD_CLOSED', 'Period 1 closed')

      expect(result).not.toBeNull()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'usr-123',
            action: 'PERIOD_CLOSED',
            details: 'Period 1 closed'
          })
        })
      )
    })

    test('logs SYSTEM action without looking up user in database', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-sys',
        user_id: null,
        action: 'AUTO_BACKUP',
        details: 'Nightly backup completed',
        timestamp: new Date()
      })

      const result = await AuditService.logAction('SYSTEM', 'AUTO_BACKUP', 'Nightly backup completed')

      expect(result).not.toBeNull()
      expect(prisma.user.findFirst).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: null,
            action: 'AUTO_BACKUP'
          })
        })
      )
    })

    test('handles database errors gracefully and returns null', async () => {
      (prisma.user.findFirst as jest.Mock).mockRejectedValue(new Error('DB failure'))

      const result = await AuditService.logAction('usr-1', 'LOGIN', 'Login attempt')

      expect(result).toBeNull()
    })
  })

  describe('getAuditLogs', () => {
    test('fetches audit logs within provided date boundaries', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'LOGIN',
          details: 'User logged in',
          timestamp: new Date('2026-10-12T08:00:00Z'),
          user: { id: 'u1', username: 'john', role: 'ACCOUNTANT' }
        }
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs)

      const logs = await AuditService.getAuditLogs('2026-10-12', '2026-10-12')

      expect(logs.length).toBe(1)
      expect(logs[0].action).toBe('LOGIN')
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: new Date('2026-10-12T00:00:00.000Z'),
              lte: new Date('2026-10-12T23:59:59.999Z')
            })
          })
        })
      )
    })

    test('falls back to empty list on error', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockRejectedValue(new Error('Query error'))

      const logs = await AuditService.getAuditLogs()

      expect(logs).toEqual([])
    })
  })
})
