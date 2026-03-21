/*
  Warnings:

  - A unique constraint covering the columns `[contractAddress]` on the table `Request` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "contractAddress" TEXT,
ADD COLUMN     "nftTokenId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Request_contractAddress_key" ON "Request"("contractAddress");
