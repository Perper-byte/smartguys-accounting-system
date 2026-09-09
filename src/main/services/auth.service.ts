import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

export class AuthService {
  static async login(usernameInput: string, passwordInput: string) {
    const user = await prisma.user.findUnique({ where: { username: usernameInput } });
    if (!user) throw new Error("Invalid username or password.");

    // Detect if the hash is legacy SHA-256 (64 hex characters)
    const isLegacyHash = /^[a-f0-9]{64}$/i.test(user.password_hash);

    if (isLegacyHash) {
      // 1. Check against the old SHA-256 method
      const legacyHash = crypto.createHash('sha256').update(passwordInput).digest('hex');

      // Use timingSafeEqual to prevent timing attacks
      const match = crypto.timingSafeEqual(
        Buffer.from(legacyHash),
        Buffer.from(user.password_hash)
      );

      if (!match) throw new Error("Invalid username or password.");

      // 2. LAZY MIGRATION: Re-hash with bcrypt and update DB silently
      const newBcryptHash = await bcrypt.hash(passwordInput, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        data: { password_hash: newBcryptHash }
      });

      return user;
    } else {
      // Standard bcrypt check for all new/migrated passwords
      const match = await bcrypt.compare(passwordInput, user.password_hash);
      if (!match) throw new Error("Invalid username or password.");

      return user;
    }
  }

  // RESTORED: This was missing and causing the 'system:ping' crash
  static async pingDatabase() {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out')), 2000)
      );

      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        timeout
      ]);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}