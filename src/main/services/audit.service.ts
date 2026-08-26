// src/main/services/audit.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const AuditService = {
    // 1. Function to secretly record actions
    async logAction(userId: string, action: string, details: string) {
        try {
            // First, verify the user actually exists in the DB to prevent Foreign Key crashes!
            const userExists = await prisma.user.findUnique({ where: { id: userId } });
            
            // If the user doesn't exist, we look for the SYSTEM user we just created.
            let validUserId = userId;
            if (!userExists) {
                const sysUser = await prisma.user.findUnique({ where: { username: 'SYSTEM' } });
                if (!sysUser) return; // If there is no SYSTEM user either, just quietly abort.
                validUserId = sysUser.id;
            }

            await prisma.auditLog.create({
                data: {
                    user_id: validUserId,
                    action,
                    details
                }
            });
        } catch (error) {
            console.error("Failed to write to audit log:", error);
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