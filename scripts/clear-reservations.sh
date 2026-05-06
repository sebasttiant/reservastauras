#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
CONFIRMATION_PHRASE="CLEAR RESERVATIONS"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: scripts/clear-reservations.sh

Clears reservation test data from the PostgreSQL database through Docker Compose.

Deletes:
  - Reservation rows
  - User rows left behind by reservation tests

Does NOT delete:
  - Admin users
  - LoginAttempt rows
  - AuditLog rows

Safety:
  Interactive mode requires typing: CLEAR RESERVATIONS
  Automation requires: CONFIRM_CLEAR_RESERVATIONS=true

Environment:
  COMPOSE_FILE                  Compose file path. Defaults to PROJECT_ROOT/docker-compose.yml.
  DB_SERVICE                    PostgreSQL compose service. Defaults to db.
  CONFIRM_CLEAR_RESERVATIONS    Set true to skip interactive prompt.
USAGE
}

compose() {
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_ROOT" "$@"
}

confirm() {
  if [[ "${CONFIRM_CLEAR_RESERVATIONS:-}" == "true" ]]; then
    return 0
  fi

  local answer=""
  printf 'This deletes all Reservation and User rows, but keeps Admins. Type exactly "%s" to continue: ' "$CONFIRMATION_PHRASE" >&2
  read -r answer || fail "Confirmation did not match; database was not modified"
  [[ "$answer" == "$CONFIRMATION_PHRASE" ]] || fail "Confirmation did not match; database was not modified"
}

run_clear_sql() {
  compose exec -T "$DB_SERVICE" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
BEGIN;

WITH before_counts AS (
  SELECT
    (SELECT count(*) FROM "Reservation") AS reservations,
    (SELECT count(*) FROM "User") AS users
)
SELECT 'before' AS phase, reservations, users FROM before_counts;

DELETE FROM "Reservation";
DELETE FROM "User";

WITH after_counts AS (
  SELECT
    (SELECT count(*) FROM "Reservation") AS reservations,
    (SELECT count(*) FROM "User") AS users
)
SELECT 'after' AS phase, reservations, users FROM after_counts;

COMMIT;
SQL
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  [[ -f "$COMPOSE_FILE" ]] || fail "Compose file not found: $COMPOSE_FILE"
  confirm
  run_clear_sql
  printf 'Reservation test data cleared successfully. Admin users were not touched.\n'
}

main "$@"
