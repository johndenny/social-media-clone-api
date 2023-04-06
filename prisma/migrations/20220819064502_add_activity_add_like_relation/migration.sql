-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_sentById_commentId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_sentById_replyId_fkey";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "commentLikeId" TEXT,
ADD COLUMN     "replyLikeId" TEXT;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_commentLikeId_commentId_fkey" FOREIGN KEY ("commentLikeId", "commentId") REFERENCES "CommentLike"("userId", "commentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_replyLikeId_replyId_fkey" FOREIGN KEY ("replyLikeId", "replyId") REFERENCES "ReplyLike"("userId", "replyId") ON DELETE CASCADE ON UPDATE CASCADE;
