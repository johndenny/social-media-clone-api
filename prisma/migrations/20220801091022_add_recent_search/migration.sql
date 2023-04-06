/*
  Warnings:

  - You are about to drop the `HashTagSearch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserSearch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "HashTagSearch" DROP CONSTRAINT "HashTagSearch_hashTagId_fkey";

-- DropForeignKey
ALTER TABLE "HashTagSearch" DROP CONSTRAINT "HashTagSearch_searchedById_fkey";

-- DropForeignKey
ALTER TABLE "UserSearch" DROP CONSTRAINT "UserSearch_searchedById_fkey";

-- DropForeignKey
ALTER TABLE "UserSearch" DROP CONSTRAINT "UserSearch_userId_fkey";

-- DropTable
DROP TABLE "HashTagSearch";

-- DropTable
DROP TABLE "UserSearch";

-- CreateTable
CREATE TABLE "RecentSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "hashTagId" TEXT,
    "searchedById" TEXT NOT NULL,

    CONSTRAINT "RecentSearch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecentSearch" ADD CONSTRAINT "RecentSearch_hashTagId_fkey" FOREIGN KEY ("hashTagId") REFERENCES "HashTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentSearch" ADD CONSTRAINT "RecentSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentSearch" ADD CONSTRAINT "RecentSearch_searchedById_fkey" FOREIGN KEY ("searchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
