-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "deviceType" TEXT,
ALTER COLUMN "appVersion" DROP DEFAULT;
