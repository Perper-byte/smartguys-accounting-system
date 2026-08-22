// src/main/services/audit.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const AuditService = {
    // 1. Function to secretly record actions
    async logAction(userId: string, action: string, details: string) {
        try {
            await prisma.auditLog.create({
                data: {
                    user_id: userId,
                    action: action,
                    details: details
                }
            });
            return { success: true };
        } catch (error: any) {
            console.error("Failed to write to audit log:", error);
            return { success: false, error: error.message };
        }
    },

    // 2. Function for the IT Admin to view the logs
    async getAuditLogs(startDateStr: string, endDateStr: string) {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        return await prisma.auditLog.findMany({
            where: { timestamp: { gte: startDate, lte: endDate } },
            include: { user: true },
            orderBy: { timestamp: 'desc' }
        });
    }
};