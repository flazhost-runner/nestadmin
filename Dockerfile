# NestAdmin starter kit (nest-admin) — FlazHost PaaS build context.
#
# Single-stage image on node:20-alpine. The container:
#   - builds the app (nest build -> dist/)
#   - runs TypeORM migrations + admin seed on boot (idempotent), then `node dist/src/main`
#   - listens on $APP_PORT (default 80) for CapRover ($PORT is mapped in the entrypoint)
#   - defaults to a zero-config SQLite DB and a bundled local Redis, while
#     allowing a fully managed DB / Redis via environment variables.
#
# NOTE: migrations are executed with the compiled datasource
# (node ./node_modules/typeorm/cli.js -d ./dist/src/config/ormconfig.js), so no
# ts-node is needed at runtime; devDependencies stay in the image because
# `nest build` needs @nestjs/cli and the image is built in one stage.
FROM node:20-alpine

WORKDIR /app

# Runtime extras:
#   - redis       : bundled local store for zero-config deploys (SESSION_DRIVER=redis)
#   - tini        : proper PID 1 / signal handling (graceful SIGTERM shutdown)
# Build toolchain (python3/make/g++) is needed to compile the better-sqlite3
# and bcrypt native addons and is removed again after install to keep the
# image lean.
COPY package.json package-lock.json ./
RUN apk add --no-cache redis tini \
 && apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --include=dev --no-audit --no-fund \
 && apk del .build-deps

# App source + build (nest build -> dist; nest-cli copies .ejs views + module
# public assets into dist with the src/ prefix stripped)
COPY . .
RUN npm run build

# Writable location for the default SQLite database file (and runtime secrets).
RUN mkdir -p /app/data && chmod +x /app/docker-entrypoint.sh

# --- Defaults: zero-config boot, every value overridable via env ---
# DB_DATABASE is intentionally relative: the app resolves SQLite paths with
# join(process.cwd(), DB_DATABASE), so "data/nestadmin.sqlite" -> /app/data/... .
ENV NODE_ENV=production \
    APP_PORT=80 \
    APP_MODE=full \
    SESSION_DRIVER=database \
    DB_TYPE=better-sqlite3 \
    DB_DATABASE=data/nestadmin.sqlite \
    REDIS_URL=redis://127.0.0.1:6379

EXPOSE 80

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
