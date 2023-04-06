/*
  Warnings:

  - Changed the type of `passcode` on the `EmailConfirmation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "EmailConfirmation" DROP COLUMN "passcode",
ADD COLUMN     "passcode" INTEGER NOT NULL;
