-- CreateTable
CREATE TABLE "_hiddenUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_hiddenUsers_AB_unique" ON "_hiddenUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_hiddenUsers_B_index" ON "_hiddenUsers"("B");

-- AddForeignKey
ALTER TABLE "_hiddenUsers" ADD CONSTRAINT "_hiddenUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_hiddenUsers" ADD CONSTRAINT "_hiddenUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
