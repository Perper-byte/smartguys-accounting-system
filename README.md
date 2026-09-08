# SmartGuys Clinic Accounting System

A desktop accounting, payroll, and inventory management system tailored for SmartGuys Clinic. Built with Electron, React, and Prisma, this system ensures offline-first reliability, BIR tax compliance, and secure local data management.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Electron (Main Process), Node.js
- **Database:** MySQL / MariaDB (via XAMPP)
- **ORM:** Prisma Client
- **Security:** Bcrypt (Password Hashing), IPC Context Isolation

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites

- **Node.js** (v18+ recommended)
- **XAMPP** or a standalone MySQL/MariaDB server running on port 3306.

### 2. Environment Variables

Create a `.env` file in the root directory (next to `package.json`) and configure your database connection:

```env
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="mysql://root:@localhost:3306/smartguys_accounting"
3. Installation & Database Setup
Run the following commands in your terminal:
code
Bash
# Install dependencies
npm install

# Push the schema to the database (creates tables)
npx prisma db push
# OR if you are using migrations:
npx prisma migrate dev

# Generate the Prisma Client (Required for DB access)
npx prisma generate
4. Run the Application
code
Bash
npm run dev
🏗 Project Architecture
The app strictly follows Electron's secure architecture using Inter-Process Communication (IPC):
src/main/ (Backend): Contains Electron window management and services/ (Auth, Ledger, Backup, etc.). Directly accesses the database and filesystem.
src/renderer/ (Frontend): React components and UI. Cannot access the database directly.
src/preload/ (The Bridge): Exposes safe, restricted APIs (window.electronAPI) to the frontend.
src/shared/: Contains ipc-channels.ts to keep communication channel names strictly typed and synchronized between Main and Renderer.
💾 Database Management (Prisma)
If you modify prisma/schema.prisma to add a new table or column, you must apply the changes:
code
Bash
# 1. Create a migration and update the database
npx prisma migrate dev --name describe_your_changes

# 2. Re-generate the client
npx prisma generate
Viewing Data:
You can open a web-based database UI at any time by running:
code
Bash
npx prisma studio
🚨 Disaster Recovery (DR) Plan
1. Creating Backups
How: Navigate to Database Backup in the System Admin menu and click Run Backup Now.
What happens: The system triggers mysqldump to create a complete .sql snapshot of the schema and data. A verification scan runs automatically to ensure the file isn't truncated.
Best Practice: Perform this at the end of every business day and store the .sql file on an external hard drive or secure cloud storage (e.g., Google Drive/OneDrive).
2. Restoring from a Backup
Warning: Restoring a database overwrites all current data. Any transactions entered after the backup was created will be permanently lost.
How: Navigate to Database Backup -> Restore Database. Select the .sql file you wish to restore.
Audit Trail: Restores are strictly logged in the system Audit Trail.
3. Manual Recovery (Server Crash)
If the Electron app will not boot, you can manually restore a backup using the MySQL CLI or phpMyAdmin via XAMPP:
Open XAMPP Control Panel -> MySQL -> Admin (opens phpMyAdmin).
Select the smartguys_accounting database.
Go to the Import tab.
Upload your .sql backup file and click Go.
🔒 Security & Deployment Notes
Password Hashing (Lazy Migration): The system uses bcrypt for password hashing. Legacy SHA-256 passwords are automatically upgraded to bcrypt silently in the database the next time that user logs in.
Ubuntu Server Deployment: The schema.prisma file is configured with binaryTargets = ["native", "windows", "debian-openssl-3.0.x"]. This ensures that when deploying the backend to an Ubuntu server, the correct Linux query-engine is bundled alongside the Windows developer engine.
IPC Isolation: nodeIntegration is strictly set to false, and contextIsolation is true. The frontend only communicates via the defined electronAPI in the preload script.
code
Code
***

### Why this documentation helps:
1. **Onboarding:** If you bring another developer onto this project, they can read this and have the app running in 5 minutes.
2. **Maintenance:** It documents the *Intended Architecture* (IPC bridge, Main/Renderer separation), which stops developers from accidentally breaking Electron security best practices.
3. **Compliance:** BIR (Bureau of Internal Revenue) and other auditing bodies look favorably upon systems that have a clearly defined, written Disaster Recovery and Backup procedure.
```
