-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_sentById_postId_fkey";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "likeUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_likeUserId_postId_fkey" FOREIGN KEY ("likeUserId", "postId") REFERENCES "Like"("userId", "postId") ON DELETE CASCADE ON UPDATE CASCADE;
