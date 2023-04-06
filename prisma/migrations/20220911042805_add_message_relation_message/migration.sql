/*
  Warnings:

  - You are about to drop the column `likeUserId` on the `Message` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_likeUserId_messageId_fkey";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "likeUserId";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
