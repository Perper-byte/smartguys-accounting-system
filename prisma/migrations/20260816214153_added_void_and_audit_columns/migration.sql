/*
  Warnings:

  - You are about to alter the column `date` on the `journal_entries` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `journal_entries` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `void_reason` TEXT NULL,
    MODIFY `date` DATETIME NOT NULL;

-- CreateIndex
CREATE INDEX `journal_entries_created_at_idx` ON `journal_entries`(`created_at`);
