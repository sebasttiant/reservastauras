-- Deploy-safe support for admin-created reservations.
--
-- `source` is TEXT instead of a DB enum so new commercial channels can be
-- added through app validation without a blocking database enum migration.
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Reservation" ALTER COLUMN "source" SET DEFAULT 'web';
UPDATE "Reservation" SET "source" = 'web' WHERE "source" IS NULL;
ALTER TABLE "Reservation" ALTER COLUMN "source" SET NOT NULL;

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "createdByAdminId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Reservation_source_idx" ON "Reservation"("source");
CREATE INDEX IF NOT EXISTS "Reservation_createdByAdminId_idx" ON "Reservation"("createdByAdminId");
