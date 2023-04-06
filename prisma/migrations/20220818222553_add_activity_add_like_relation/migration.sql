-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_sentById_commentId_fkey" FOREIGN KEY ("sentById", "commentId") REFERENCES "CommentLike"("userId", "commentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_sentById_replyId_fkey" FOREIGN KEY ("sentById", "replyId") REFERENCES "ReplyLike"("userId", "replyId") ON DELETE CASCADE ON UPDATE CASCADE;
