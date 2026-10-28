# syntax=docker/dockerfile:1

# ---------- Stage 1: install dependencies ----------
FROM node:24.19.0-alpine3.24 AS deps
WORKDIR /app
# Toolchain in case better-sqlite3 has no musl prebuild for this node version.
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma
# `npm ci` (following a lockfile regenerated on another OS) can leave better-sqlite3 without its
# native binding → runtime "Could not locate the bindings file". `npm rebuild` re-runs its install
# script so the binding is always present. The npm cache mount survives across builds.
#
# npm_config_nodedir is NOT optional here. better-sqlite3 13 ships no `install` script, so
# `npm rebuild` ALWAYS compiles from source, and node-gyp's default is to download the musl headers
# from unofficial-builds.nodejs.org. BuildKit's network has no route to IPv6 while node resolves AAAA
# first, so that download dies with AggregateError [ETIMEDOUT] in ~500ms and takes the build with it.
# `docker run` does not reproduce it (wget goes IPv4), which is why this is pinned to the
# Node 24.19.0 image whose bundled headers are known to match the runtime.
#
# Pointing node-gyp at the headers the node image already ships (/usr/local/include/node) removes the
# download entirely — no IPv6 workaround to rot, and the headers are guaranteed to match the node
# that will run the binding, because they come from this very image. NODE_OPTIONS=--dns-result-order
# does NOT work as a fix: npm does not pass it down to the node-gyp child.
ENV npm_config_nodedir=/usr/local
RUN --mount=type=cache,target=/root/.npm \
    npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 npm ci && npm rebuild better-sqlite3

# ---------- Stage 2: build ----------
FROM node:24.19.0-alpine3.24 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache npx prisma generate && npm run build

# ---------- Stage 2b: minimal prisma CLI (only for `migrate deploy` at startup) ----------
# Separate stage so the runtime gets the CLI at the pinned version without bloating the app's
# pruned standalone node_modules.
FROM node:24.19.0-alpine3.24 AS prisma-cli
WORKDIR /cli
# The runtime CLI has its own minimal, committed lockfile. `npm install prisma@X` without one
# produces a different dependency tree on every rebuild and previously shipped stale CVEs.
COPY prisma-cli/package.json prisma-cli/package-lock.json ./
COPY .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm_config_fetch_retries=5 npm_config_fetch_retry_maxtimeout=120000 \
    npm ci --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:24.19.0-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# tzdata so the FSRS day cutoff ("4 AM belongs to yesterday") follows local time.
# apk upgrade: pick up Alpine security fixes newer than the node base image (e.g. zlib 1.3.2-r1).
# This runtime starts Node and the checked-in Prisma CLI directly; it never invokes npm or npx.
# Remove the globally bundled npm tree so its build-only dependency CVEs cannot ship in production.
RUN apk upgrade --no-cache && apk add --no-cache tzdata \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
ENV TZ=Asia/Ho_Chi_Minh

# Next standalone output: server.js + pruned node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# The OpenJLPT deck each new learner gets at sign-up (lib/import/starter-deck.ts reads it at runtime).
COPY --from=build /app/data/openjlpt ./data/openjlpt
# nft prunes better-sqlite3 down to its JS and drops the native .node binding (loaded via a runtime
# fs lookup nft cannot trace). Copy the FULLY-BUILT module over the pruned one so the binding is
# present.
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Prisma CLI + config + migrations for `migrate deploy` at container start.
COPY --from=prisma-cli /cli/node_modules ./prisma-cli/node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
# prisma.config.ts does `import { defineConfig } from 'prisma/config'`; the pruned standalone tree
# has no prisma, so symlink it in from the CLI stage rather than duplicating a large package.
RUN ln -s /app/prisma-cli/node_modules/prisma /app/node_modules/prisma

RUN mkdir -p /data && chown node:node /data
ENV DATABASE_URL="file:/data/sakubun.db"
ENV HOSTNAME=0.0.0.0
ENV PORT=3789

USER node
EXPOSE 3789

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3789/api/health || exit 1

# Apply migrations to /data first, then start the server (exec so node receives signals).
# The standalone tree can carry a traced @prisma/config without its `effect` dependency, and
# prisma.config.ts then loads that copy and fails. NODE_PATH lets it fall back to the CLI's tree.
CMD ["sh", "-c", "NODE_PATH=/app/prisma-cli/node_modules ./prisma-cli/node_modules/.bin/prisma migrate deploy && exec node server.js"]
