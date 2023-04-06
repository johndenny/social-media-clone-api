/*
  Warnings:

  - The primary key for the `SavedPost` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `SavedPost` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SavedPost" DROP CONSTRAINT "SavedPost_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("savedById", "postId");
