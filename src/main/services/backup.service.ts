// src/main/services/backup.service.ts
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dialog } from 'electron';

export class BackupService {
    /**
     * Parses the prisma DATABASE_URL into connection parameters for mysqldump
     */
    private static parseDatabaseUrl(): { user: string; pass: string; host: string; port: string; db: string } {
        const url = process.env.DATABASE_URL || '';
        // Format: mysql://user:pass@host:port/database
        const regex = /mysql:\/\/([^:]+):?([^@]+)?@([^:]+):?(\d+)?\/(.+)/;
        const matches = url.match(regex);

        if (!matches) {
            throw new Error("System Error: Invalid database URL configuration.");
        }

        return {
            user: matches[1],
            pass: matches[2] || '',
            host: matches[3],
            port: matches[4] || '3306',
            db: matches[5],
        };
    }

    /**
     * Triggers mysqldump and runs a post-backup integrity validation scan.
     */
    static async executeBackup(): Promise<{ success: boolean; filePath?: string; error?: string; timestamp?: string }> {
        try {
            const dbConfig = this.parseDatabaseUrl();

            // 1. Prompt IT Personnel to choose where to save the .sql backup file
            const { filePath } = await dialog.showSaveDialog({
                title: 'Create Database Backup',
                defaultPath: `smartguys_backup_${new Date().toISOString().split('T')[0]}.sql`,
                filters: [{ name: 'SQL Dump Files', extensions: ['sql'] }]
            });

            if (!filePath) {
                return { success: false, error: 'Backup cancelled by administrator.' };
            }

            // 2. Assemble the mysqldump CLI command securely with XAMPP fallback
            let dumpExecutable = 'mysqldump'; // Default global command
            
            // Resilient Fallback: If XAMPP is installed in the default location, use absolute path
            const xamppPath = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
            if (fs.existsSync(xamppPath)) {
                dumpExecutable = `"${xamppPath}"`; // Wrap in quotes to handle Windows paths
            }

            let dumpCmd = `${dumpExecutable} -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user}`;
            if (dbConfig.pass) {
                dumpCmd += ` -p${dbConfig.pass}`;
            }
            dumpCmd += ` ${dbConfig.db} > "${filePath}"`;

            return new Promise((resolve) => {
                exec(dumpCmd, async (err) => {
                    if (err) {
                        return resolve({ success: false, error: `CLI Error: ${err.message}` });
                    }

                    // 3. INTEGRITY & COMPLETENESS VERIFICATION SCAN (Figure 10, Page 74)
                    const isValid = await this.verifyBackupIntegrity(filePath);

                    if (isValid) {
                        resolve({
                            success: true,
                            filePath,
                            timestamp: new Date().toLocaleString()
                        });
                    } else {
                        // Remove corrupted file if validation fails
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                        resolve({
                            success: false,
                            error: "Integrity Scan Failed: The SQL dump file was truncated or incomplete."
                        });
                    }
                });
            });
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Strictly scans the SQL file size and reads the trailing EOF line 
     * to ensure mysqldump completed without truncation.
     */
    public static async verifyBackupIntegrity(filePath: string): Promise<boolean> {
        if (!fs.existsSync(filePath)) return false;

        const stats = fs.statSync(filePath);
        if (stats.size === 0) return false; // Fail if file is 0 bytes

        // Read the last 200 bytes of the file to scan for the standard complete marker
        const fileBuffer = fs.readFileSync(filePath);
        const tail = fileBuffer.toString('utf8', Math.max(0, fileBuffer.length - 200));

        // Standard mysqldump completion signature
        return tail.includes('-- Dump completed on');
    }
}