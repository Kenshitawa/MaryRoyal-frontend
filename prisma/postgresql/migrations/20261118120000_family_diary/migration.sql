CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiaryReply" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiaryReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiaryEntry_learnerId_createdAt_idx" ON "DiaryEntry"("learnerId", "createdAt");
CREATE INDEX "DiaryEntry_authorId_createdAt_idx" ON "DiaryEntry"("authorId", "createdAt");
CREATE INDEX "DiaryReply_entryId_createdAt_idx" ON "DiaryReply"("entryId", "createdAt");

ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiaryReply" ADD CONSTRAINT "DiaryReply_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryReply" ADD CONSTRAINT "DiaryReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiaryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiaryReply" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "DiaryEntry", "DiaryReply" FROM PUBLIC, anon, authenticated;
