/*
  Warnings:

  - The primary key for the `accounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `accounts` table. All the data in the column will be lost.
  - You are about to alter the column `transaction_date` on the `bank_transactions` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `date` on the `journal_entries` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - A unique constraint covering the columns `[bank_transaction_id]` on the table `reconciliations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[journal_entry_id]` on the table `reconciliations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `accounts_code_key` ON `accounts`;

-- AlterTable
ALTER TABLE `accounts` DROP PRIMARY KEY,
    DROP COLUMN `id`,
    ADD PRIMARY KEY (`code`);

-- AlterTable
ALTER TABLE `bank_transactions` MODIFY `transaction_date` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `journal_entries` MODIFY `date` DATETIME NOT NULL;

-- CreateIndex
CREATE INDEX `audit_logs_timestamp_idx` ON `audit_logs`(`timestamp`);

-- CreateIndex
CREATE INDEX `bank_accounts_ledger_account_idx` ON `bank_accounts`(`ledger_account`);

-- CreateIndex
CREATE INDEX `bank_transactions_bank_account_id_transaction_date_idx` ON `bank_transactions`(`bank_account_id`, `transaction_date`);

-- CreateIndex
CREATE INDEX `bank_transactions_status_idx` ON `bank_transactions`(`status`);

-- CreateIndex
CREATE INDEX `inventory_logs_item_id_idx` ON `inventory_logs`(`item_id`);

-- CreateIndex
CREATE INDEX `inventory_logs_date_idx` ON `inventory_logs`(`date`);

-- CreateIndex
CREATE INDEX `journal_entries_date_idx` ON `journal_entries`(`date`);

-- CreateIndex
CREATE INDEX `journal_entries_reference_no_idx` ON `journal_entries`(`reference_no`);

-- CreateIndex
CREATE INDEX `journal_entries_payee_id_idx` ON `journal_entries`(`payee_id`);

-- CreateIndex
CREATE INDEX `journal_entries_created_at_idx` ON `journal_entries`(`created_at`);

-- CreateIndex
CREATE INDEX `journal_lines_account_id_idx` ON `journal_lines`(`account_id`);

-- CreateIndex
CREATE INDEX `journal_lines_entry_id_idx` ON `journal_lines`(`entry_id`);

-- CreateIndex
CREATE UNIQUE INDEX `reconciliations_bank_transaction_id_key` ON `reconciliations`(`bank_transaction_id`);

-- CreateIndex
CREATE UNIQUE INDEX `reconciliations_journal_entry_id_key` ON `reconciliations`(`journal_entry_id`);

-- AddForeignKey
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `account_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_payee_id_fkey` FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_entry_id_fkey` FOREIGN KEY (`entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_ledger_account_fkey` FOREIGN KEY (`ledger_account`) REFERENCES `accounts`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliations` ADD CONSTRAINT `reconciliations_bank_transaction_id_fkey` FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliations` ADD CONSTRAINT `reconciliations_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliations` ADD CONSTRAINT `reconciliations_matched_by_fkey` FOREIGN KEY (`matched_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
