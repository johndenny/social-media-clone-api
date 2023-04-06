/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `RecentSearch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hashTagId]` on the table `RecentSearch` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RecentSearch_userId_key" ON "RecentSearch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecentSearch_hashTagId_key" ON "RecentSearch"("hashTagId");
