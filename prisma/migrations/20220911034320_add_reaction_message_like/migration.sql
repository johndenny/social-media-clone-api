/*
  Warnings:

  - Added the required column `reaction` to the `MessageLike` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MessageLike" ADD COLUMN     "reaction" TEXT NOT NULL;
