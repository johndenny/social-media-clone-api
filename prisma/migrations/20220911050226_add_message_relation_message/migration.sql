-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_messageId_sentById_fkey" FOREIGN KEY ("messageId", "sentById") REFERENCES "MessageLike"("messageId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
