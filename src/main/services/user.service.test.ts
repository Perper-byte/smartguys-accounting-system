// src/main/services/user.service.test.ts
import { UserService } from './user.service'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('mock_bcrypt_hash_123')
}))

const prisma = new PrismaClient()

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('getAllUsers fetches users and parses JSON permissions cleanly', async () => {
    const mockUsers = [
      { id: 'u1', username: 'cashier1', role: 'CASHIER', is_active: true, permissions: '["pos_billing", "view_receipts"]' },
      { id: 'u2', username: 'accountant1', role: 'ACCOUNTANT', is_active: true, permissions: ['full_ledger'] },
      { id: 'u3', username: 'invalid_perms', role: 'MANAGER', is_active: false, permissions: 'invalid json{' }
    ];

    (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers)

    const users = await UserService.getAllUsers()

    expect(users.length).toBe(3)
    expect(users[0].permissions).toEqual(['pos_billing', 'view_receipts'])
    expect(users[1].permissions).toEqual(['full_ledger'])
    expect(users[2].permissions).toEqual([])
  })

  test('createUser hashes password with bcrypt and returns safe user omitting password_hash', async () => {
    const userData = {
      username: 'new_cashier',
      password: 'GeneratedPassword123!',
      role: 'CASHIER',
      isActive: true,
      permissions: ['pos_billing']
    };

    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'usr-new-id',
      username: 'new_cashier',
      password_hash: 'mock_bcrypt_hash_123',
      role: 'CASHIER',
      is_active: true,
      permissions: ['pos_billing']
    })

    const result = await UserService.createUser(userData)

    expect(bcrypt.hash).toHaveBeenCalledWith('GeneratedPassword123!', 12)
    expect(result).not.toHaveProperty('password_hash')
    expect(result.id).toBe('usr-new-id')
    expect(result.username).toBe('new_cashier')
  })

  test('toggleUserStatus updates user is_active flag in database', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', is_active: false })

    await UserService.toggleUserStatus('u1', false)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { is_active: false }
    })
  })

  test('resetPassword updates user password hash and returns safe user', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'u1',
      username: 'john',
      password_hash: 'mock_bcrypt_hash_123'
    })

    const result = await UserService.resetPassword('u1', 'NewSecurePass99#')

    expect(bcrypt.hash).toHaveBeenCalledWith('NewSecurePass99#', 12)
    expect(result).not.toHaveProperty('password_hash')
  })

  test('updateUserPermissions updates permissions array', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', permissions: ['reports', 'audit'] })

    await UserService.updateUserPermissions('u1', ['reports', 'audit'])

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { permissions: ['reports', 'audit'] }
    })
  })
})

