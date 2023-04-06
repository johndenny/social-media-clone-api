/*
  Warnings:

  - You are about to drop the `RecentSearch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RecentSearch" DROP CONSTRAINT "RecentSearch_hashTagName_fkey";

-- DropForeignKey
ALTER TABLE "RecentSearch" DROP CONSTRAINT "RecentSearch_searchedById_fkey";

-- DropForeignKey
ALTER TABLE "RecentSearch" DROP CONSTRAINT "RecentSearch_userId_fkey";

-- DropTable
DROP TABLE "RecentSearch";

-- CreateTable
CREATE TABLE "UserSearch" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "searchedById" TEXT NOT NULL,

    CONSTRAINT "UserSearch_pkey" PRIMARY KEY ("userId","searchedById")
);

-- CreateTable
CREATE TABLE "HashTagSearch" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashTagName" TEXT NOT NULL,
    "searchedById" TEXT NOT NULL,

    CONSTRAINT "HashTagSearch_pkey" PRIMARY KEY ("hashTagName","searchedById")
);

-- AddForeignKey
ALTER TABLE "UserSearch" ADD CONSTRAINT "UserSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSearch" ADD CONSTRAINT "UserSearch_searchedById_fkey" FOREIGN KEY ("searchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashTagSearch" ADD CONSTRAINT "HashTagSearch_hashTagName_fkey" FOREIGN KEY ("hashTagName") REFERENCES "HashTag"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashTagSearch" ADD CONSTRAINT "HashTagSearch_searchedById_fkey" FOREIGN KEY ("searchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
