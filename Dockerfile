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

# ---------- Production dependencies only ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Final runtime image ----------
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    LOG_LEVEL=info

# Run as the non-root user that ships with the node image.
USER node

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/build ./

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "bin/server.js"]
