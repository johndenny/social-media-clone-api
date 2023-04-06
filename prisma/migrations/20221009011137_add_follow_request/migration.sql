-- CreateTable
CREATE TABLE "FollowRequest" (
    "userRequestId" TEXT NOT NULL,
    "userRecieveId" TEXT NOT NULL,

    CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("userRecieveId","userRequestId")
);

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_userRequestId_fkey" FOREIGN KEY ("userRequestId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_userRecieveId_fkey" FOREIGN KEY ("userRecieveId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
