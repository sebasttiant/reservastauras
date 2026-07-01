#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-$PROJECT_ROOT}"
BRANCH="${BRANCH:-main}"
APP_SERVICE="${APP_SERVICE:-web}"
DB_SERVICE="${DB_SERVICE:-db}"
RUN_DB_BACKUP="${RUN_DB_BACKUP:-true}"
RUN_SEED="${RUN_SEED:-true}"
VERIFY_LOCATIONS="${VERIFY_LOCATIONS:-true}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"

cd "$APP_DIR"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

compose() {
  docker compose "$@"
}

require_clean_tracked_tree() {
  git diff --quiet || fail "Tracked working tree changes found. Commit, stash, or discard them before deploy."
  git diff --cached --quiet || fail "Staged changes found. Commit, stash, or unstage them before deploy."
}

require_no_untracked_conflicts() {
  local incoming_files untracked_files conflicts

  incoming_files="$(git diff --name-only HEAD "origin/$BRANCH" 2>/dev/null || true)"
  untracked_files="$(git ls-files --others --exclude-standard)"
  conflicts="$(comm -12 <(printf '%s\n' "$incoming_files" | sort) <(printf '%s\n' "$untracked_files" | sort))"

  [[ -z "$conflicts" ]] || fail "Untracked files would be overwritten by origin/$BRANCH: $conflicts"
}

create_backup() {
  if [[ "$RUN_DB_BACKUP" != "true" ]]; then
    printf '==> Skipping DB backup because RUN_DB_BACKUP=%s\n' "$RUN_DB_BACKUP"
    return
  fi

  [[ -x "$APP_DIR/scripts/backup.sh" ]] || fail "RUN_DB_BACKUP=true but scripts/backup.sh is missing or not executable"

  printf '==> Creating database backup...\n'
  "$APP_DIR/scripts/backup.sh"
}

wait_for_service_health() {
  local service="$1"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local container_id health_status

  printf '==> Waiting for %s healthcheck...\n' "$service"

  while (( SECONDS < deadline )); do
    container_id="$(compose ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      case "$health_status" in
        healthy|running)
          printf '%s is %s.\n' "$service" "$health_status"
          return
          ;;
        unhealthy|exited|dead)
          compose logs --tail=80 "$service" >&2 || true
          fail "$service is $health_status"
          ;;
      esac
    fi

    sleep 3
  done

  compose logs --tail=80 "$service" >&2 || true
  fail "Timed out waiting for $service healthcheck after ${HEALTH_TIMEOUT_SECONDS}s"
}

printf '==> Checking deployment preconditions...\n'
git fetch origin "$BRANCH"
require_clean_tracked_tree
require_no_untracked_conflicts

create_backup

printf '==> Updating code from origin/%s...\n' "$BRANCH"
git pull --ff-only origin "$BRANCH"

printf '==> Building %s image...\n' "$APP_SERVICE"
compose build --no-cache "$APP_SERVICE"

printf '==> Starting database...\n'
compose up -d "$DB_SERVICE"
wait_for_service_health "$DB_SERVICE"

printf '==> Running Prisma migrations...\n'
compose run --rm --no-deps "$APP_SERVICE" sh -lc './node_modules/.bin/prisma migrate deploy'

if [[ "$RUN_SEED" == "true" ]]; then
  printf '==> Running seed without pnpm reinstall...\n'
  compose run --rm --no-deps "$APP_SERVICE" sh -lc './node_modules/.bin/tsx prisma/seed.ts'
else
  printf '==> Skipping seed because RUN_SEED=%s\n' "$RUN_SEED"
fi

if [[ "$VERIFY_LOCATIONS" == "true" ]]; then
  printf '==> Verifying seeded locations...\n'
  compose exec -T "$DB_SERVICE" sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select slug, name, \"reservationLabel\", \"isActive\", \"sortOrder\" from \"Location\" order by \"sortOrder\";"'
fi

printf '==> Starting application...\n'
compose up -d "$APP_SERVICE"
wait_for_service_health "$APP_SERVICE"

printf '==> Final container status:\n'
compose ps
printf 'Deploy completed successfully.\n'
