#!/usr/bin/env bash
# Deployment helper for docker-compose.prod.yml.
#
# Usage:
#   ./deploy.sh              # build, up, migrate (full deploy)
#   ./deploy.sh update       # git pull + rebuild + up + migrate (redeploy latest)
#   ./deploy.sh build        # build the image
#   ./deploy.sh up           # bring up the stack
#   ./deploy.sh migrate      # run pending migrations
#   ./deploy.sh logs         # tail app logs
#   ./deploy.sh ps           # show stack status
#   ./deploy.sh down         # stop the stack (keeps volumes)
#   ./deploy.sh nuke         # stop + remove volumes (destroys DB)
#
# Env:
#   ENV_FILE=path/to/.env    # override the default ".env"
#   GIT_BRANCH=main          # override the branch to pull (default: current branch)

set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

require_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "✗ ${ENV_FILE} not found. Copy .env.production.example to .env and fill it in." >&2
    exit 1
  fi
}

validate_env() {
  require_env

  local missing=()
  local key
  for key in APP_KEY APP_URL DB_HOST DB_USER DB_PASSWORD DB_DATABASE \
             REDIS_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY \
             S3_BUCKET S3_ENDPOINT MINIO_ROOT_USER MINIO_ROOT_PASSWORD \
             MINIO_BROWSER_REDIRECT_URL; do
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
}

cmd_pull() {
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
cmd_up()      { validate_env; $COMPOSE up -d; }
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

case "${1:-deploy}" in
  build)   cmd_build ;;
  up)      cmd_up ;;
  migrate) cmd_migrate ;;
  logs)    cmd_logs ;;
  ps)      cmd_ps ;;
  pull)    cmd_pull ;;
  down)    cmd_down ;;
  nuke)    cmd_nuke ;;
  deploy)
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
    echo "unknown command: $1" >&2
    sed -n '3,16p' "$0" >&2
    exit 1
    ;;
esac
