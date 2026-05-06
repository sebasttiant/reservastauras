#!/usr/bin/env bash

set -euo pipefail
umask 077

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
BACKUP_RETENTION=7
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BUNDLE_NAME="tauras-backup-${TIMESTAMP}.tar.gz"
WORK_DIR="$(mktemp -d)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_PAYLOAD="env/.env.gpg"
ENV_PROTECTION="gpg-symmetric"
GPG_PASSPHRASE_MODE=""
GPG_PASSPHRASE_VALUE=""

cleanup() {
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
Usage: scripts/backup.sh

Creates a local PostgreSQL + .env recovery-context bundle.

Environment:
  BACKUP_DIR                 Destination directory. Defaults to PROJECT_ROOT/backups.
  BACKUP_PASSPHRASE          Passphrase for GPG symmetric .env encryption.
  BACKUP_PASSPHRASE_FILE     File containing passphrase for GPG symmetric encryption.
  ALLOW_PLAINTEXT_ENV_BACKUP Explicit insecure opt-in. Set true only for local drills.
  COMPOSE_FILE               Compose file path. Defaults to PROJECT_ROOT/docker-compose.yml.
  DB_SERVICE                 PostgreSQL compose service. Defaults to db.
USAGE
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

compose() {
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_ROOT" "$@"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || fail ".env not found at $ENV_FILE"
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
  done < "$ENV_FILE"
  [[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required in .env"
  [[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required in .env"
}

git_value() {
  git -C "$PROJECT_ROOT" "$@" 2>/dev/null || printf 'unknown'
}

postgres_version() {
  compose exec -T "$DB_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc 'SHOW server_version;' 2>/dev/null || printf 'unknown'
}

write_metadata() {
  local branch commit compose_project pg_version
  branch="$(git_value rev-parse --abbrev-ref HEAD)"
  commit="$(git_value rev-parse HEAD)"
  compose_project="$(basename "$PROJECT_ROOT")"
  pg_version="$(postgres_version)"

  cat > "$WORK_DIR/metadata.json" <<EOF
{
  "timestamp": "$(json_escape "$TIMESTAMP")",
  "created_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project_root": "$(json_escape "$PROJECT_ROOT")",
  "git_branch": "$(json_escape "$branch")",
  "git_commit": "$(json_escape "$commit")",
  "compose_file": "$(json_escape "$COMPOSE_FILE")",
  "compose_project": "$(json_escape "$compose_project")",
  "db_service": "$(json_escape "$DB_SERVICE")",
  "postgres_database": "$(json_escape "$POSTGRES_DB")",
  "postgres_version": "$(json_escape "$pg_version")",
  "dump_filename": "db.dump",
  "env_snapshot_filename": "$(json_escape "$ENV_PAYLOAD")",
  "env_snapshot_protection": "$(json_escape "$ENV_PROTECTION")"
}
EOF
}

write_readme() {
  cat > "$WORK_DIR/README.txt" <<'EOF'
This Tauras backup bundle contains mutable application data only:

- db.dump: PostgreSQL custom-format logical dump.
- env/.env.gpg: GPG-symmetric encrypted environment recovery context.
- metadata.json: source and runtime context.
- SHA256SUMS: integrity checks for bundle payload files.

The .env snapshot is sensitive even when encrypted. Keep this archive private,
with restrictive permissions, and copy it to a trusted off-host location after
creation. If metadata says plaintext-insecure-opt-in, treat the bundle as a raw
secret and rotate credentials after any exposure.
EOF
}

create_dump() {
  printf 'Creating PostgreSQL dump from compose service %s...\n' "$DB_SERVICE"
  compose exec -T "$DB_SERVICE" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$WORK_DIR/db.dump"
}

validate_dump_file() {
  [[ -s "$WORK_DIR/db.dump" ]] || fail "db.dump is empty; refusing to create backup bundle"
  local signature
  signature="$(LC_ALL=C dd if="$WORK_DIR/db.dump" bs=5 count=1 2>/dev/null || true)"
  [[ "$signature" == "PGDMP" ]] || fail "db.dump is not a PostgreSQL custom-format dump"
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

encrypt_env_with_gpg() {
  if [[ "$GPG_PASSPHRASE_MODE" == "fd" ]]; then
    printf '%s' "$GPG_PASSPHRASE_VALUE" | gpg --batch --yes --symmetric --cipher-algo AES256 --pinentry-mode loopback --passphrase-fd 0 --output "$WORK_DIR/env/.env.gpg" "$ENV_FILE"
  else
    gpg --batch --yes --symmetric --cipher-algo AES256 --pinentry-mode loopback --passphrase-file "$GPG_PASSPHRASE_VALUE" --output "$WORK_DIR/env/.env.gpg" "$ENV_FILE"
  fi
}

protect_env_snapshot() {
  mkdir -p "$WORK_DIR/env"

  if [[ "${ALLOW_PLAINTEXT_ENV_BACKUP:-}" == "true" ]]; then
    ENV_PAYLOAD=".env.snapshot"
    ENV_PROTECTION="plaintext-insecure-opt-in"
    printf 'WARNING: storing plaintext .env.snapshot because ALLOW_PLAINTEXT_ENV_BACKUP=true. This bundle contains raw secrets.\n'
    cp "$ENV_FILE" "$WORK_DIR/.env.snapshot"
    chmod 600 "$WORK_DIR/.env.snapshot" 2>/dev/null || true
    return 0
  fi

  command -v gpg >/dev/null 2>&1 || fail "gpg is required to protect .env. Install gpg or set ALLOW_PLAINTEXT_ENV_BACKUP=true for an explicit insecure local-only opt-in."

  set_gpg_passphrase || fail "BACKUP_PASSPHRASE or BACKUP_PASSPHRASE_FILE is required for GPG symmetric .env encryption."

  encrypt_env_with_gpg
  chmod 600 "$WORK_DIR/env/.env.gpg" 2>/dev/null || true
}

write_checksums() {
  (
    cd "$WORK_DIR"
    sha256sum db.dump "$ENV_PAYLOAD" metadata.json README.txt > SHA256SUMS
  )
}

create_bundle() {
  mkdir -p "$BACKUP_DIR"
  [[ -d "$BACKUP_DIR" && -w "$BACKUP_DIR" ]] || fail "BACKUP_DIR is not writable: $BACKUP_DIR"

  local temp_bundle="$BACKUP_DIR/${BUNDLE_NAME}.tmp"
  local final_bundle="$BACKUP_DIR/$BUNDLE_NAME"

  (
    cd "$WORK_DIR"
    tar -czf "$temp_bundle" db.dump "$ENV_PAYLOAD" metadata.json SHA256SUMS README.txt
  )
  chmod 600 "$temp_bundle" 2>/dev/null || true
  mv "$temp_bundle" "$final_bundle"
  if ! validate_bundle "$final_bundle"; then
    rm -f -- "$final_bundle"
    fail "Created backup bundle failed validation; retention was not applied"
  fi
  printf 'Backup bundle created: %s\n' "$final_bundle"
}

validate_bundle() {
  local bundle_path="$1"
  local validation_dir="$WORK_DIR/validate-created-bundle"
  mkdir -p "$validation_dir"
  tar -tzf "$bundle_path" >/dev/null
  tar -xzf "$bundle_path" -C "$validation_dir"
  (
    cd "$validation_dir"
    sha256sum -c SHA256SUMS >/dev/null
  )
  compose exec -T "$DB_SERVICE" pg_restore --list < "$validation_dir/db.dump" >/dev/null
}

apply_retention() {
  shopt -s nullglob
  local bundles=("$BACKUP_DIR"/tauras-backup-*.tar.gz)
  shopt -u nullglob
  (( ${#bundles[@]} > BACKUP_RETENTION )) || return 0

  local sorted=()
  mapfile -d '' sorted < <(printf '%s\0' "${bundles[@]}" | sort -z)
  local delete_count=$(( ${#sorted[@]} - BACKUP_RETENTION ))

  for ((i = 0; i < delete_count; i++)); do
    printf 'Deleting old backup bundle: %s\n' "${sorted[$i]}"
    rm -f -- "${sorted[$i]}"
  done
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  load_env
  create_dump
  validate_dump_file
  protect_env_snapshot
  write_metadata
  write_readme
  write_checksums
  create_bundle
  apply_retention
}

main "$@"
