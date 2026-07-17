/*
  Warnings:

  - You are about to alter the column `date` on the `journal_entries` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `journal_entries` MODIFY `date` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
