// src/main/services/auth.service.ts
import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'; // Native Node module for basic hashing

const prisma = new PrismaClient();

export const AuthService = {
    async login(username: string, passwordInput: string) {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) throw new Error("Invalid username or password.");
        if (!user.is_active) throw new Error("This account has been disabled.");

        const hash = crypto.createHash('sha256').update(passwordInput).digest('hex');
        if (user.password_hash !== hash) throw new Error("Invalid username or password.");

        let parsedPerms = [];
        if (user.permissions) {
            try {
                parsedPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            } catch (e) { parsedPerms = []; }
        }

        // 🔥 CRITICAL FIX: Send the custom permissions back to the frontend on login!
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: parsedPerms 
        };
    },

   async pingDatabase(): Promise<boolean> {
    try {
      // A tiny, fast query just to prove the connection is alive
      await prisma.user.findFirst();
      return true;
    } catch (error) {
      return false; // Returns false if the ethernet cable is unplugged!
    }
  }
}