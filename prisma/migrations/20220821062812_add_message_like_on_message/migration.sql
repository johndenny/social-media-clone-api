-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "likeUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_likeUserId_id_fkey" FOREIGN KEY ("likeUserId", "id") REFERENCES "MessageLike"("userId", "messageId") ON DELETE RESTRICT ON UPDATE CASCADE;
