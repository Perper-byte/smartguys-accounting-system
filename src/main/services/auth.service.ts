// src/main/services/auth.service.ts
import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'; // Native Node module for basic hashing

const prisma = new PrismaClient();

export class AuthService {
  // Simple hashing function for password (in a real app, use bcrypt, but crypto is fine for local-first)
  static hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex')
  }

  static async login(username: string, password: string) {
    const hashedPassword = this.hashPassword(password)

    const user = await prisma.user.findUnique({
      where: { username: username }
    });

    if (!user) {
      throw new Error("Invalid Credentials: User not found");
    }

    if (user.password_hash !== hashedPassword) {
      throw new Error("Invalid Credentials: Password incorrect");
    }

    // Return user data WITHOUT the password hash for security
    return {
      id: user.id,
      username: user.username,
      role: user.role, // e.g. "CASHIER", "ACCOUNTANT", "MANAGER"
    };
  }
}