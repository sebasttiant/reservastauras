-- Deploy-safe audit fields for reservation status changes.
-- Confirmation already stores actor/time; this adds the same accountability to
-- rejection and cancellation, plus an explicit staff reason for formal notices.
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_rejectedById_fkey'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_cancelledById_fkey'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_cancelledById_fkey"
      FOREIGN KEY ("cancelledById") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Reservation_rejectedById_idx" ON "Reservation"("rejectedById");
CREATE INDEX IF NOT EXISTS "Reservation_cancelledById_idx" ON "Reservation"("cancelledById");
