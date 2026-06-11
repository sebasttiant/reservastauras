-- Marketing attribution columns for public reservations created from Google Ads
-- or external landing pages. All nullable: existing reservations, admin/manual
-- flows, and links without tracking keep working untouched.
--
-- `landingVenue` stores the public venue alias the visitor entered through
-- (steakhouse | bar-lounge | tex-mex), which may differ from the finally booked
-- location, enabling marketing-entry vs. final-booking comparison.

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "landingVenue" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;

CREATE INDEX IF NOT EXISTS "Reservation_landingVenue_idx" ON "Reservation"("landingVenue");
CREATE INDEX IF NOT EXISTS "Reservation_utmCampaign_idx" ON "Reservation"("utmCampaign");
