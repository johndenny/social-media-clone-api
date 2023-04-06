-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_likeUserId_id_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_likeUserId_id_fkey" FOREIGN KEY ("likeUserId", "id") REFERENCES "MessageLike"("userId", "messageId") ON DELETE CASCADE ON UPDATE CASCADE;
