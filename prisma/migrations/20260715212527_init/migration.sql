-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(50) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('CASHIER', 'ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL') NOT NULL DEFAULT 'CASHIER',

    UNIQUE INDEX `users_username_key`(`username`),
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

    INDEX `journal_entries_date_idx`(`date`),
    INDEX `journal_entries_reference_no_idx`(`reference_no`),
    INDEX `journal_entries_payee_id_idx`(`payee_id`),
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
