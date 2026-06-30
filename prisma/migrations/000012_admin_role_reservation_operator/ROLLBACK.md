# Rollback / fix-forward notes — `000012_admin_role_reservation_operator`

This migration adds the PostgreSQL enum value `RESERVATION_OPERATOR` to the
`"AdminRole"` enum type.

## Forward migration

- **Additive only.** It runs `ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS
  'RESERVATION_OPERATOR'`. It does not drop, rename, or reorder existing values,
  so existing admins and their roles are untouched. Idempotent and safe to
  re-run.

## Rollback risk (read before reverting the app)

PostgreSQL does **not** support removing a value from an enum. More importantly,
once any `Admin` row has `role = 'RESERVATION_OPERATOR'`, rolling the
application back to a version whose Prisma schema/client only knows
`SUPER_ADMIN` and `ADMIN` is unsafe:

- The old Prisma client validates DB enum values against its generated enum.
  Reading an `Admin` row whose `role` is `RESERVATION_OPERATOR` can throw at the
  client layer, breaking login/session resolution for that user (and any query
  that selects it).

## Safe rollback / fix-forward procedure

If you must run an older app version, first remove the unknown value from data:

1. Reassign or deactivate every operator before downgrading, e.g.:
   ```sql
   -- Option A: demote to a role the old app understands
   UPDATE "Admin" SET role = 'ADMIN' WHERE role = 'RESERVATION_OPERATOR';

   -- Option B: deactivate instead of demoting (keeps them locked out)
   UPDATE "Admin" SET "isActive" = false WHERE role = 'RESERVATION_OPERATOR';
   ```
2. Only then deploy the older application version.

Do **not** delete or drop this migration to "undo" the change — the enum value
may already be persisted on live rows. Prefer fixing forward (reassigning rows)
over attempting to strip the enum value.
