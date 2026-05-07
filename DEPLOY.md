# Deployment

## Build the image

```bash
docker build -t layerdreams-panel:latest .
```

The Dockerfile is multi-stage and produces a small runtime image that:

- runs as the non-root `node` user
- uses `tini` as PID 1 for clean signal handling
- ships only production node_modules and the compiled `build/` output

## Required environment variables

Copy `.env.example` to `.env` (or supply the variables to the runtime via your
orchestrator). At minimum you must provide:

| Variable | Notes |
| --- | --- |
| `APP_KEY` | 32-byte secret. Generate with `node ace generate:key`. **Rotating this invalidates all sessions, signed URLs, and CSRF tokens.** |
| `APP_URL` | Public origin, e.g. `https://panel.example.com`. Used for invitation links and signed URLs. |
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | Defaults to `0.0.0.0:3333` in the image. |
| `LOG_LEVEL` | One of `fatal,error,warn,info,debug,trace,silent`. |
| `SESSION_DRIVER` | `cookie`, `memory`, or `database`. `cookie` is fine for single-instance deployments. For multi-instance, use `database`. |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_DATABASE` | Postgres connection. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Used for caching. Required even if cache is light — `config/cache.ts` references it. |
| `MAIL_MAILER=resend` + `RESEND_API_KEY` + `MAIL_FROM_ADDRESS` + `MAIL_FROM_NAME` | Outbound email (invitations). |
| `DRIVE_DISK=s3` + `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` + `S3_BUCKET` | Object storage for catalog images. Leave `S3_ENDPOINT` empty for AWS S3; set it to point at MinIO/R2/etc. |

## Run

```bash
docker run --rm -p 3333:3333 \
  --env-file .env \
  layerdreams-panel:latest
```

## First-time setup

The first request to `/` with zero users in the database generates a one-time
invite token and redirects to `/invite/<token>` so an owner account can be
created. The token is stored in the `invitations` table (status=pending,
type=setup). It expires in 24h. If your DB starts pre-seeded with at least one
user, this flow does not run.

## Migrations

Run before starting the app:

```bash
docker run --rm --env-file .env layerdreams-panel:latest \
  node ace migration:run --force
```

Note: in production, Lucid's `migration:run` regenerates `database/schema.ts`
which you typically commit; do this build-side, not at runtime.

## Behind a reverse proxy

The app trusts the `X-Forwarded-*` headers per AdonisJS defaults. Ensure your
proxy:

- terminates TLS (HSTS is enabled in production via `config/shield.ts`)
- forwards `Host` and `X-Forwarded-Proto` so `APP_URL`-based redirects stay on
  HTTPS
- does not strip the `XSRF-TOKEN` and `adonis-session` cookies

## Health checks

There is no dedicated health route; point your liveness probe at `GET /` —
unauthenticated visitors get a 302 to `/login`, which is enough to confirm the
process is up. For deeper checks, hit `/login` and assert a 200.

## Logging

Logs are emitted as JSON on stdout (`config/logger.ts`). Pipe them to your log
aggregator. Each request includes a `request_id` you can correlate with errors
surfaced to users.
