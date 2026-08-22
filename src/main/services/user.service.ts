// src/main/services/user.service.ts
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Initialize Prisma directly here
const prisma = new PrismaClient();

export const UserService = {
  
  async createUser(data: any) {
    // 1. Hash the password using SHA-256 (This matches your AuthService and seed.ts!)
    const hashedPassword = crypto.createHash('sha256').update(data.password).digest('hex');
    
    // 2. Save to database
    const newUser = await prisma.user.create({
      data: {
        username: data.username,
        password_hash: hashedPassword,
        role: data.role,
        is_active: data.is_active
      }
    });

    // 3. Remove the password from the returned object for security
    const { password_hash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

    async getPettyCashBalance() {
    // Sum up all debits and credits for Petty Cash (1020)
    const lines = await prisma.journalLine.findMany({
      where: { account_id: '1020' },
      select: {
        debit: true,
        credit: true,
      }
    });

    const totalDebits = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredits = lines.reduce((sum, line) => sum + Number(line.credit), 0);

    // Asset Formula: Debit - Credit
    return totalDebits - totalCredits;
  },

  async getAllUsers() {
    // 4. Fetch all users for the table
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        is_active: true
      },
      orderBy: {
        username: 'asc'
      }
    });
    
    return users;
  },

  async toggleUserStatus(userId: string, isActive: boolean) {
    return await prisma.user.update({
      where: { id: userId },
      data: { is_active: isActive }
    });
  },

  async resetPassword(userId: string, newPasswordRaw: string) {
    const hashedPassword = crypto.createHash('sha256').update(newPasswordRaw).digest('hex');
    return await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedPassword }
    });
  }
};