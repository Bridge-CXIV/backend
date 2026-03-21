-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'DONOR');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('CHARITY', 'GRANT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING_VERIFICATION', 'LIVE', 'FUNDED', 'EXPIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "magicUserId" TEXT,
    "hederaAccountId" TEXT,
    "walletAddress" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "goalAmount" DECIMAL(65,30) NOT NULL,
    "currentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "timelineEnd" TIMESTAMP(3) NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "hcsTopicId" TEXT,
    "hfsFileId" TEXT,
    "metadata" JSONB,
    "imageUrl" TEXT,
    "businessType" TEXT,
    "businessPlanHfsId" TEXT,
    "proofOfBusinessHfsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "nftId" TEXT,
    "tokenId" TEXT,
    "transactionHash" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "donorId" TEXT,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSignature" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HcsMessage" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sequenceNumber" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,

    CONSTRAINT "HcsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hcsMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "ImpactUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_magicUserId_key" ON "User"("magicUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_hederaAccountId_key" ON "User"("hederaAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Request_hcsTopicId_key" ON "Request"("hcsTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSignature_adminId_requestId_key" ON "AdminSignature"("adminId", "requestId");

-- CreateIndex
CREATE INDEX "HcsMessage_topicId_idx" ON "HcsMessage"("topicId");

-- CreateIndex
CREATE INDEX "HcsMessage_requestId_idx" ON "HcsMessage"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "HcsMessage_topicId_sequenceNumber_key" ON "HcsMessage"("topicId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ImpactUpdate_requestId_idx" ON "ImpactUpdate"("requestId");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSignature" ADD CONSTRAINT "AdminSignature_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSignature" ADD CONSTRAINT "AdminSignature_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HcsMessage" ADD CONSTRAINT "HcsMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactUpdate" ADD CONSTRAINT "ImpactUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactUpdate" ADD CONSTRAINT "ImpactUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
