#!/usr/bin/env bash
# Deployment helper for docker-compose.prod.yml.
#
# Usage:
#   ./deploy.sh              # build, up, migrate (full deploy)
#   ./deploy.sh init         # generate .env: auto-created secrets + prompts
#   ./deploy.sh update       # git pull + rebuild + up + migrate (redeploy latest)
#   ./deploy.sh build        # build the image
#   ./deploy.sh up           # bring up the stack
#   ./deploy.sh migrate      # run pending migrations
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

set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

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

cmd_build()   { validate_env; $COMPOSE build; }
cmd_up()      { validate_env; check_port_free; $COMPOSE up -d; }
cmd_migrate() { validate_env; $COMPOSE exec app node ace migration:run --force; }
cmd_logs()    { $COMPOSE logs -f --tail=200 app; }
cmd_ps()      { $COMPOSE ps; }
cmd_down()    { $COMPOSE down; }
cmd_nuke()    {
  read -rp "This will delete the postgres, redis, and minio volumes. Type 'yes' to confirm: " ans
  [[ "$ans" == "yes" ]] || { echo "aborted"; exit 1; }
  $COMPOSE down -v
}

wait_healthy() {
  echo "→ Waiting for app health…"
  for i in {1..30}; do
    if $COMPOSE ps app | grep -q "(healthy)"; then return 0; fi
    sleep 2
  done
  echo "✗ app did not become healthy in time. Check './deploy.sh logs'." >&2
  return 1
}

cmd="${1:-deploy}"

# Every real command needs a working docker toolchain. `init` only needs
# openssl (checked inside), and the usage/help fallback (unknown command) must
# NOT run preflight so `./deploy.sh --help` still works without docker.
case "$cmd" in
  build|up|migrate|logs|ps|pull|down|nuke|deploy|update) preflight ;;
esac

case "$cmd" in
  init)    cmd_init ;;
  build)   cmd_build ;;
  up)      cmd_up ;;
  migrate) cmd_migrate ;;
  logs)    cmd_logs ;;
  ps)      cmd_ps ;;
  pull)    cmd_pull ;;
  down)    cmd_down ;;
  nuke)    cmd_nuke ;;
  deploy)
    offer_init
    cmd_build
    cmd_up
    wait_healthy || true
    cmd_migrate
    cmd_ps
    ;;
  update)
    cmd_pull
    cmd_build
    cmd_up
    wait_healthy || true
    cmd_migrate
    cmd_ps
    echo "✓ update complete"
    ;;
  *)
    echo "unknown command: $cmd" >&2
    sed -n '3,16p' "$0" >&2
    exit 1
    ;;
esac
