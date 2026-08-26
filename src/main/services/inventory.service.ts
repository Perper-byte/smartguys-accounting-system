// src/main/services/inventory.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
    static async getItems() {
        return await prisma.inventoryItem.findMany({
            orderBy: { name: 'asc' }
        });
    }

    static async createItem(data: { code: string, name: string, location?: string }) {
        try {
            const exists = await prisma.inventoryItem.findUnique({ where: { code: data.code } });
            if (exists) throw new Error("Item Code already exists.");

            const item = await prisma.inventoryItem.create({
                data: {
                    code: data.code,
                    name: data.name,
                    location: data.location || null,
                    stock: 0
                }
            });
            return { success: true, data: item };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    static async getLogs(itemId: string) {
        return await prisma.inventoryLog.findMany({
            where: { item_id: itemId },
            include: { user: true },
            orderBy: { date: 'desc' } // Newest first
        });
    }

    static async addLog(data: { itemId: string, userId: string, inQty: number, outQty: number, remarks: string, expiryDate?: string }) {
        try {
            return await prisma.$transaction(async (tx) => {
                const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
                if (!item) throw new Error("Item not found");

                const newBalance = item.stock + data.inQty - data.outQty;
                if (newBalance < 0) throw new Error("Cannot have negative stock balance!");

                const log = await tx.inventoryLog.create({
                    data: {
                        item_id: data.itemId,
                        user_id: data.userId,
                        in_qty: data.inQty,
                        out_qty: data.outQty,
                        balance: newBalance,
                        remarks: data.remarks || null,
                        // 🔥 Inject the expiry date if it was provided!
                        expiry_date: data.expiryDate ? new Date(data.expiryDate) : null
                    }
                });

                await tx.inventoryItem.update({
                    where: { id: data.itemId },
                    data: { stock: newBalance }
                });

                return { success: true, data: log };
            });
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}