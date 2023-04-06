/*
  Warnings:

  - You are about to drop the column `hashTagId` on the `RecentSearch` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hashTagName]` on the table `RecentSearch` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "RecentSearch" DROP CONSTRAINT "RecentSearch_hashTagId_fkey";

-- DropIndex
DROP INDEX "RecentSearch_hashTagId_key";

-- AlterTable
ALTER TABLE "RecentSearch" DROP COLUMN "hashTagId",
ADD COLUMN     "hashTagName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RecentSearch_hashTagName_key" ON "RecentSearch"("hashTagName");

-- AddForeignKey
ALTER TABLE "RecentSearch" ADD CONSTRAINT "RecentSearch_hashTagName_fkey" FOREIGN KEY ("hashTagName") REFERENCES "HashTag"("name") ON DELETE SET NULL ON UPDATE CASCADE;
