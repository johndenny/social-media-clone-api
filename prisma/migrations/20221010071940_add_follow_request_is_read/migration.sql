/*
  Warnings:

  - The primary key for the `FollowRequest` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `userRecieveId` on the `FollowRequest` table. All the data in the column will be lost.
  - Added the required column `userReceiveId` to the `FollowRequest` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FollowRequest" DROP CONSTRAINT "FollowRequest_userRecieveId_fkey";

-- AlterTable
ALTER TABLE "FollowRequest" DROP CONSTRAINT "FollowRequest_pkey",
DROP COLUMN "userRecieveId",
ADD COLUMN     "userReceiveId" TEXT NOT NULL,
ADD CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("userReceiveId", "userRequestId");

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_userReceiveId_fkey" FOREIGN KEY ("userReceiveId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
