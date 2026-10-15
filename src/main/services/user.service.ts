import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const SALT_ROUNDS = 12

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  CASHIER: ['billing', 'collections', 'directory', 'history'],
  ACCOUNTANT: [
    'billing', 'collections', 'directory', 'disbursement', 'payouts', 'aging', 'aged-payables',
    'tracker', 'history', 'journal', 'adjusting', 'ledger', 'reconciliation', 'books',
    'statements', 'bir', 'coa', 'inventory', 'services'
  ],
  MANAGER: [
    'billing', 'collections', 'directory', 'disbursement', 'payouts', 'aging', 'aged-payables',
    'tracker', 'history', 'payroll', 'journal', 'adjusting', 'ledger', 'reconciliation',
    'books', 'analytics', 'statements', 'bir', 'voids', 'coa', 'inventory', 'services'
  ],
  IT_PERSONNEL: ['directory', 'audit', 'users', 'backup', 'services', 'inventory']
}

export const UserService = {
  DEFAULT_ROLE_PERMISSIONS,

  async getRolePermissions(): Promise<Record<string, string[]>> {
    const setting = await prisma.systemSetting.findFirst()
    if (!setting || !(setting as any).role_permissions) {
      return DEFAULT_ROLE_PERMISSIONS
    }
    try {
      const raw = (setting as any).role_permissions
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return {
        ...DEFAULT_ROLE_PERMISSIONS,
        ...parsed
      }
    } catch {
      return DEFAULT_ROLE_PERMISSIONS
    }
  },

  async updateRolePermissions(matrix: Record<string, string[]>): Promise<Record<string, string[]>> {
    const setting = await prisma.systemSetting.findFirst()
    if (setting) {
      await prisma.systemSetting.update({
        where: { id: setting.id },
        data: { role_permissions: matrix } as any
      })
    } else {
      await prisma.systemSetting.create({
        data: { role_permissions: matrix } as any
      })
    }
    // Strictly modifies system settings template only; does NOT touch existing user accounts
    return matrix
  },

  async forceApplyRolePermissions(matrix: Record<string, string[]>): Promise<{ count: number }> {
    await this.updateRolePermissions(matrix)
    const roles = Object.keys(matrix)
    let totalUpdated = 0
    for (const role of roles) {
      const perms = matrix[role] || []
      const result = await prisma.user.updateMany({
        where: { role: role as any },
        data: { permissions: perms }
      })
      totalUpdated += result.count
    }
    return { count: totalUpdated }
  },

  async getAllUsers() {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, is_active: true, permissions: true },
      orderBy: { username: 'asc' }
    })

    // 🔥 Safely parse the JSON permissions so the checkboxes actually render!
    return users.map((u) => {
      let parsedPerms = []
      if (u.permissions) {
        try {
          parsedPerms =
            typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions
        } catch (e) {
          parsedPerms = []
        }
      }
      return { ...u, permissions: parsedPerms }
    })
  },

  async createUser(data: any) {
    const hash = await bcrypt.hash(data.password, SALT_ROUNDS)
    let perms = data.permissions
    if (!perms || !Array.isArray(perms) || perms.length === 0) {
      const defaultRolePerms = await this.getRolePermissions()
      perms = defaultRolePerms[data.role] || DEFAULT_ROLE_PERMISSIONS[data.role] || []
    }
    const user = await prisma.user.create({
      data: {
        username: data.username,
        password_hash: hash,
        role: data.role,
        is_active: data.isActive,
        permissions: perms
      }
    })
    const { password_hash, ...safeUser } = user
    return safeUser
  },

  async toggleUserStatus(id: string, isActive: boolean) {
    return await prisma.user.update({ where: { id }, data: { is_active: isActive } })
  },

  async resetPassword(id: string, newPassword: string) {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    const user = await prisma.user.update({ where: { id }, data: { password_hash: hash } })
    const { password_hash, ...safeUser } = user
    return safeUser
  },

  async updateUserPermissions(id: string, permissions: string[]) {
    // 🔥 Save the raw array directly to the DB!
    return await prisma.user.update({
      where: { id },
      data: { permissions: permissions }
    })
  },

  async getPettyCashBalance() {
    const lines = await prisma.journalLine.findMany({
      where: { account_id: '1020', entry: { status: 'ACTIVE' } }
    })
    return lines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0)
  }
}
