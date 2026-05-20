-- Zone model for admin-managed preview photos per location area value.
-- One Zone row per (locationId, areaValue) pair; imagePath is null until
-- a super-admin uploads a photo via the admin settings UI.

CREATE TABLE IF NOT EXISTS "Zone" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "areaValue" TEXT NOT NULL,
  "imagePath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Zone_locationId_areaValue_key" ON "Zone"("locationId", "areaValue");
CREATE INDEX IF NOT EXISTS "Zone_locationId_idx" ON "Zone"("locationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Zone_locationId_fkey'
  ) THEN
    ALTER TABLE "Zone"
      ADD CONSTRAINT "Zone_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
