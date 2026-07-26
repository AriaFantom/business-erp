#!/usr/bin/env bash
# Deployment helper for docker-compose.prod.yml.
#
# Usage:
#   ./deploy.sh              # build, migrate, seed, start, verify
#   ./deploy.sh init         # generate .env: auto-created secrets + prompts
#   ./deploy.sh update       # git pull, then run the safe deployment pipeline
#   ./deploy.sh backup       # create and verify a PostgreSQL backup
#   ./deploy.sh build        # build the image
#   ./deploy.sh up           # bring up the stack
#   ./deploy.sh migrate      # migrate, production-seed, restart
#   ./deploy.sh migrate-only # pending migrations only; no backup or seeding
#   ./deploy.sh logs         # tail app logs
#   ./deploy.sh ps           # show stack status
#   ./deploy.sh pull         # git fetch + fast-forward the current branch
#   ./deploy.sh down         # stop the stack (keeps volumes)
#   ./deploy.sh nuke         # stop + remove volumes (destroys DB)
#
# Env expectations (.env — run `./deploy.sh init` to generate it, or copy
# .env.production.example and fill it in by hand):
#   - The app is the ONLY service that publishes a host port; APP_BIND controls
#     the interface:port (default 127.0.0.1:3333, loopback only).
#   - MinIO and InfluxDB are internal-only: no host ports, no public URLs.
#     S3_ENDPOINT / INFLUX_URL are pinned in the compose file, not in .env.
#   - Required InfluxDB vars: INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET,
#     INFLUX_INIT_USERNAME, INFLUX_INIT_PASSWORD.
#
# Env:
#   ENV_FILE=path/to/.env    # override the default ".env"
#   GIT_BRANCH=main          # override the branch to pull (default: current branch)
#   BACKUP_DIR=./backups     # host directory for verified DB + env backups
#   HEALTH_TIMEOUT_SECONDS=90
#   WITH_BACKUP=true         # opt in to backup before deploy/update/migrate

set -euo pipefail
umask 077

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"
WITH_BACKUP="${WITH_BACKUP:-false}"
ROLLBACK_IMAGE_TAG="layerdreams-panel-rollback:previous"
ROLLBACK_IMAGE_NAME=""
LAST_BACKUP_PATH=""

# deploy.sh owns schema changes. Force the regular app entrypoint flags off so
# legacy .env files with MIGRATE/SEED=true cannot run broad seeders implicitly.
compose() {
  MIGRATE=false SEED=false docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"
}

# Verify the docker toolchain is present and usable. Called at the start of
# every command that touches docker. Fails fast with actionable remediation.
preflight() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "✗ docker is not installed or not on PATH." >&2
    echo "  Install Docker Engine: https://docs.docker.com/engine/install/" >&2
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    # Distinguish "daemon down" from "permission denied" by inspecting stderr.
    local err
    err="$(docker info 2>&1 >/dev/null || true)"
    if echo "$err" | grep -qiE "permission denied|dial unix.*permission"; then
      echo "✗ cannot talk to the docker daemon: permission denied." >&2
      echo "  Add your user to the docker group, then re-login:" >&2
      echo "    sudo usermod -aG docker $USER" >&2
    else
      echo "✗ the docker daemon is not responding (is it running?)." >&2
      echo "  Start it: sudo systemctl start docker" >&2
    fi
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "✗ the docker compose v2 plugin is not available." >&2
    echo "  Install it: https://docs.docker.com/compose/install/" >&2
    exit 1
  fi

  check_disk_space
}

# Warn (non-fatal) if the compose directory filesystem has < 2GB free. Image
# builds and volumes can fill a small disk quickly.
check_disk_space() {
  local avail_kb
  avail_kb="$(df -Pk . 2>/dev/null | awk 'NR==2 {print $4}')" || return 0
  [[ -n "$avail_kb" ]] || return 0
  if (( avail_kb < 2 * 1024 * 1024 )); then
    local avail_mb=$(( avail_kb / 1024 ))
    echo "⚠ only ${avail_mb}MB free on this filesystem (< 2GB)." >&2
    echo "  Image builds and volumes may fail. Free up space before deploying." >&2
  fi
}

# Warn (non-fatal) if the APP_BIND host port is already bound by a foreign
# process. This stack's own container re-binding on redeploy is fine, so this
# is only a heads-up, never fatal.
check_port_free() {
  command -v ss >/dev/null 2>&1 || return 0   # no ss → skip gracefully
  local bind port
  bind="$(grep -E "^APP_BIND=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"'"'"' ')"
  bind="${bind:-127.0.0.1:3333}"
  port="${bind##*:}"
  [[ "$port" =~ ^[0-9]+$ ]] || return 0
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$"; then
    echo "⚠ host port ${port} (APP_BIND=${bind}) already appears to be in use." >&2
    echo "  If that's this stack's own container, ignore this. Otherwise free" >&2
    echo "  the port or set a different APP_BIND before 'up'." >&2
  fi
}

require_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "✗ ${ENV_FILE} not found. Run './deploy.sh init' to generate it (or copy" >&2
    echo "  .env.production.example and fill it in by hand)." >&2
    exit 1
  fi
}

# Replace `KEY=<anything>` (including a trailing comment) with `KEY=VALUE` in
# the env file being generated. `|` is the sed delimiter, so it never collides
# with base64 (`+ / =`) or URL characters in the value.
set_env_var() {
  local key="$1" value="$2"
  sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
}

# Prompt with a default. Falls back to the default when stdin is not
# interactive (piped/CI) so init never hangs or aborts under `set -e`.
prompt_with_default() {
  local label="$1" def="$2" answer=""
  read -rp "${label} [${def}]: " answer || true
  echo "${answer:-$def}"
}

cmd_init() {
  if ! command -v openssl >/dev/null 2>&1; then
    echo "✗ openssl is required to generate secrets but is not on PATH." >&2
    echo "  Install it (e.g. sudo apt install openssl) and re-run init." >&2
    exit 1
  fi
  if [[ ! -f .env.production.example ]]; then
    echo "✗ .env.production.example not found — cannot generate ${ENV_FILE}." >&2
    exit 1
  fi
  if [[ -f "$ENV_FILE" ]]; then
    echo "✗ ${ENV_FILE} already exists — refusing to overwrite it (it holds the" >&2
    echo "  APP_KEY and INFLUX_TOKEN your running data depends on)." >&2
    echo "  Move it away first if you really want a fresh one:" >&2
    echo "    mv ${ENV_FILE} ${ENV_FILE}.backup-\$(date +%s)" >&2
    exit 1
  fi

  echo "→ Generating ${ENV_FILE} from .env.production.example"
  echo "  Secrets are generated with openssl; press Enter to accept defaults."
  echo

  # -- The only two values worth asking about -----------------------------
  local app_url app_bind
  while :; do
    app_url="$(prompt_with_default 'APP_URL (public URL users will visit)' 'https://panel.layerdreams.com')"
    [[ "$app_url" =~ ^https?://[^[:space:]|\&\;]+$ ]] && break
    echo "  ✗ must look like https://host — try again." >&2
  done
  while :; do
    app_bind="$(prompt_with_default 'APP_BIND (host interface:port to publish; 0.0.0.0:3333 = all interfaces)' '127.0.0.1:3333')"
    [[ "$app_bind" =~ ^[A-Za-z0-9._-]+:[0-9]+$ ]] && break
    echo "  ✗ must look like interface:port (e.g. 127.0.0.1:3333) — try again." >&2
  done

  # -- Everything secret is generated, never asked ------------------------
  local app_key db_password redis_password minio_user minio_password
  local influx_token influx_init_password
  app_key="$(openssl rand -base64 32)"
  db_password="$(openssl rand -hex 24)"
  redis_password="$(openssl rand -hex 24)"
  minio_user="layerdreams_$(openssl rand -hex 4)"
  minio_password="$(openssl rand -hex 24)"
  influx_token="$(openssl rand -hex 32)"
  influx_init_password="$(openssl rand -hex 16)"

  cp .env.production.example "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  set_env_var APP_URL "$app_url"
  set_env_var APP_BIND "$app_bind"
  set_env_var APP_KEY "$app_key"
  set_env_var DB_PASSWORD "$db_password"
  set_env_var REDIS_PASSWORD "$redis_password"
  set_env_var MINIO_ROOT_USER "$minio_user"
  set_env_var MINIO_ROOT_PASSWORD "$minio_password"
  # Simplest working setup: the app talks to MinIO with the root credentials.
  # Swap in a scoped MinIO service account later if you want tighter access.
  set_env_var AWS_ACCESS_KEY_ID "$minio_user"
  set_env_var AWS_SECRET_ACCESS_KEY "$minio_password"
  set_env_var INFLUX_TOKEN "$influx_token"
  set_env_var INFLUX_INIT_PASSWORD "$influx_init_password"

  echo
  echo "✓ ${ENV_FILE} written (permissions 600)."
  echo "  Generated: APP_KEY, DB_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_USER/PASSWORD,"
  echo "             AWS keys (= MinIO creds), INFLUX_TOKEN, INFLUX_INIT_PASSWORD"
  echo "  Set:       APP_URL=${app_url}  APP_BIND=${app_bind}"
  echo
  echo "⚠ Back up ${ENV_FILE} somewhere safe. APP_KEY and INFLUX_TOKEN cannot be"
  echo "  regenerated later without breaking sessions/metrics."
  echo "⚠ RESEND_API_KEY is still empty — fill it in if the app should send mail."
  echo
  echo "Next: ./deploy.sh"
}

# Used by the full-deploy path when no env file exists yet: offer to generate
# one instead of failing. Declining falls through to the normal error.
offer_init() {
  [[ -f "$ENV_FILE" ]] && return 0
  echo "No ${ENV_FILE} found."
  local ans=""
  read -rp "Generate it now with './deploy.sh init'? [y/N]: " ans || true
  if [[ "${ans:-}" =~ ^[Yy]$ ]]; then
    cmd_init
  else
    require_env
  fi
}

validate_env() {
  require_env

  local missing=()
  local key
  for key in APP_KEY APP_URL DB_HOST DB_USER DB_PASSWORD DB_DATABASE \
             REDIS_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY \
             S3_BUCKET MINIO_ROOT_USER MINIO_ROOT_PASSWORD \
             INFLUX_TOKEN INFLUX_ORG INFLUX_BUCKET \
             INFLUX_INIT_USERNAME INFLUX_INIT_PASSWORD; do
    if ! grep -qE "^${key}=.+" "$ENV_FILE"; then
      missing+=("$key")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    echo "✗ ${ENV_FILE} is missing values for: ${missing[*]}" >&2
    exit 1
  fi

  # The single most common deployment bug: copying dev .env to prod and leaving
  # DB_HOST=127.0.0.1. Inside the container, that resolves to the container
  # itself, not the postgres service.
  if grep -qE "^DB_HOST=(127\.0\.0\.1|localhost)" "$ENV_FILE"; then
    echo "✗ DB_HOST is 127.0.0.1/localhost in ${ENV_FILE}." >&2
    echo "  Inside the docker network it must be 'postgres' (the service name)." >&2
    exit 1
  fi
  if grep -qE "^REDIS_HOST=(127\.0\.0\.1|localhost)" "$ENV_FILE"; then
    echo "✗ REDIS_HOST is 127.0.0.1/localhost in ${ENV_FILE}." >&2
    echo "  Inside the docker network it must be 'redis' (the service name)." >&2
    exit 1
  fi

  # MinIO is internal-only now: the app streams all file access, and the compose
  # file pins S3_ENDPOINT to http://minio:9000. A leftover public-looking value
  # in .env is ignored but signals a stale config — warn so it gets cleaned up.
  if grep -qE "^S3_ENDPOINT=.+" "$ENV_FILE" \
     && ! grep -qE "^S3_ENDPOINT=http://minio:9000/?\$" "$ENV_FILE"; then
    echo "⚠ S3_ENDPOINT is set in ${ENV_FILE} to a non-internal value." >&2
    echo "  MinIO is internal-only now; docker-compose.prod.yml pins" >&2
    echo "  S3_ENDPOINT=http://minio:9000 and this .env value is ignored." >&2
    echo "  Remove it from ${ENV_FILE} to avoid confusion." >&2
  fi
}

acquire_deploy_lock() {
  if ! command -v flock >/dev/null 2>&1; then
    echo "✗ flock is required to prevent concurrent deployments." >&2
    exit 1
  fi
  mkdir -p tmp
  exec 9>tmp/deploy.lock
  if ! flock -n 9; then
    echo "✗ another deployment or backup is already running." >&2
    exit 1
  fi
}

wait_postgres() {
  echo "→ Waiting for PostgreSQL…"
  for _ in {1..30}; do
    if compose exec -T postgres sh -c \
      'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "✗ PostgreSQL did not become ready within 60 seconds." >&2
  return 1
}

start_infrastructure() {
  echo "→ Starting persistent infrastructure…"
  compose up -d postgres redis minio influxdb createbuckets
  wait_postgres
}

# Returns 0 for an existing application schema, 1 for a fresh database, and 2
# when the probe itself fails. Callers must distinguish fresh from probe errors.
database_initialized() {
  local result
  if ! result="$(compose exec -T postgres sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT to_regclass('\''public.users'\'') IS NOT NULL"' \
    2>/dev/null)"; then
    return 2
  fi
  result="$(echo "$result" | tr -d '[:space:]')"
  case "$result" in
    t) return 0 ;;
    f) return 1 ;;
    *) return 2 ;;
  esac
}

validate_backup_dir() {
  if [[ -z "$BACKUP_DIR" || "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "." ]]; then
    echo "✗ BACKUP_DIR must be a dedicated directory, not '${BACKUP_DIR}'." >&2
    return 1
  fi
  mkdir -p -- "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
}

backup_database() {
  validate_backup_dir

  local timestamp revision basename partial env_copy
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  revision="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  basename="postgres-${timestamp}-${revision}"
  LAST_BACKUP_PATH="${BACKUP_DIR%/}/${basename}.dump"
  partial="${LAST_BACKUP_PATH}.partial"
  env_copy="${BACKUP_DIR%/}/${basename}.env"

  if [[ -e "$LAST_BACKUP_PATH" || -e "$partial" ]]; then
    echo "✗ refusing to overwrite an existing backup for ${timestamp}." >&2
    return 1
  fi

  echo "→ Backing up PostgreSQL to ${LAST_BACKUP_PATH}…"
  if ! compose exec -T postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' >"$partial"; then
    rm -f -- "$partial"
    echo "✗ pg_dump failed; deployment has not touched the application." >&2
    return 1
  fi

  if [[ ! -s "$partial" ]] || \
    ! compose exec -T postgres pg_restore --list <"$partial" >/dev/null; then
    rm -f -- "$partial"
    echo "✗ backup verification failed; deployment has been aborted." >&2
    return 1
  fi

  mv -- "$partial" "$LAST_BACKUP_PATH"
  chmod 600 "$LAST_BACKUP_PATH"
  cp -- "$ENV_FILE" "$env_copy"
  chmod 600 "$env_copy"
  echo "✓ Verified database backup and protected env copy created."
}

capture_rollback_image() {
  ROLLBACK_IMAGE_NAME=""
  if ! docker inspect layerdreams-app >/dev/null 2>&1; then
    return 0
  fi

  local image_id
  image_id="$(docker inspect --format '{{.Image}}' layerdreams-app)"
  ROLLBACK_IMAGE_NAME="$(docker inspect --format '{{.Config.Image}}' layerdreams-app)"
  docker image tag "$image_id" "$ROLLBACK_IMAGE_TAG"
  echo "✓ Previous app image retained as ${ROLLBACK_IMAGE_TAG}."
}

rollback_application() {
  if [[ -z "$ROLLBACK_IMAGE_NAME" ]] || \
    ! docker image inspect "$ROLLBACK_IMAGE_TAG" >/dev/null 2>&1; then
    echo "⚠ no previous application image is available for automatic rollback." >&2
    return 1
  fi

  echo "→ Restoring the previous application image (database is left intact)…" >&2
  compose rm -sf app >/dev/null 2>&1 || true
  docker image tag "$ROLLBACK_IMAGE_TAG" "$ROLLBACK_IMAGE_NAME"
  compose up -d --no-build app
  if wait_healthy; then
    echo "✓ Previous application restored. Fix the release, then redeploy." >&2
    return 0
  fi
  echo "✗ previous application also failed its health check." >&2
  return 1
}

run_production_seeders() {
  local database_was_initialized="$1"
  if [[ "$database_was_initialized" == "false" ]]; then
    echo "→ Fresh database detected; running initial seeders…"
    compose run --rm --no-deps app node ace db:seed
  else
    echo "→ Running additive production upgrade seeder…"
    compose run --rm --no-deps app node ace db:seed \
      --files ./database/seeders/production_upgrade_seeder.js
  fi
}

run_schema_upgrade() {
  local backup_required="${1:-true}"
  local seed_required="${2:-true}"

  start_infrastructure

  local initialized_status=0 database_was_initialized=true
  if [[ "$seed_required" == "true" ]]; then
    database_initialized || initialized_status=$?
    case "$initialized_status" in
      0) database_was_initialized=true ;;
      1) database_was_initialized=false ;;
      *)
        echo "✗ could not determine whether the database is initialized." >&2
        return 1
        ;;
    esac
  fi

  if [[ "$backup_required" == "true" ]]; then
    backup_database
  else
    LAST_BACKUP_PATH=""
    echo "⚠ BACKUP SKIPPED: database changes will have no automatic recovery point." >&2
  fi
  compose stop app >/dev/null 2>&1 || true

  echo "→ Running pending migrations before the new app starts…"
  if ! compose run --rm --no-deps app node ace migration:run --force; then
    echo "✗ migration failed; no restore was attempted because it could erase data." >&2
    rollback_application || true
    return 1
  fi

  if [[ "$seed_required" == "true" ]]; then
    if ! run_production_seeders "$database_was_initialized"; then
      echo "✗ production seeding failed." >&2
      rollback_application || true
      return 1
    fi
  else
    echo "→ Seeders skipped; only pending migration files were applied."
  fi

  check_port_free
  echo "→ Starting the migrated application…"
  if ! compose up -d app; then
    echo "✗ the migrated application could not be started." >&2
    rollback_application || true
    return 1
  fi
  if ! wait_healthy; then
    compose logs --tail=100 app >&2 || true
    rollback_application || true
    return 1
  fi

  compose exec -T app node ace migration:status
  if [[ -n "$LAST_BACKUP_PATH" ]]; then
    echo "✓ Deployment complete. Recovery backup: ${LAST_BACKUP_PATH}"
  else
    echo "✓ Migration completed without a database backup."
  fi
}

cmd_pull() {
  if ! command -v git >/dev/null 2>&1; then
    echo "✗ git is not installed or not on PATH — cannot pull." >&2
    echo "  Install git: https://git-scm.com/downloads" >&2
    exit 1
  fi
  if [[ ! -d .git ]]; then
    echo "✗ not a git checkout — cannot pull." >&2
    exit 1
  fi
  local branch="${GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  echo "→ Fetching origin and fast-forwarding ${branch}…"
  git fetch --prune origin
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "✗ working tree has local changes. Commit/stash before updating." >&2
    git status --short >&2
    exit 1
  fi
  git checkout "$branch"
  git pull --ff-only origin "$branch"
}

cmd_build()   { validate_env; compose build; }
cmd_up()      { validate_env; check_port_free; compose up -d; }
cmd_logs()    { compose logs -f --tail=200 app; }
cmd_ps()      { compose ps; }
cmd_down()    { compose down; }

cmd_backup() {
  acquire_deploy_lock
  validate_env
  start_infrastructure
  backup_database
}

cmd_migrate() {
  acquire_deploy_lock
  validate_env
  capture_rollback_image
  run_schema_upgrade "$WITH_BACKUP" true
}

cmd_migrate_only() {
  acquire_deploy_lock
  validate_env
  capture_rollback_image
  run_schema_upgrade false false
}

cmd_deploy() {
  acquire_deploy_lock
  offer_init
  validate_env
  capture_rollback_image
  cmd_build
  run_schema_upgrade "$WITH_BACKUP" true
  cmd_ps
}

cmd_update() {
  cmd_pull
  # Re-exec so an update to deploy.sh itself takes effect in this deployment.
  exec "$0" deploy
}

cmd_nuke()    {
  read -rp "This will delete the postgres, redis, minio, and influx volumes. Type 'yes' to confirm: " ans
  [[ "$ans" == "yes" ]] || { echo "aborted"; exit 1; }
  compose down -v
}

wait_healthy() {
  echo "→ Waiting for app health…"
  if [[ ! "$HEALTH_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
    echo "✗ HEALTH_TIMEOUT_SECONDS must be a positive integer." >&2
    return 1
  fi

  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS)) status
  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{.State.Health.Status}}' layerdreams-app 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then return 0; fi
    sleep 2
  done
  echo "✗ app did not become healthy within ${HEALTH_TIMEOUT_SECONDS} seconds." >&2
  return 1
}

cmd="${1:-deploy}"

# Every real command needs a working docker toolchain. `init` only needs
# openssl (checked inside), and the usage/help fallback (unknown command) must
# NOT run preflight so `./deploy.sh --help` still works without docker.
case "$cmd" in
  backup|build|up|migrate|migrate-only|logs|ps|pull|down|nuke|deploy|update) preflight ;;
esac

if [[ "$WITH_BACKUP" != "true" && "$WITH_BACKUP" != "false" ]]; then
  echo "✗ WITH_BACKUP must be either 'true' or 'false'." >&2
  exit 1
fi

case "$cmd" in
  init)    cmd_init ;;
  backup)  cmd_backup ;;
  build)   cmd_build ;;
  up)      cmd_up ;;
  migrate) cmd_migrate ;;
  migrate-only) cmd_migrate_only ;;
  logs)    cmd_logs ;;
  ps)      cmd_ps ;;
  pull)    cmd_pull ;;
  down)    cmd_down ;;
  nuke)    cmd_nuke ;;
  deploy)  cmd_deploy ;;
  update)  cmd_update ;;
  help|-h|--help)
    sed -n '3,18p' "$0"
    ;;
  *)
    echo "unknown command: $cmd" >&2
    sed -n '3,16p' "$0" >&2
    exit 1
    ;;
esac
