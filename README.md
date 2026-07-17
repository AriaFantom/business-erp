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

`deploy.sh` checks all of this for you and fails with the exact remediation if something is missing.

### First deploy

```bash
git clone <repo-url> layerdreams-panel && cd layerdreams-panel

./deploy.sh init # generate .env: all secrets auto-created (openssl),
                 # prompts only for APP_URL and APP_BIND

./deploy.sh      # build image, start stack, wait healthy, run migrations
```

`init` auto-generates `APP_KEY`, the Postgres/Redis/MinIO passwords, and the InfluxDB token; it asks only for the two values it can't guess (`APP_URL`, `APP_BIND`) and writes `.env` with `600` permissions. It refuses to overwrite an existing `.env`. Running `./deploy.sh` without a `.env` offers to run `init` for you. Prefer manual control? `cp .env.production.example .env` and fill it in yourself — `init` is optional.

> **Back up the generated `.env`.** `APP_KEY` and `INFLUX_TOKEN` cannot be regenerated later without invalidating sessions/metrics. `RESEND_API_KEY` (outbound mail) is the one value `init` leaves empty.

Key values in `.env`:

| Variable | Meaning |
|---|---|
| `APP_KEY` | Session/encryption secret. `./deploy.sh init` generates it (or `node ace generate:key` / `openssl rand -base64 32`); never rotate |
| `APP_BIND` | Host `interface:port` the app publishes. Default `127.0.0.1:3333` (loopback only). Set `0.0.0.0:3333` or `SERVER_IP:3333` to expose more widely. **This is the only exposed port in the stack.** |
| `DB_HOST` / `REDIS_HOST` | Must stay `postgres` / `redis` (compose service names) — `deploy.sh` rejects `127.0.0.1` |
| `MINIO_ROOT_USER/PASSWORD`, `AWS_*`, `S3_BUCKET` | MinIO credentials; bucket is created automatically on first boot |
| `INFLUX_TOKEN` | Minted as the InfluxDB admin token on **first boot only** — keep it stable forever; changing it later will not re-key the existing volume |
| `INFLUX_INIT_USERNAME/PASSWORD` | First-boot InfluxDB admin credentials |
| `MIGRATE` / `SEED` | When `true`, the container entrypoint runs migrations / seeders on every boot (both idempotent) |

`S3_ENDPOINT` and `INFLUX_URL` are intentionally **not** in `.env` — they are pinned inside `docker-compose.prod.yml` to the internal hostnames (`http://minio:9000`, `http://influxdb:8086`) so they can never accidentally point at a public host.

### Day-to-day commands

```bash
./deploy.sh init         # generate .env (secrets auto-created; see above)
./deploy.sh              # full deploy: build + up + wait healthy + migrate
./deploy.sh update       # git pull --ff-only + rebuild + up + migrate
./deploy.sh logs         # tail app logs
./deploy.sh ps           # stack status
./deploy.sh migrate      # run pending migrations only
./deploy.sh down         # stop the stack (volumes/data kept)
./deploy.sh nuke         # stop + DELETE all volumes (destroys DB!) — asks for confirmation
```

`ENV_FILE=path/to/other.env ./deploy.sh …` overrides the env file; `GIT_BRANCH=… ./deploy.sh update` overrides the branch.

### What deploy.sh validates before touching anything

- docker installed, daemon running (distinguishes "daemon down" from "permission denied"), Compose v2 plugin present
- `.env` exists and every required variable is non-empty
- `DB_HOST`/`REDIS_HOST` are service names, not localhost
- warns on: stale public `S3_ENDPOINT` values, < 2 GB free disk, `APP_BIND` port already in use

### Exposing it to the world

The stack deliberately stops at the published port. Point whatever you like at `APP_BIND` — a reverse proxy with TLS, a tunnel, or direct exposure via `APP_BIND=0.0.0.0:3333`. Nothing else (MinIO, Postgres, Redis, InfluxDB) is reachable from outside Docker, so there is nothing else to protect.

### Backups

All state lives in four named Docker volumes: `postgres_data`, `minio_data`, `redis_data`, `influx_data`. Back up Postgres with `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U $DB_USER $DB_DATABASE > backup.sql` and snapshot the MinIO volume for uploaded files.

## Local development

```bash
docker-compose -f docker-compose.dev.yml up -d   # postgres/redis/minio/influx with dev creds
cp .env.dev.example .env                         # match the dev creds
npm install
node ace migration:run && node ace db:seed
npm run dev                                      # HMR backend + Vite frontend
```

Tests: `npm test` (Japa: unit / functional / browser suites). Lint/typecheck: `npm run lint`, `npm run typecheck`.
