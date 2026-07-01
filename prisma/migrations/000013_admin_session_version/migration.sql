-- Deploy-safe: additive column for session revocation. Same idempotent shape as
-- prior column migrations so a re-run or an in-flight release never breaks.
--
--   1. ADD COLUMN IF NOT EXISTS  → no falla si la columna ya existe (re-run).
--   2. SET DEFAULT 0             → fija el default canónico.
--   3. UPDATE ... IS NULL        → backfillea filas viejas a la versión base 0.
--   4. SET NOT NULL              → recién acá la hacemos obligatoria.
--
-- Existing sessions stay valid after deploy: their tokens carry no `sv` and are
-- read as version 0, which matches the backfilled default. The first password
-- change bumps the row past 0 and revokes those tokens.
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER;
ALTER TABLE "Admin" ALTER COLUMN "sessionVersion" SET DEFAULT 0;
UPDATE "Admin" SET "sessionVersion" = 0 WHERE "sessionVersion" IS NULL;
ALTER TABLE "Admin" ALTER COLUMN "sessionVersion" SET NOT NULL;
