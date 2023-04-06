-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_messageId_sentById_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_messageId_sentById_fkey" FOREIGN KEY ("messageId", "sentById") REFERENCES "MessageLike"("messageId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
