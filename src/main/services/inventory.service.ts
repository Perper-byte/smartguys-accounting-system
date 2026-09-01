// src/main/services/inventory.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {

    static async updateItem(id: string, data: any) {
        try {
            const item = await prisma.inventoryItem.update({
                where: { id },
                data: {
                    code: data.code,
                    name: data.name,
                    location: data.location,
                    uom: data.uom
                }
            });
            return { success: true, item };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    static async deleteItem(id: string) {
        try {
            // Must delete all logs associated with the item first to prevent foreign key errors
            await prisma.inventoryLog.deleteMany({
                where: { item_id: id }
            });
            
            // Then delete the item itself
            await prisma.inventoryItem.delete({
                where: { id }
            });
            
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    static async getItems() {
        const items = await prisma.inventoryItem.findMany({
            orderBy: { name: 'asc' }
        });

        // 🔥 FIX: Cast stock to a Number to prevent Electron IPC DataCloneError
        return items.map((item: any) => ({
            ...item,
            stock: Number(item.stock)
        }));
    }

    static async createItem(data: any) {
    try {
        const item = await prisma.inventoryItem.create({
            data: {
                code: data.code,
                name: data.name,
                location: data.location,
                uom: data.uom // 🔥 MUST HAVE THIS
            }
        });
        return { success: true, item };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

    static async getLogs(itemId: string) {
        const logs = await prisma.inventoryLog.findMany({
            where: { item_id: itemId },
            include: { user: true },
            orderBy: { date: 'desc' } // Newest first
        });

        // 🔥 FIX: Cast quantities and balance to Numbers
        return logs.map((log: any) => ({
            ...log,
            in_qty: Number(log.in_qty),
            out_qty: Number(log.out_qty),
            balance: Number(log.balance)
        }));
    }

    static async addLog(data: { itemId: string, userId: string, inQty: number, outQty: number, remarks: string, expiryDate?: string }) {
        try {
            return await prisma.$transaction(async (tx) => {
                const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
                if (!item) throw new Error("Item not found");

                const newBalance = Number(item.stock) + Number(data.inQty) - Number(data.outQty);
                if (newBalance < 0) throw new Error("Cannot have negative stock balance!");

                const log = await tx.inventoryLog.create({
                    data: {
                        item_id: data.itemId,
                        user_id: data.userId,
                        in_qty: data.inQty,
                        out_qty: data.outQty,
                        balance: newBalance,
                        remarks: data.remarks || null,
                        expiry_date: data.expiryDate ? new Date(data.expiryDate) : null
                    }
                });

                await tx.inventoryItem.update({
                    where: { id: data.itemId },
                    data: { stock: newBalance }
                });

                // 🔥 FIX: Cast returned log numbers
                return {
                    success: true,
                    data: {
                        ...log,
                        in_qty: Number(log.in_qty),
                        out_qty: Number(log.out_qty),
                        balance: Number(log.balance)
                    }
                };
            });
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}