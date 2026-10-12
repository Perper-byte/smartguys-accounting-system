// src/main/services/inventory.service.test.ts
import { InventoryService } from './inventory.service'
import { PrismaClient } from '@prisma/client'

jest.mock('@prisma/client', () => {
  const mPrisma = {
    inventoryItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    inventoryLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn()
    },
    $transaction: jest.fn()
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})

const prisma = new PrismaClient()

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('getItems fetches all inventory items with normalized numeric stock', async () => {
    const mockItems = [
      { id: 'item-1', code: 'MED-001', name: 'Paracetamol 500mg', stock: '100', uom: 'tablet' },
      { id: 'item-2', code: 'MED-002', name: 'Amoxicillin 500mg', stock: 50, uom: 'capsule' }
    ];

    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    const items = await InventoryService.getItems()

    expect(items.length).toBe(2)
    expect(items[0].stock).toBe(100)
    expect(typeof items[0].stock).toBe('number')
    expect(items[1].stock).toBe(50)
  })

  test('createItem saves new item successfully', async () => {
    const newItem = { code: 'MED-003', name: 'Ibuprofen 200mg', location: 'Shelf A', uom: 'box' };
    (prisma.inventoryItem.create as jest.Mock).mockResolvedValue({ id: 'item-3', ...newItem, stock: 0 })

    const result = await InventoryService.createItem(newItem)

    expect(result.success).toBe(true)
    expect(result.item?.code).toBe('MED-003')
  })

  test('updateItem updates existing inventory details', async () => {
    const updateData = { code: 'MED-001-UPD', name: 'Paracetamol Extra', location: 'Shelf B', uom: 'pack' };
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({ id: 'item-1', ...updateData })

    const result = await InventoryService.updateItem('item-1', updateData)

    expect(result.success).toBe(true)
    expect(result.item?.name).toBe('Paracetamol Extra')
  })

  test('deleteItem cascades deletion of logs before deleting item', async () => {
    (prisma.inventoryLog.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
    (prisma.inventoryItem.delete as jest.Mock).mockResolvedValue({ id: 'item-1' })

    const result = await InventoryService.deleteItem('item-1')

    expect(result.success).toBe(true)
    expect(prisma.inventoryLog.deleteMany).toHaveBeenCalledWith({ where: { item_id: 'item-1' } })
    expect(prisma.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
  })

  test('addLog updates stock balance via transaction upon restocking', async () => {
    const mockTx = {
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', stock: 50 }),
        update: jest.fn().mockResolvedValue({ id: 'item-1', stock: 70 })
      },
      inventoryLog: {
        create: jest.fn().mockResolvedValue({
          id: 'log-1',
          item_id: 'item-1',
          in_qty: 20,
          out_qty: 0,
          balance: 70
        })
      }
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(mockTx))

    const result = await InventoryService.addLog({
      itemId: 'item-1',
      userId: 'user-1',
      inQty: 20,
      outQty: 0,
      remarks: 'Restock'
    })

    expect(result.success).toBe(true)
    expect(result.data?.balance).toBe(70)
    expect(mockTx.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { stock: 70 }
    })
  })

  test('addLog rejects transactions leading to negative stock balance', async () => {
    const mockTx = {
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', stock: 10 })
      }
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(mockTx))

    const result = await InventoryService.addLog({
      itemId: 'item-1',
      userId: 'user-1',
      inQty: 0,
      outQty: 25,
      remarks: 'Dispensed more than stock'
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Cannot have negative stock balance')
  })
})

