-- DropForeignKey
ALTER TABLE "CollectedPost" DROP CONSTRAINT "CollectedPost_collectionId_fkey";

-- AddForeignKey
ALTER TABLE "CollectedPost" ADD CONSTRAINT "CollectedPost_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
