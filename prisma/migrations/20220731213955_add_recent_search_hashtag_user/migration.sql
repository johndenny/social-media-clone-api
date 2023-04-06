-- CreateTable
CREATE TABLE "UserSearch" (
    "userId" TEXT NOT NULL,
    "searchedById" TEXT NOT NULL,

    CONSTRAINT "UserSearch_pkey" PRIMARY KEY ("userId","searchedById")
);

-- CreateTable
CREATE TABLE "HashTagSearch" (
    "hashTagId" TEXT NOT NULL,
    "searchedById" TEXT NOT NULL,

    CONSTRAINT "HashTagSearch_pkey" PRIMARY KEY ("hashTagId","searchedById")
);

-- AddForeignKey
ALTER TABLE "UserSearch" ADD CONSTRAINT "UserSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSearch" ADD CONSTRAINT "UserSearch_searchedById_fkey" FOREIGN KEY ("searchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashTagSearch" ADD CONSTRAINT "HashTagSearch_hashTagId_fkey" FOREIGN KEY ("hashTagId") REFERENCES "HashTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashTagSearch" ADD CONSTRAINT "HashTagSearch_searchedById_fkey" FOREIGN KEY ("searchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
