INSERT INTO "Notification" ("id", "userId", "title", "message", "type", "link", "createdAt")
SELECT lower(hex(randomblob(16))), u."id", 'Staff welfare profile opened',
       'A zero-balance welfare profile is ready. No savings or salary deductions have been made.',
       'INFO', '/welfare', CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" NOT IN ('PARENT', 'LEARNER')
  AND NOT EXISTS (
    SELECT 1 FROM "WelfareMember" wm WHERE wm."userId" = u."id"
  );

INSERT INTO "WelfareMember" ("id", "userId", "totalSavings", "joinedAt", "active")
SELECT lower(hex(randomblob(16))), u."id", 0, CURRENT_TIMESTAMP, 1
FROM "User" u
WHERE u."role" NOT IN ('PARENT', 'LEARNER')
  AND NOT EXISTS (
    SELECT 1 FROM "WelfareMember" wm WHERE wm."userId" = u."id"
  );
