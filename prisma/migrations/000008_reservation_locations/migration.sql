-- Deploy-safe foundation for data-driven reservation locations/sedes.
-- `Reservation.area` remains the dining zone/ambiente; `locationId` is the sede.
CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "reservationLabel" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "whatsappUrl" TEXT,
  "logoPath" TEXT,
  "heroImagePath" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Location_slug_key" ON "Location"("slug");
CREATE INDEX IF NOT EXISTS "Location_isActive_sortOrder_idx" ON "Location"("isActive", "sortOrder");

INSERT INTO "Location" (
  "id",
  "slug",
  "name",
  "shortName",
  "reservationLabel",
  "address",
  "phone",
  "whatsappUrl",
  "logoPath",
  "heroImagePath",
  "isActive",
  "sortOrder"
) VALUES (
  'default-location-tauras',
  'tauras-default',
  'TAURAS Steakhouse',
  'TAURAS',
  'TAURAS Steakhouse',
  NULL,
  NULL,
  NULL,
  '/tauras.png',
  NULL,
  true,
  0
) ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "shortName" = EXCLUDED."shortName",
  "reservationLabel" = EXCLUDED."reservationLabel",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder";

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

UPDATE "Reservation"
SET "locationId" = (SELECT "id" FROM "Location" WHERE "slug" = 'tauras-default')
WHERE "locationId" IS NULL;

ALTER TABLE "Reservation" ALTER COLUMN "locationId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_locationId_fkey'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Reservation_locationId_reservationDate_reservationTime_idx"
  ON "Reservation"("locationId", "reservationDate", "reservationTime");
