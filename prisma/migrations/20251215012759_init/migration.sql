-- CreateTable
CREATE TABLE "llm_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "modelName" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);
