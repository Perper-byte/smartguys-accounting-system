// src/main/services/audit.service.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class AuditService {
  /**
   * Logs a system or user action into the Audit Log table.
   */
  static async logAction(
    actor: string | number | null | undefined,
    action: string,
    details: string
  ) {
    try {
      let resolvedUserId: string | null = null

      if (actor && actor !== 'SYSTEM') {
        const strActor = String(actor)
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ id: strActor }, { username: strActor }]
          },
          select: { id: true }
        })
        if (user) resolvedUserId = user.id
      }

      // Safe write: try snake_case first, fallback to camelCase if schema requires
      try {
        return await (prisma.auditLog as any).create({
          data: {
            user_id: resolvedUserId,
            action: (action || 'LOG').toUpperCase().trim(),
            details: details || '',
            timestamp: new Date()
          }
        })
      } catch {
        return await (prisma.auditLog as any).create({
          data: {
            userId: resolvedUserId,
            action: (action || 'LOG').toUpperCase().trim(),
            details: details || '',
            timestamp: new Date()
          }
        })
      }
    } catch (err) {
      console.error('AuditService.logAction failed:', err)
      return null
    }
  }

  /**
   * Fetches audit logs within a given date range quickly without blocking.
   */
  static async getAuditLogs(startDate?: string, endDate?: string) {
    try {
      const start = startDate
        ? new Date(`${startDate}T00:00:00.000Z`)
        : new Date(new Date().setHours(0, 0, 0, 0))

      const end = endDate
        ? new Date(`${endDate}T23:59:59.999Z`)
        : new Date(new Date().setHours(23, 59, 59, 999))

      return await prisma.auditLog.findMany({
        where: {
          timestamp: {
            gte: start,
            lte: end
          }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      })
    } catch (error) {
      console.error('AuditService.getAuditLogs error:', error)
      return []
    }
  }
}