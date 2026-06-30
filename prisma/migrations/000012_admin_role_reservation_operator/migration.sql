-- Add the RESERVATION_OPERATOR value to the AdminRole enum.
-- Additive and idempotent: it only extends the enum, never drops or renames an
-- existing value, so existing admins and their roles are untouched. Safe for
-- PostgreSQL 12+ where ALTER TYPE ... ADD VALUE runs inside the migration
-- transaction as long as the new value is not used in the same transaction
-- (this migration does not use it).
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'RESERVATION_OPERATOR';
