/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `EmailConfirmation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "EmailConfirmation_email_key" ON "EmailConfirmation"("email");
