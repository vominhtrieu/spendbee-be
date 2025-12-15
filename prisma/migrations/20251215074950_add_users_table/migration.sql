-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "installionId" TEXT NOT NULL,
    "lastAccess" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_installionId_key" ON "users"("installionId");
