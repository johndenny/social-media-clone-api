-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_likeUserId_id_fkey";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "messageId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_likeUserId_messageId_fkey" FOREIGN KEY ("likeUserId", "messageId") REFERENCES "MessageLike"("userId", "messageId") ON DELETE CASCADE ON UPDATE CASCADE;
