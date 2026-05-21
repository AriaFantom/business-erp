# Deployment

This deployment runs the AdonisJS app, Postgres, Redis, and MinIO in a single
docker-compose stack on a VPS, with Nginx Proxy Manager (NPM) on the same host
terminating TLS for three public hostnames. All app/DB/storage ports are bound
to `127.0.0.1`, so nothing is reachable from the public internet except via NPM.

The build follows the canonical AdonisJS deployment pattern: `node ace build`
produces `build/`, which is then installed against `npm ci --omit=dev` inside
the runtime image and started with `node bin/server.js` (via a small entrypoint
that can opt in to running migrations on boot).

## Prerequisites on the VPS

- Docker 24+ and `docker compose` v2.
- Nginx Proxy Manager already running (see `nginx-proxy-manager.md` for the
  three Proxy Hosts you'll add later).
- DNS records pointing `panel.<domain>`, `s3.<domain>`, and (optionally)
  `s3-console.<domain>` at the VPS.

## 1. Clone and configure

```bash
git clone <this-repo> /opt/layerdreams-panel
cd /opt/layerdreams-panel
cp .env.production.example .env
```

Fill in `.env`. Required:

| Key | Notes |
| --- | --- |
| `APP_KEY` | Generate with `docker run --rm node:24-alpine sh -c 'node -e "console.log(require(\"crypto\").randomBytes(32).toString(\"base64\"))"'`. **Rotating this invalidates every existing session and encrypted column.** |
| `APP_URL` | Public origin, e.g. `https://panel.layerdreams.com`. |
| `DB_HOST` | **Must be `postgres`** (the compose service name), not `127.0.0.1`. |
| `DB_USER` / `DB_PASSWORD` / `DB_DATABASE` | Strong values. These initialize the postgres volume on first boot — see "Rotating database credentials" below. |
| `REDIS_PASSWORD` | Strong value. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials the app uses to talk to MinIO. Simplest setup: equal to `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`. |
| `S3_BUCKET` | Auto-created on first boot by the `createbuckets` service. |
| `S3_ENDPOINT` | **Public HTTPS URL**, e.g. `https://s3.layerdreams.com`. The browser fetches signed URLs from this hostname, so it MUST be reachable over the public internet — not `http://minio:9000`. |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO bootstrap credentials. |
| `MINIO_BROWSER_REDIRECT_URL` | Public console URL, e.g. `https://s3-console.layerdreams.com`. |
| `RESEND_API_KEY` + mail fields | Required for sending invitations. |
| `MIGRATE` | `true` to run pending migrations on every boot. Safe — migrations are idempotent. |
| `SEED` | `true` to run `db:seed` on every boot. Safe — seeders use `updateOrCreate` to provision the `owner`/`admin`/`member` roles and a default supplier/customer/categories. |

Everything else (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3333`, etc.) is
already correct in the example.

## 2. Deploy

`deploy.sh` validates `.env`, builds the image, brings up the stack, and runs
migrations:

```bash
./deploy.sh
```

Individual steps if you want them:

```bash
./deploy.sh build      # docker compose build
./deploy.sh up         # docker compose up -d
./deploy.sh migrate    # node ace migration:run --force
./deploy.sh ps         # show status (look for "(healthy)")
./deploy.sh logs       # tail app logs
./deploy.sh down       # stop the stack (keeps volumes)
```

### Redeploying after a code update

Pull the latest commit and rebuild in one shot:

```bash
./deploy.sh update
```

This runs `git fetch` + `git pull --ff-only`, refuses to continue if the working
tree has local changes, then runs the full `build` → `up` → `migrate` cycle.
Override the branch with `GIT_BRANCH=some-branch ./deploy.sh update`.

## 3. Configure NPM

See `nginx-proxy-manager.md`. You'll add three Proxy Hosts:

- `panel.<domain>` → `127.0.0.1:3333`
- `s3.<domain>` → `127.0.0.1:9000`
- `s3-console.<domain>` → `127.0.0.1:9001`

The MinIO API host (`s3.<domain>`) needs specific tuning (`client_max_body_size
0`, `proxy_buffering off`) — paste the snippet from that file verbatim.

## 4. First-time setup

The first request to `/` with zero users in the database generates a one-time
invite token and redirects to `/invite/<token>`, where you create the owner
account. The token expires in 24h and is stored in the `invitations` table.

Open `https://panel.<domain>/` in a browser and follow the flow.

## Health check

`GET /health` returns `{"status":"ok"}` with HTTP 200. The compose `app` service
uses this as its docker healthcheck (`./deploy.sh ps` will show
`(healthy)`). Use the same URL for any external uptime monitor.

## Logs

JSON on stdout (`config/logger.ts`). Each line includes a `request_id`. Stream
with `./deploy.sh logs` or pipe `docker compose logs` to your aggregator.

---

## Troubleshooting

### "Connection refused" / "ECONNREFUSED 127.0.0.1:5432" in app logs

**Cause:** `DB_HOST=127.0.0.1` (or `localhost`) in `.env`. Inside the app
container, that means the container itself, not the postgres service.

**Fix:** Set `DB_HOST=postgres` (the compose service name). `deploy.sh` refuses
to start with this misconfiguration.

### "password authentication failed for user"

**Cause:** You changed `DB_USER`/`DB_PASSWORD` in `.env` after the postgres
volume was already initialized. Postgres seeds the initial superuser on first
boot of the data volume and ignores env changes afterward.

**Fix (preserving data):**

```bash
./deploy.sh up
docker compose --env-file .env -f docker-compose.prod.yml exec postgres \
  psql -U <old-user> -d postgres \
  -c "ALTER USER <old-user> WITH PASSWORD '<new-password>';"
```

**Fix (nuke and start over — destroys all data):**

```bash
./deploy.sh nuke
./deploy.sh
```

### Uploaded images don't render in the browser

**Likely cause:** `S3_ENDPOINT` in `.env` is internal (`http://minio:9000`)
instead of the public hostname. The app generates signed URLs against
`S3_ENDPOINT`, and the browser must be able to reach them.

**Fix:** `S3_ENDPOINT=https://s3.<domain>`, then restart:

```bash
./deploy.sh down && ./deploy.sh up
```

Verify in DevTools that image `<img src>` URLs point to `https://s3.<domain>/…`
not `http://minio:9000/…`.

### `SignatureDoesNotMatch` from MinIO

**Cause:** `S3_ENDPOINT` (used by the app to sign URLs) doesn't match
`MINIO_SERVER_URL` (what MinIO believes its public URL to be). The compose file
wires `MINIO_SERVER_URL: ${S3_ENDPOINT}`, so this only happens if `.env` is
out of sync between the app and MinIO containers — restart the stack after
changing `.env`.

### Login succeeds but I'm immediately logged out

**Cause:** `secure` cookies are being dropped because the app sees the request
as HTTP. NPM isn't forwarding `X-Forwarded-Proto`, or it isn't trusted.

**Fix:** Confirm the `panel.<domain>` Proxy Host has the `proxy_set_header
X-Forwarded-Proto $scheme;` line from `nginx-proxy-manager.md`. The app's
`trustProxy` config trusts loopback + RFC1918, so NPM-on-host is covered out
of the box.
