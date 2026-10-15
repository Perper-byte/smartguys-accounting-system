// src/main/services/user.service.test.ts
import { UserService } from './user.service'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    systemSetting: {
      findFirst: jest.fn(),
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

  test('getRolePermissions returns defaults when no setting exists', async () => {
    (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue(null)
    const perms = await UserService.getRolePermissions()
    expect(perms.CASHIER).toEqual(['billing', 'collections', 'directory', 'history'])
  })

  test('getRolePermissions returns stored settings when present', async () => {
    (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      role_permissions: { CASHIER: ['billing', 'history'] }
    })
    const perms = await UserService.getRolePermissions()
    expect(perms.CASHIER).toEqual(['billing', 'history'])
  })

  test('updateRolePermissions updates systemSetting and NEVER touches user records', async () => {
    (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({ id: 'set-1' })
    const matrix = {
      CASHIER: ['billing', 'history'],
      ACCOUNTANT: ['billing'],
      MANAGER: ['billing'],
      IT_PERSONNEL: ['directory']
    }

    await UserService.updateRolePermissions(matrix)

    expect(prisma.systemSetting.update).toHaveBeenCalledWith({
      where: { id: 'set-1' },
      data: { role_permissions: matrix }
    })
    // Strictly verify existing users are untouched!
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  test('createUser falls back to role default permissions when none explicitly passed', async () => {
    (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      role_permissions: { CASHIER: ['billing', 'collections', 'directory'] }
    });
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'usr-new-id',
      username: 'default_cashier',
      password_hash: 'mock_bcrypt_hash_123',
      role: 'CASHIER',
      is_active: true,
      permissions: ['billing', 'collections', 'directory']
    })

    const result = await UserService.createUser({
      username: 'default_cashier',
      password: 'Pass12345678!',
      role: 'CASHIER',
      isActive: true
    })

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'CASHIER',
          permissions: ['billing', 'collections', 'directory']
        })
      })
    )
    expect(result.username).toBe('default_cashier')
  })

  test('forceApplyRolePermissions updates systemSetting AND updates all existing user accounts by role', async () => {
    (prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({ id: 'set-1' });
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 3 })

    const matrix = {
      CASHIER: ['billing', 'history'],
      ACCOUNTANT: ['billing', 'ledger'],
      MANAGER: ['billing', 'voids'],
      IT_PERSONNEL: ['audit']
    }

    const result = await UserService.forceApplyRolePermissions(matrix)

    expect(prisma.systemSetting.update).toHaveBeenCalledWith({
      where: { id: 'set-1' },
      data: { role_permissions: matrix }
    })
    // Verified that updateMany was called for each role
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { role: 'CASHIER' },
      data: { permissions: ['billing', 'history'] }
    })
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { role: 'ACCOUNTANT' },
      data: { permissions: ['billing', 'ledger'] }
    })
    expect(result.count).toBe(12) // 4 roles * 3 each
  })
})

