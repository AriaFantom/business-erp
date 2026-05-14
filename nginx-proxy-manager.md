# Nginx Proxy Manager configuration

This deployment binds the app, MinIO API, and MinIO console to `127.0.0.1` only.
Nginx Proxy Manager (NPM), running on the same host, terminates TLS for three
public hostnames and forwards each to the corresponding loopback port.

You need **three** Proxy Hosts in NPM. For each one, request a Let's Encrypt
cert from the **SSL** tab (force SSL + HTTP/2 + HSTS), then paste the snippet
from this file into the **Advanced** tab.

| Public hostname | Forward to | Used for |
| --- | --- | --- |
| `panel.layerdreams.com` | `127.0.0.1:3333` | The AdonisJS app |
| `s3.layerdreams.com` | `127.0.0.1:9000` | MinIO S3 API (signed URLs hit this) |
| `s3-console.layerdreams.com` | `127.0.0.1:9001` | MinIO web console (optional) |

The hostnames here match `.env.production.example`. If you use different
domains, change them in `.env` (`APP_URL`, `S3_ENDPOINT`,
`MINIO_BROWSER_REDIRECT_URL`) **and** in NPM.

---

## 1. `panel.layerdreams.com` → app

**Details tab**

- Scheme: `http`
- Forward Hostname / IP: `127.0.0.1`
- Forward Port: `3333`
- Block Common Exploits: ✅
- Websockets Support: ✅ (Inertia/HMR doesn't use WS in prod, but it's free
  protection against future features)

**Advanced tab**

```nginx
client_max_body_size 50m;

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
```

`X-Forwarded-Proto $scheme` is the one that matters most — without it the
AdonisJS `trustProxy` config will believe requests are HTTP, `secure` cookies
won't be sent, and login will silently fail.

---

## 2. `s3.layerdreams.com` → MinIO API

This is the host the **browser** fetches signed URLs from, so it must be
publicly reachable.

**Details tab**

- Scheme: `http`
- Forward Hostname / IP: `127.0.0.1`
- Forward Port: `9000`
- Block Common Exploits: ❌ (some legitimate S3 requests contain `..`-shaped
  keys; NPM's exploit filter has been known to false-positive)
- Websockets Support: ❌

**Advanced tab**

```nginx
# MinIO streams large objects; let it through without buffering or size caps.
client_max_body_size 0;
proxy_buffering off;
proxy_request_buffering off;

# MinIO uses chunked transfer for multipart uploads; disable the
# Content-Length rewrite that some NPM versions inject.
proxy_http_version 1.1;
chunked_transfer_encoding off;

# Long uploads need long timeouts.
proxy_connect_timeout 300;
proxy_send_timeout 300;
proxy_read_timeout 300;
send_timeout 300;

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

After saving, test with:

```bash
curl -fsS https://s3.layerdreams.com/minio/health/live
# expect: empty body, 200
```

If you get a 502, NPM can't reach `127.0.0.1:9000` — confirm `docker compose
ps` shows MinIO healthy. If you get a 400/403 with `SignatureDoesNotMatch`, the
public URL doesn't match `MINIO_SERVER_URL` in `.env` — they must be identical
including scheme.

---

## 3. `s3-console.layerdreams.com` → MinIO console (optional)

Skip this if you're happy administering MinIO via `mc` inside the container.

**Details tab**

- Scheme: `http`
- Forward Hostname / IP: `127.0.0.1`
- Forward Port: `9001`
- Block Common Exploits: ✅
- Websockets Support: ✅ ← the console uses WebSockets for live updates

**Advanced tab**

```nginx
client_max_body_size 0;
proxy_buffering off;

proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# The console redirects through itself during login; preserve the public host.
proxy_set_header X-NginX-Proxy true;
```

---

## Verifying the full path

After all three hosts are configured and certs issued:

1. `https://panel.layerdreams.com/health` returns `{"status":"ok"}`.
2. `https://s3.layerdreams.com/minio/health/live` returns 200.
3. Log into the panel, upload a product image, and confirm the image renders
   in the catalog page. The browser DevTools should show the image being
   fetched from `https://s3.layerdreams.com/layerdreams/<key>?...signature...`,
   not from `localhost` or `minio:9000`. If it's fetching from an internal
   hostname, `S3_ENDPOINT` in `.env` is wrong.
