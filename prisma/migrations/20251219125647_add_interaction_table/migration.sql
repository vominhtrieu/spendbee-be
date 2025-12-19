-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('ping', 'llm_usage');

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

