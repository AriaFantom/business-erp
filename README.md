# LayerDreams Panel

Business panel for a 3D-printing / manufacturing operation: product, material and component catalog, production jobs with timers and printers, orders, invoices and quotations with PDF generation, POS with cash sessions, purchasing and supplier payments (AP), AR aging, stock takes, and InfluxDB-backed dashboards.

## Stack

| Layer | Technology |
|---|---|
| Backend | AdonisJS v7 (Node ≥ 24), session auth + Bouncer authorization |
| Frontend | Inertia.js + React 19, Vite, Tailwind v4, shadcn (served by the same AdonisJS process) |
| Database | PostgreSQL 17 (Lucid ORM) |
| Cache / sessions | Redis 7 |
| File storage | MinIO (S3-compatible) — **internal only, never exposed** |
| Metrics | InfluxDB 2 — dashboard trend charts, fed by a daily snapshot job |
| Runtime | Docker Compose, single exposed port |

## Architecture

Only **one** endpoint is ever exposed: the AdonisJS app itself. Postgres, Redis, MinIO, and InfluxDB live on an internal Docker network with **no published host ports**. Every image, file, and PDF is streamed *through* the app with session authentication and per-resource permission checks — the browser never talks to MinIO, and no presigned URLs exist.

```
                        Internet / your network
                                 |
                                 |  (TLS / domain / proxy — your choice,
                                 |   out of scope of this stack)
                                 v
                    host port  APP_BIND (default 127.0.0.1:3333)
                                 |
==================== docker: single published port =====================
                                 |
                                 v
                        +------------------+
                        |   AdonisJS app   |
                        |  (Inertia+React) |
                        |    port 3333     |
                        +--+----+----+---+-+
                           |    |    |   |
         sessions/cache -> |    |    |   | <- metrics (write: daily
        +---------+        |    |    |   |    snapshot job, read: charts)
        |  Redis  | <------+    |    |   +-------------+
        |  :6379  |             |    |                 |
        +---------+             |    |                 v
                                |    |          +------------+
             app data ->        |    |          |  InfluxDB  |
        +------------+          |    |          |   :8086    |
        |  Postgres  | <--------+    |          +------------+
        |   :5432    |               |
        +------------+               | <- S3 API (uploads + streaming
                                     |    downloads, auth-gated by the app)
                              +-------------+
                              |    MinIO    |
                              | :9000/:9001 |
                              +-------------+

        ------- internal `backend` network: NO published host ports -------
```

File serving flow (all routes require a session + the resource's `*.view` permission):

```
  browser --GET /catalog/products/42/image?v=<key>--> app
     app --bouncer.authorize('products.view')--------> allowed?
     app --drive.getStream(imageKey)-----------------> MinIO (internal)
     app <--object bytes------------------------------ MinIO
  browser <--streamed response + Cache-Control-------- app
```

Images get `private, max-age=1y, immutable` (safe: the `?v=` token changes whenever an image is replaced, because storage keys are unique per upload). PDFs and file downloads get `private, no-store`.

## Deployment

### Prerequisites

- Linux server with [Docker Engine](https://docs.docker.com/engine/install/) + the Compose v2 plugin
- Your user able to run docker (`sudo usermod -aG docker $USER`, then re-login)
- `git` (for the `update` command)
- `openssl` (for `./deploy.sh init` secret generation — preinstalled on virtually every distro)

`deploy.sh` checks all of this for you and fails with the exact remediation if something is missing.

### First deploy

```bash
git clone <repo-url> layerdreams-panel && cd layerdreams-panel

./deploy.sh init # generate .env: all secrets auto-created (openssl),
                 # prompts only for APP_URL and APP_BIND

./deploy.sh      # build → pending migrations/seed → start → health check
```

`init` auto-generates `APP_KEY`, the Postgres/Redis/MinIO passwords, and the InfluxDB token; it asks only for the two values it can't guess (`APP_URL`, `APP_BIND`) and writes `.env` with `600` permissions. It refuses to overwrite an existing `.env`. Running `./deploy.sh` without a `.env` offers to run `init` for you. Prefer manual control? `cp .env.production.example .env` and fill it in yourself — `init` is optional.

> **Back up the generated `.env`.** `APP_KEY` and `INFLUX_TOKEN` cannot be regenerated later without invalidating sessions/metrics. `RESEND_API_KEY` (outbound mail) is the one value `init` leaves empty.

Key values in `.env`:

| Variable | Meaning |
|---|---|
| `APP_KEY` | Session/encryption secret. `./deploy.sh init` generates it (or `node ace generate:key` / `openssl rand -base64 32`); never rotate |
| `APP_URL` | Public URL users visit. **No domain required** — `http://192.168.1.50:3333` is fine for a LAN deploy. The scheme matters: `https://` turns on Secure cookies, HSTS, and `upgrade-insecure-requests`; `http://` keeps them off so the app works over plain HTTP |
| `APP_BIND` | Host `interface:port` the app publishes. Default `127.0.0.1:3333` (loopback only). Set `0.0.0.0:3333` or `SERVER_IP:3333` to expose more widely. **This is the only exposed port in the stack.** |
| `DB_HOST` / `REDIS_HOST` | Must stay `postgres` / `redis` (compose service names) — `deploy.sh` rejects `127.0.0.1` |
| `MINIO_ROOT_USER/PASSWORD`, `AWS_*`, `S3_BUCKET` | MinIO credentials; bucket is created automatically on first boot |
| `INFLUX_TOKEN` | Minted as the InfluxDB admin token on **first boot only** — keep it stable forever; changing it later will not re-key the existing volume |
| `INFLUX_INIT_USERNAME/PASSWORD` | First-boot InfluxDB admin credentials |
| `MIGRATE` / `SEED` | Keep `false`; `deploy.sh` runs controlled migrations and production-safe seeders |

`S3_ENDPOINT` and `INFLUX_URL` are intentionally **not** in `.env` — they are pinned inside `docker-compose.prod.yml` to the internal hostnames (`http://minio:9000`, `http://influxdb:8086`) so they can never accidentally point at a public host.

### Day-to-day commands

```bash
./deploy.sh init         # generate .env (secrets auto-created; see above)
./deploy.sh              # build + migrate pending files + seed + verify
./deploy.sh update       # fast-forward Git, re-exec latest script, deploy
./deploy.sh backup       # verified PostgreSQL custom dump + protected .env copy
./deploy.sh build        # build the app image only
./deploy.sh up           # start the stack only
./deploy.sh migrate      # migrate pending files + safe seed + restart/verify
./deploy.sh migrate-only # pending migrations only; no backup or seeders
./deploy.sh logs         # tail app logs
./deploy.sh ps           # stack status
./deploy.sh pull         # git fetch + fast-forward only (no rebuild)
./deploy.sh down         # stop the stack (volumes/data kept)
./deploy.sh nuke         # stop + DELETE all volumes (destroys DB!) — asks for confirmation
```

`deploy.sh pull` and `deploy.sh update` always fast-forward `main`. `ENV_FILE=path/to/other.env ./deploy.sh …` overrides the env file. Set `BACKUP_DIR=/secure/path` to store recovery archives outside the checkout and `HEALTH_TIMEOUT_SECONDS=…` to change the default 90-second health deadline.

Deployments are backup-free by default. To create and verify a database backup before a particular release, use `WITH_BACKUP=true ./deploy.sh update`. For schema changes only against the currently built image, use `./deploy.sh migrate-only`; it applies only migrations still pending in `adonis_schema`, skips every seeder, restarts the app, and verifies health. Default deployments retain application-image rollback but cannot restore the database, so use backward-compatible migrations.

On a server that predates the safe pipeline, first run `./deploy.sh pull`, then `./deploy.sh update`. This ensures the newly pulled script—not the already-running old script—controls the first migration-safe release.

### Safe deployment pipeline

Every full deploy/update performs these steps in order:

1. Retain the current app image for application rollback, then build the new image while the old app stays online.
2. Start/check persistent services. When `WITH_BACKUP=true`, create a verified PostgreSQL custom-format dump plus a mode-`600` `.env` copy before downtime.
3. Stop only the app, run pending migrations in a one-off new-image container, then seed. Fresh databases run all initial seeders; existing databases run only `production_upgrade_seeder`, which may add required defaults/permissions but never replaces business data.
4. Start the new app and require a healthy container. On migration, seed, or health failure, the previous application image is restored when available; the database is never automatically restored because that could erase writes.

Only backward-compatible, expand/contract migrations are safe for automatic application rollback. Never combine destructive column/table removal with the release that stops using that data.

### What deploy.sh validates before touching anything

- docker installed, daemon running (distinguishes "daemon down" from "permission denied"), Compose v2 plugin present
- `.env` exists and every required variable is non-empty
- `DB_HOST`/`REDIS_HOST` are service names, not localhost
- only one deployment/backup runs at once (via `flock`)
- warns on: stale public `S3_ENDPOINT` values, < 2 GB free disk, `APP_BIND` port already in use
- `init` additionally checks `openssl` is available, validates the `APP_URL`/`APP_BIND` you type, and refuses to overwrite an existing `.env`

### Exposing it to the world

The stack deliberately stops at the published port. Point whatever you like at `APP_BIND` — a reverse proxy with TLS, a tunnel, or direct exposure via `APP_BIND=0.0.0.0:3333`. Nothing else (MinIO, Postgres, Redis, InfluxDB) is reachable from outside Docker, so there is nothing else to protect.

### Backups

Automatic archives default to `./backups/` (gitignored) and are never pruned automatically. Copy them off-host and test restores regularly; a backup on the same server is not disaster recovery. `./deploy.sh backup` can be scheduled independently. The PostgreSQL dump covers business data, while uploaded files and metrics remain in the `minio_data` and `influx_data` named volumes and need separate volume-level backups. Never use `./deploy.sh nuke` or `docker compose down -v` during an update.

## Local development

```bash
docker-compose -f docker-compose.dev.yml up -d   # postgres/redis/minio/influx with dev creds
cp .env.dev.example .env                         # match the dev creds
npm install
node ace migration:run && node ace db:seed
npm run dev                                      # HMR backend + Vite frontend
```

Tests: `npm test` (Japa: unit / functional / browser suites). Lint/typecheck: `npm run lint`, `npm run typecheck`.
