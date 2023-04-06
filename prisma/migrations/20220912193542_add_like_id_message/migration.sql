-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_messageId_sentById_fkey";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "likeId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_likeId_sentById_fkey" FOREIGN KEY ("likeId", "sentById") REFERENCES "MessageLike"("messageId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
