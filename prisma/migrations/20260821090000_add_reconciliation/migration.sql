CREATE TABLE `bank_accounts` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `account_number` VARCHAR(100) NULL,
    `ledger_account` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `bank_accounts_ledger_account_idx` (`ledger_account`),
    CONSTRAINT `bank_accounts_ledger_account_fkey` FOREIGN KEY (`ledger_account`) REFERENCES `accounts` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_transactions` (
    `id` VARCHAR(50) NOT NULL,
    `bank_account_id` VARCHAR(50) NOT NULL,
    `transaction_date` DATETIME NOT NULL,
    `description` TEXT NOT NULL,
    `reference_no` VARCHAR(100) NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `bank_transactions_bank_account_id_transaction_date_idx` (`bank_account_id`, `transaction_date`),
    INDEX `bank_transactions_status_idx` (`status`),
    CONSTRAINT `bank_transactions_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reconciliations` (
    `id` VARCHAR(50) NOT NULL,
    `bank_transaction_id` VARCHAR(50) NOT NULL,
    `journal_entry_id` VARCHAR(50) NOT NULL,
    `matched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `matched_by` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `reconciliations_bank_transaction_id_key` (`bank_transaction_id`),
    UNIQUE INDEX `reconciliations_journal_entry_id_key` (`journal_entry_id`),
    CONSTRAINT `reconciliations_bank_transaction_id_fkey` FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `reconciliations_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `reconciliations_matched_by_fkey` FOREIGN KEY (`matched_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
