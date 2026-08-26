import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export const UserService = {
    async getAllUsers() {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, role: true, is_active: true, permissions: true },
            orderBy: { username: 'asc' }
        });
        
        // 🔥 Safely parse the JSON permissions so the checkboxes actually render!
        return users.map(u => {
            let parsedPerms = [];
            if (u.permissions) {
                try {
                    parsedPerms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions;
                } catch (e) { parsedPerms = []; }
            }
            return { ...u, permissions: parsedPerms };
        });
    },

    async createUser(data: any) {
        const hash = crypto.createHash('sha256').update(data.password).digest('hex');
        return await prisma.user.create({
            data: {
                username: data.username,
                password_hash: hash,
                role: data.role,
                is_active: data.isActive,
                permissions: data.permissions || []
            }
        });
    },

    async toggleUserStatus(id: string, isActive: boolean) {
        return await prisma.user.update({ where: { id }, data: { is_active: isActive } });
    },

    async resetPassword(id: string, newPassword: string) {
        const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
        return await prisma.user.update({ where: { id }, data: { password_hash: hash } });
    },

    async updateUserPermissions(id: string, permissions: string[]) {
        // 🔥 Save the raw array directly to the DB!
        return await prisma.user.update({ 
            where: { id }, 
            data: { permissions: permissions } 
        });
    },

    async getPettyCashBalance() {
        const lines = await prisma.journalLine.findMany({
            where: { account_id: '1020', entry: { status: 'ACTIVE' } }
        });
        return lines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
    }
};