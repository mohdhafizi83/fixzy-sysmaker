# Fixzy SysMaker — headless web shell (NOT the Electron desktop app).
#
# SysMaker is primarily an Electron desktop app; this image runs the SAME
# engine through the headless web shell (`fixzy serve`): the full visual
# designer in a browser + IPC-over-HTTP, no display server needed.
# See docs/HEADLESS_WEB.md for the architecture.
#
# Build:  docker build -t fixzy-sysmaker .
# Run:    docker compose up -d   (see docker-compose.yml)
#
# NOTE: the web shell has NO authentication (v1). The compose file binds
# 127.0.0.1 only — put a reverse proxy with auth/TLS in front to expose it.

FROM node:22-bookworm-slim

# `zip` powers `generate --zip`; curl is used by the container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends zip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node 22 = ABI 127: better-sqlite3 ships prebuilds for this ABI on
# linux-x64, so npm ci never invokes node-gyp (same choice as CI).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Engine + shells: src/ (core, generators, handlers, renderer), the CLI
# entry, the store schema, and the static assets the renderer references.
COPY src ./src
COPY bin/fixzy.js ./bin/
COPY resources/schema.sql ./resources/
COPY assets ./assets
# Golden fixtures so `generate --fixture` works headlessly in CI containers.
COPY test/fixtures ./test/fixtures

ENV NODE_ENV=production \
    FSM_DATA_DIR=/data \
    FSM_OUTPUT_ROOTS=/data/output \
    FSM_ALLOW_REMOTE=1

RUN mkdir -p /data/output && chown -R node:node /data
VOLUME /data
EXPOSE 7788

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:7788/ || exit 1

CMD ["node", "bin/fixzy.js", "serve", "--host", "0.0.0.0", "--port", "7788"]
