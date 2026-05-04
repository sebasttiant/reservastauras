CREATE TABLE "LoginAttempt" (
  "id"        TEXT NOT NULL,
  "emailKey"  TEXT NOT NULL,
  "ipKey"     TEXT,
  "success"   BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"    TEXT,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginAttempt_emailKey_createdAt_idx" ON "LoginAttempt"("emailKey", "createdAt");
CREATE INDEX "LoginAttempt_ipKey_createdAt_idx"    ON "LoginAttempt"("ipKey", "createdAt");
CREATE INDEX "LoginAttempt_createdAt_idx"          ON "LoginAttempt"("createdAt");
