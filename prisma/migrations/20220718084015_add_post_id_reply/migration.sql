/*
  Warnings:

  - Added the required column `postId` to the `Reply` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "postId" TEXT NOT NULL;
