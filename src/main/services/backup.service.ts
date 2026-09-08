import { execFile } from 'child_process';
import * as fs from 'fs';
import { dialog } from 'electron';

export class BackupService {
    private static parseDatabaseUrl(): { user: string; pass: string; host: string; port: string; db: string } {
        const url = process.env.DATABASE_URL || '';
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

    static async executeBackup(): Promise<{ success: boolean; filePath?: string; error?: string; timestamp?: string }> {
        try {
            const dbConfig = this.parseDatabaseUrl();

            const { filePath } = await dialog.showSaveDialog({
                title: 'Create Database Backup',
                defaultPath: `smartguys_backup_${new Date().toISOString().split('T')[0]}.sql`,
                filters: [{ name: 'SQL Dump Files', extensions: ['sql'] }]
            });

            if (!filePath) return { success: false, error: 'Backup cancelled by administrator.' };

            let dumpExecutable = 'mysqldump';

            // OS Check: Only apply XAMPP fallback if running on Windows
            if (process.platform === 'win32') {
                const xamppPath = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
                if (fs.existsSync(xamppPath)) {
                    dumpExecutable = xamppPath;
                }
            }

            // Using an arguments array prevents Shell/Command Injection
            const args = [
                `-h`, dbConfig.host,
                `-P`, dbConfig.port,
                `-u`, dbConfig.user,
                `--result-file=${filePath}`,
                dbConfig.db
            ];

            // Insert password securely if it exists
            if (dbConfig.pass) args.splice(4, 0, `-p${dbConfig.pass}`);

            return new Promise((resolve) => {
                // execFile is much safer than exec
                execFile(dumpExecutable, args, async (err) => {
                    if (err) return resolve({ success: false, error: `CLI Error: ${err.message}` });

                    const isValid = await this.verifyBackupIntegrity(filePath);

                    if (isValid) {
                        resolve({ success: true, filePath, timestamp: new Date().toLocaleString() });
                    } else {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                        resolve({ success: false, error: "Integrity Scan Failed: Truncated file." });
                    }
                });
            });
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    public static async verifyBackupIntegrity(filePath: string): Promise<boolean> {
        if (!fs.existsSync(filePath)) return false;

        const stats = fs.statSync(filePath);
        if (stats.size === 0) return false;

        const fileBuffer = fs.readFileSync(filePath);
        const tail = fileBuffer.toString('utf8', Math.max(0, fileBuffer.length - 200));

        return tail.includes('-- Dump completed on');
    }

    static async executeRestore(sqlFilePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const dbConfig = this.parseDatabaseUrl();
            let mysqlExecutable = 'mysql';

            if (process.platform === 'win32') {
                const xamppPath = 'C:\\xampp\\mysql\\bin\\mysql.exe';
                if (fs.existsSync(xamppPath)) mysqlExecutable = xamppPath;
            }

            // MySQL expects forward slashes for the 'source' command, otherwise Windows backslashes get interpreted as escapes.
            const formattedPath = sqlFilePath.replace(/\\/g, '/');

            const args = [
                `-h`, dbConfig.host,
                `-P`, dbConfig.port,
                `-u`, dbConfig.user,
                `-e`, `source ${formattedPath}`, // Executes the SQL file safely
                dbConfig.db
            ];

            if (dbConfig.pass) args.splice(4, 0, `-p${dbConfig.pass}`);

            return new Promise((resolve) => {
                execFile(mysqlExecutable, args, (err) => {
                    if (err) return resolve({ success: false, error: `Restore failed: ${err.message}` });
                    resolve({ success: true });
                });
            });
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}