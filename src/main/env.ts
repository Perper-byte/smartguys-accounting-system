// src/main/env.ts
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Find the secure folder where Electron stores user settings (e.g., AppData/Roaming/)
const configPath = path.join(app.getPath('userData'), 'server-config.json');

let serverIp = 'localhost'; // Default to localhost (Server PC)

if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.serverIp) {
      serverIp = config.serverIp;
    }
  } catch (e) {
    console.error("Failed to read server config:", e);
  }
}

// 🚀 DYNAMICALLY SET THE DATABASE URL BEFORE PRISMA LOADS!
process.env.DATABASE_URL = `mysql://root:@${serverIp}:3306/smartguys_accounting`;