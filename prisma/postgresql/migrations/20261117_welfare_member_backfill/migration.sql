INSERT INTO "Notification" ("id", "userId", "title", "message", "type", "link", "createdAt")
SELECT md5(u."id" || ':welfare-onboarded'), u."id", 'Staff welfare profile opened',
       'A zero-balance welfare profile is ready. No savings or salary deductions have been made.',
       'INFO', '/welfare', CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" NOT IN ('PARENT', 'LEARNER')
  AND NOT EXISTS (
    SELECT 1 FROM "WelfareMember" wm WHERE wm."userId" = u."id"
  );

INSERT INTO "WelfareMember" ("id", "userId", "totalSavings", "joinedAt", "active")
SELECT md5(u."id" || ':welfare-member'), u."id", 0, CURRENT_TIMESTAMP, TRUE
FROM "User" u
WHERE u."role" NOT IN ('PARENT', 'LEARNER')
  AND NOT EXISTS (
    SELECT 1 FROM "WelfareMember" wm WHERE wm."userId" = u."id"
  );
