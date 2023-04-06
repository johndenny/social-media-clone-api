/*
  Warnings:

  - A unique constraint covering the columns `[lastestMessageId]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "lastestMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_lastestMessageId_key" ON "Chat"("lastestMessageId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_lastestMessageId_fkey" FOREIGN KEY ("lastestMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
