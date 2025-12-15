-- AlterTable - Rename installionId to installationId
ALTER TABLE "users" RENAME COLUMN "installionId" TO "installationId";

-- RenameIndex
ALTER INDEX "users_installionId_key" RENAME TO "users_installationId_key";
