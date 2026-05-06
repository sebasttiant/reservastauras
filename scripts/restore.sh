#!/usr/bin/env bash

set -euo pipefail
umask 077

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
WEB_SERVICE="${WEB_SERVICE:-web}"
ENV_FILE="$PROJECT_ROOT/.env"
WORK_DIR="$(mktemp -d)"
RESTORE_DB=0
WEB_STOPPED=0
BUNDLE_PATH=""
ENV_SNAPSHOT_PATH=""
ENV_SNAPSHOT_MODE=""
DECRYPTED_ENV="$WORK_DIR/.env.decrypted"
GPG_PASSPHRASE_MODE=""
GPG_PASSPHRASE_VALUE=""

cleanup() {
  if [[ "$WEB_STOPPED" -eq 1 ]]; then
    docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_ROOT" up -d "$WEB_SERVICE" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
trap 'trap - EXIT; cleanup; exit 130' INT
trap 'trap - EXIT; cleanup; exit 143' TERM

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: scripts/restore.sh BACKUP_BUNDLE [--restore-db]

Verifies a Tauras backup bundle. By default this is a dry-run/verification-only
command and does not modify the database or .env.

Destructive database restore requires --restore-db plus exact confirmation:
RESTORE_CONFIRM="RESTORE <POSTGRES_DB>" or typing RESTORE <POSTGRES_DB>.
USAGE
}

compose() {
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_ROOT" "$@"
}

load_env() {
  local source_env="$ENV_FILE"
  if [[ ! -f "$source_env" && -f "$DECRYPTED_ENV" ]]; then
    source_env="$DECRYPTED_ENV"
  fi
  [[ -f "$source_env" ]] || fail ".env not found at $ENV_FILE and backup env snapshot could not be loaded"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue

    local key="${BASH_REMATCH[1]}"
    local value="${BASH_REMATCH[2]}"
    value="${value%%[[:space:]]#*}"
    value="${value%$'\r'}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    case "$key" in
      POSTGRES_USER|POSTGRES_DB)
        [[ "$value" != *'$'* && "$value" != *'`'* && "$value" != *'('* && "$value" != *')'* && "$value" != *';'* ]] || fail "Invalid .env line for $key: shell syntax is not allowed"
        printf -v "$key" '%s' "$value"
        ;;
    esac
  done < "$source_env"
  [[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required in .env"
  [[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required in .env"
}

parse_args() {
  [[ $# -ge 1 ]] || { usage; exit 2; }
  BUNDLE_PATH="$1"
  shift
  for arg in "$@"; do
    case "$arg" in
      --restore-db)
        RESTORE_DB=1
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $arg"
        ;;
    esac
  done
  [[ -f "$BUNDLE_PATH" ]] || fail "Backup bundle not found: $BUNDLE_PATH"
}

extract_bundle() {
  tar -tzf "$BUNDLE_PATH" >/dev/null
  tar -xzf "$BUNDLE_PATH" -C "$WORK_DIR"
  [[ -f "$WORK_DIR/db.dump" ]] || fail "Bundle is missing db.dump"
  if [[ -f "$WORK_DIR/env/.env.gpg" ]]; then
    ENV_SNAPSHOT_PATH="$WORK_DIR/env/.env.gpg"
    ENV_SNAPSHOT_MODE="gpg-symmetric"
  elif [[ -f "$WORK_DIR/.env.snapshot" ]]; then
    ENV_SNAPSHOT_PATH="$WORK_DIR/.env.snapshot"
    ENV_SNAPSHOT_MODE="plaintext-insecure-opt-in"
  else
    fail "Bundle is missing protected env snapshot: expected env/.env.gpg"
  fi
  [[ -f "$WORK_DIR/metadata.json" ]] || fail "Bundle is missing metadata.json"
  [[ -f "$WORK_DIR/SHA256SUMS" ]] || fail "Bundle is missing SHA256SUMS"
}

verify_checksums() {
  (
    cd "$WORK_DIR"
    sha256sum -c SHA256SUMS
  )
}

show_metadata() {
  printf '\nBackup metadata summary:\n'
  local key
  for key in created_at_utc git_branch git_commit postgres_database postgres_version dump_filename env_snapshot_filename; do
    printf -- '- %s: %s\n' "$key" "$(metadata_value "$key")"
  done
}

metadata_value() {
  local wanted="$1"
  local line regex
  regex='"'"$wanted"'"[[:space:]]*:[[:space:]]*"([^"]*)"'
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ $regex ]]; then
      printf '%s' "${BASH_REMATCH[1]}"
      return 0
    fi
  done < "$WORK_DIR/metadata.json"
  printf 'unknown'
}

set_gpg_passphrase() {
  if [[ -n "${BACKUP_PASSPHRASE_FILE:-}" ]]; then
    [[ -f "$BACKUP_PASSPHRASE_FILE" ]] || fail "BACKUP_PASSPHRASE_FILE does not exist: $BACKUP_PASSPHRASE_FILE"
    GPG_PASSPHRASE_MODE="file"
    GPG_PASSPHRASE_VALUE="$BACKUP_PASSPHRASE_FILE"
    return 0
  fi

  if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
    GPG_PASSPHRASE_MODE="fd"
    GPG_PASSPHRASE_VALUE="$BACKUP_PASSPHRASE"
    return 0
  fi

  return 1
}

decrypt_env_with_gpg() {
  if [[ "$GPG_PASSPHRASE_MODE" == "fd" ]]; then
    printf '%s' "$GPG_PASSPHRASE_VALUE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt --output "$DECRYPTED_ENV" "$ENV_SNAPSHOT_PATH"
  else
    gpg --batch --yes --pinentry-mode loopback --passphrase-file "$GPG_PASSPHRASE_VALUE" --decrypt --output "$DECRYPTED_ENV" "$ENV_SNAPSHOT_PATH"
  fi
}

verify_env_snapshot() {
  if [[ "$ENV_SNAPSHOT_MODE" == "gpg-symmetric" ]]; then
    command -v gpg >/dev/null 2>&1 || fail "gpg is required to verify encrypted env snapshot"
    set_gpg_passphrase || fail "BACKUP_PASSPHRASE or BACKUP_PASSPHRASE_FILE is required to verify encrypted env snapshot"
    decrypt_env_with_gpg
    chmod 600 "$DECRYPTED_ENV" 2>/dev/null || true
    return 0
  fi

  printf 'WARNING: bundle contains plaintext .env.snapshot marked as insecure opt-in.\n' >&2
  cp "$ENV_SNAPSHOT_PATH" "$DECRYPTED_ENV"
  chmod 600 "$DECRYPTED_ENV" 2>/dev/null || true
}

verify_dump_readable() {
  compose exec -T "$DB_SERVICE" pg_restore --list < "$WORK_DIR/db.dump" >/dev/null
}

confirm_destructive_restore() {
  local expected="RESTORE $POSTGRES_DB"
  if [[ "${RESTORE_CONFIRM:-}" == "$expected" ]]; then
    return 0
  fi

  local answer=""
  printf '\nThis will replace database %s. Type exactly "%s" to continue: ' "$POSTGRES_DB" "$expected" >&2
  read -r answer || fail "Confirmation did not match; database was not modified"
  [[ "$answer" == "$expected" ]] || fail "Confirmation did not match; database was not modified"
}

restore_env_snapshot() {
  chmod 600 "$DECRYPTED_ENV" 2>/dev/null || true
  if [[ -f "$ENV_FILE" ]]; then
    local restored="$PROJECT_ROOT/.env.restored.$(date -u +%Y%m%d-%H%M%S)"
    cp "$DECRYPTED_ENV" "$restored"
    chmod 600 "$restored" 2>/dev/null || true
    printf 'Existing .env kept unchanged. Snapshot written to %s for manual comparison.\n' "$restored"
  else
    cp "$DECRYPTED_ENV" "$ENV_FILE"
    chmod 600 "$ENV_FILE" 2>/dev/null || true
    printf 'No .env existed. Restored .env from snapshot with restrictive permissions.\n'
  fi
}

restore_database() {
  local safety_dir="${BACKUP_DIR:-$PROJECT_ROOT/backups}/pre-restore"
  mkdir -p "$safety_dir"
  local safety_dump="$safety_dir/pre-restore-$(date -u +%Y%m%d-%H%M%S).dump"

  printf 'Stopping web service before restore...\n'
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_ROOT" stop "$WEB_SERVICE"
  WEB_STOPPED=1

  printf 'Creating pre-restore safety dump: %s\n' "$safety_dump"
  compose exec -T "$DB_SERVICE" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$safety_dump"
  chmod 600 "$safety_dump" 2>/dev/null || true

  printf 'Restoring PostgreSQL dump into %s...\n' "$POSTGRES_DB"
  compose exec -T "$DB_SERVICE" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --single-transaction --no-owner --no-privileges < "$WORK_DIR/db.dump"

  printf 'Starting web service after restore...\n'
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_ROOT" up -d "$WEB_SERVICE"
  WEB_STOPPED=0
}

main() {
  parse_args "$@"
  extract_bundle
  verify_checksums
  show_metadata
  verify_env_snapshot
  load_env
  verify_dump_readable
  if [[ "$RESTORE_DB" -ne 1 ]]; then
    printf 'Verification completed successfully. Database was not modified. Re-run with --restore-db and exact confirmation to apply.\n'
    exit 0
  fi
  confirm_destructive_restore
  restore_database
  restore_env_snapshot
  printf 'Restore completed successfully.\n'
}

main "$@"
