# syntax=docker/dockerfile:1.7

# ---------- Base image ----------
FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini

# ---------- Dependencies (with dev deps for the build) ----------
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build ----------
FROM deps AS build
ENV NODE_ENV=development
COPY . .
RUN node ace build

# ---------- Final runtime image ----------
FROM base AS runtime

# Install prod deps against the package.json that `node ace build` writes into
# build/ — this is the canonical AdonisJS deployment pattern and avoids any
# drift between root deps and the bundled app.
COPY --from=build /app/build ./
RUN npm ci --omit=dev && chown -R node:node /app

USER node

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--"]
# Use the entrypoint shim so `MIGRATE=true` can opt in to running migrations
# before the server boots. With MIGRATE unset, this is identical to running
# `node bin/server.js` directly.
CMD ["node", "bin/docker-entrypoint.js"]
