-- Deploy-safe: la columna se agrega sin romper releases en curso.
--
-- Pasos idempotentes:
--   1. ADD COLUMN IF NOT EXISTS  → no falla si la columna ya existe (re-run).
--   2. SET DEFAULT 'es'          → fija el default canónico aunque la columna
--                                  ya estuviera presente sin default.
--   3. UPDATE ... IS NULL        → backfillea filas viejas si por algún motivo
--                                  quedaron NULL (column agregada sin default
--                                  en otro entorno).
--   4. SET NOT NULL              → recién acá hacemos la columna obligatoria,
--                                  una vez que ya no puede haber NULLs.
--
-- No agregamos un CHECK constraint para `es|en` en MVP: la validación vive en
-- la capa de aplicación (Zod) y queremos poder agregar nuevos idiomas sin
-- migración bloqueante.
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "customerLanguage" TEXT;
ALTER TABLE "Reservation" ALTER COLUMN "customerLanguage" SET DEFAULT 'es';
UPDATE "Reservation" SET "customerLanguage" = 'es' WHERE "customerLanguage" IS NULL;
ALTER TABLE "Reservation" ALTER COLUMN "customerLanguage" SET NOT NULL;
