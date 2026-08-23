-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(50) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('CASHIER', 'ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL') NOT NULL DEFAULT 'CASHIER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(50) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT NOT NULL,

    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_types` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `normal_balance` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `tax_category` VARCHAR(50) NULL,
    `type_id` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payees` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `tin` VARCHAR(50) NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'PATIENT',
    `email` VARCHAR(100) NULL,
    `phone_number` VARCHAR(50) NULL,
    `address` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` VARCHAR(50) NOT NULL,
    `date` DATETIME NOT NULL,
    `reference_no` VARCHAR(100) NOT NULL,
    `vat_type` VARCHAR(20) NOT NULL DEFAULT 'VATABLE',
    `description` TEXT NOT NULL,
    `payee_id` VARCHAR(50) NULL,
    `user_id` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `void_reason` TEXT NULL,

    INDEX `journal_entries_date_idx`(`date`),
    INDEX `journal_entries_reference_no_idx`(`reference_no`),
    INDEX `journal_entries_payee_id_idx`(`payee_id`),
    INDEX `journal_entries_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_lines` (
    `id` VARCHAR(50) NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `entry_id` VARCHAR(50) NOT NULL,
    `account_id` VARCHAR(50) NOT NULL,

    INDEX `journal_lines_account_id_idx`(`account_id`),
    INDEX `journal_lines_entry_id_idx`(`entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `position` VARCHAR(100) NOT NULL,
    `monthly_salary` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tin` VARCHAR(50) NULL,
    `sss_no` VARCHAR(50) NULL,
    `philhealth_no` VARCHAR(50) NULL,
    `pagibig_no` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `account_number` VARCHAR(100) NULL,
    `ledger_account` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_accounts_ledger_account_idx`(`ledger_account`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_transactions` (
    `id` VARCHAR(50) NOT NULL,
    `bank_account_id` VARCHAR(50) NOT NULL,
    `transaction_date` DATETIME NOT NULL,
    `description` TEXT NOT NULL,
    `reference_no` VARCHAR(100) NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `removed_at` DATETIME(3) NULL,

    INDEX `bank_transactions_bank_account_id_transaction_date_idx`(`bank_account_id`, `transaction_date`),
    INDEX `bank_transactions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reconciliations` (
    `id` VARCHAR(50) NOT NULL,
    `bank_transaction_id` VARCHAR(50) NOT NULL,
    `journal_entry_id` VARCHAR(50) NOT NULL,
    `matched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `matched_by` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `reconciliations_bank_transaction_id_key`(`bank_transaction_id`),
    UNIQUE INDEX `reconciliations_journal_entry_id_key`(`journal_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
