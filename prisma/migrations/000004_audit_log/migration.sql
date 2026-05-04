CREATE TABLE "AuditLog" (
  "id"           TEXT NOT NULL,
  "event"        TEXT NOT NULL,
  "actorAdminId" TEXT,
  "actorEmail"   TEXT,
  "actorRole"    "AdminRole",
  "resourceType" TEXT,
  "resourceId"   TEXT,
  "outcome"      TEXT NOT NULL DEFAULT 'SUCCESS',
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_event_createdAt_idx" ON "AuditLog"("event", "createdAt");
CREATE INDEX "AuditLog_actorAdminId_createdAt_idx" ON "AuditLog"("actorAdminId", "createdAt");
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey"
  FOREIGN KEY ("actorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
