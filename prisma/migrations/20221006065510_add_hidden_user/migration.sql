/*
  Warnings:

  - You are about to drop the `_hiddenUsers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_hiddenUsers" DROP CONSTRAINT "_hiddenUsers_A_fkey";

-- DropForeignKey
ALTER TABLE "_hiddenUsers" DROP CONSTRAINT "_hiddenUsers_B_fkey";

-- DropTable
DROP TABLE "_hiddenUsers";

-- CreateTable
CREATE TABLE "HiddenUser" (
    "userId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,

    CONSTRAINT "HiddenUser_pkey" PRIMARY KEY ("userId","viewerId")
);

-- AddForeignKey
ALTER TABLE "HiddenUser" ADD CONSTRAINT "HiddenUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenUser" ADD CONSTRAINT "HiddenUser_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
