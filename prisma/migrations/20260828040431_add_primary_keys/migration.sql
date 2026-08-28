/*
  Warnings:

  - The primary key for the `accounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[code]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `accounts` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE `accounts` DROP FOREIGN KEY `accounts_type_id_fkey`;

-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `bank_accounts` DROP FOREIGN KEY `bank_accounts_ledger_account_fkey`;

-- DropForeignKey
ALTER TABLE `bank_transactions` DROP FOREIGN KEY `bank_transactions_bank_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `journal_entries_payee_id_fkey`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `journal_entries_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `journal_lines` DROP FOREIGN KEY `journal_lines_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `journal_lines` DROP FOREIGN KEY `journal_lines_entry_id_fkey`;

-- DropForeignKey
ALTER TABLE `reconciliations` DROP FOREIGN KEY `reconciliations_bank_transaction_id_fkey`;

-- DropForeignKey
ALTER TABLE `reconciliations` DROP FOREIGN KEY `reconciliations_journal_entry_id_fkey`;

-- DropForeignKey
ALTER TABLE `reconciliations` DROP FOREIGN KEY `reconciliations_matched_by_fkey`;

-- DropIndex
DROP INDEX `accounts_type_id_fkey` ON `accounts`;

-- DropIndex
DROP INDEX `audit_logs_timestamp_idx` ON `audit_logs`;

-- DropIndex
DROP INDEX `audit_logs_user_id_fkey` ON `audit_logs`;

-- DropIndex
DROP INDEX `bank_accounts_ledger_account_idx` ON `bank_accounts`;

-- DropIndex
DROP INDEX `bank_transactions_bank_account_id_transaction_date_idx` ON `bank_transactions`;

-- DropIndex
DROP INDEX `bank_transactions_status_idx` ON `bank_transactions`;

-- DropIndex
DROP INDEX `journal_entries_created_at_idx` ON `journal_entries`;

-- DropIndex
DROP INDEX `journal_entries_date_idx` ON `journal_entries`;

-- DropIndex
DROP INDEX `journal_entries_payee_id_idx` ON `journal_entries`;

-- DropIndex
DROP INDEX `journal_entries_reference_no_idx` ON `journal_entries`;

-- DropIndex
DROP INDEX `journal_entries_user_id_fkey` ON `journal_entries`;

-- DropIndex
DROP INDEX `journal_lines_account_id_idx` ON `journal_lines`;

-- DropIndex
DROP INDEX `journal_lines_entry_id_idx` ON `journal_lines`;

-- DropIndex
DROP INDEX `reconciliations_bank_transaction_id_key` ON `reconciliations`;

-- DropIndex
DROP INDEX `reconciliations_journal_entry_id_key` ON `reconciliations`;

-- DropIndex
DROP INDEX `reconciliations_matched_by_fkey` ON `reconciliations`;

-- AlterTable
ALTER TABLE `accounts` DROP PRIMARY KEY,
    ADD COLUMN `id` VARCHAR(50) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `users` ADD COLUMN `permissions` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `location` VARCHAR(100) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `inventory_items_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_logs` (
    `id` VARCHAR(50) NOT NULL,
    `item_id` VARCHAR(50) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `in_qty` INTEGER NOT NULL DEFAULT 0,
    `out_qty` INTEGER NOT NULL DEFAULT 0,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `remarks` VARCHAR(255) NULL,
    `expiry_date` DATE NULL,
    `user_id` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(100) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` VARCHAR(50) NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `journal_entry_id` VARCHAR(50) NOT NULL,
    `date` DATE NOT NULL,
    `reference_no` VARCHAR(100) NOT NULL,
    `base_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `overtime` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `night_diff` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `other_earnings` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `gross_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `sss` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `philhealth` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `pagibig` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cash_advance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `license_fee` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `other_deductions` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_deductions` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tax_withheld` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `accounts_code_key` ON `accounts`(`code`);
