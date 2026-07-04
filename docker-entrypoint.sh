#!/bin/sh
# Container boot sequence for the NestAdmin starter kit:
#   1. map CapRover $PORT -> $APP_PORT and ensure mandatory secrets exist
#      (generate + persist if not provided)
#   2. start a bundled local Redis when REDIS_URL points at localhost
#   3. run DB migrations + default admin seed (idempotent; never crash the boot)
#   4. exec the compiled server (node dist/src/main.js) on $APP_PORT
set -e

DATA_DIR=/app/data
SECRETS_FILE="$DATA_DIR/.runtime-secrets"
mkdir -p "$DATA_DIR"

# CapRover injects PORT; the app itself reads APP_PORT (src/main.ts).
if [ -n "${PORT:-}" ]; then
    APP_PORT="$PORT"
fi
export APP_PORT="${APP_PORT:-80}"

gen_secret() {
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# --- 1. Secrets (SESSION_SECRET / JWT_SECRET) ---------------------------------
# Honour values supplied via the environment. Otherwise generate strong random
# secrets once and persist them so sessions/JWTs survive container restarts
# (persists across restarts when /app/data is a mounted volume).
[ -f "$SECRETS_FILE" ] && . "$SECRETS_FILE"

if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET="$(gen_secret)"
    echo "SESSION_SECRET=$SESSION_SECRET" >> "$SECRETS_FILE"
    echo "[entrypoint] Generated SESSION_SECRET (persisted in $SECRETS_FILE)"
fi
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="$(gen_secret)"
    echo "JWT_SECRET=$JWT_SECRET" >> "$SECRETS_FILE"
    echo "[entrypoint] Generated JWT_SECRET (persisted in $SECRETS_FILE)"
fi
export SESSION_SECRET JWT_SECRET

# --- 2. Bundled Redis (only when targeting localhost) -------------------------
# A managed Redis can be used by setting REDIS_URL to a non-local host.
case "${REDIS_URL:-}" in
    ""|*127.0.0.1*|*localhost*)
        echo "[entrypoint] Starting bundled redis-server (REDIS_URL=${REDIS_URL:-default})"
        redis-server --daemonize yes --save "" --appendonly no >/dev/null 2>&1 || \
            echo "[entrypoint] WARN: could not start bundled redis-server"
        ;;
    *)
        echo "[entrypoint] Using external Redis at $REDIS_URL"
        ;;
esac

# --- 3. Database directory + migrations + seed --------------------------------
# Default DB is SQLite under /app/data; managed DBs are driven purely by env
# (DB_TYPE/DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE) with no edits.
# SQLite paths are resolved by the app as join(cwd, DB_DATABASE), so make sure
# the parent directory exists for both relative and absolute values.
case "${DB_TYPE:-better-sqlite3}" in
    sqlite|better-sqlite3)
        case "${DB_DATABASE:-}" in
            ""|:memory:) : ;;
            /*) mkdir -p "$(dirname "$DB_DATABASE")" 2>/dev/null || true ;;
            *)  mkdir -p "$(dirname "/app/$DB_DATABASE")" 2>/dev/null || true ;;
        esac
        ;;
esac

# src/database/seed.ts reads the legacy aliases DB_NAME/DB_USER/DB_PASS; keep
# them in sync with the canonical names so seeding targets the same database.
export DB_NAME="${DB_NAME:-${DB_DATABASE:-}}"
export DB_USER="${DB_USER:-${DB_USERNAME:-root}}"
export DB_PASS="${DB_PASS:-${DB_PASSWORD:-}}"

echo "[entrypoint] Running database migrations (compiled, low-memory)..."
if node ./node_modules/typeorm/cli.js migration:run -d ./dist/src/config/ormconfig.js; then
    echo "[entrypoint] Migrations applied."
else
    echo "[entrypoint] WARN: migration gagal — tetap start server. Cek koneksi DB & log di atas." >&2
fi

echo "[entrypoint] Seeding default data (idempotent)..."
node ./dist/src/database/seed.js || \
    echo "[entrypoint] WARN: seed gagal — tetap start server." >&2

# --- 4. Start the compiled server --------------------------------------------
echo "[entrypoint] Starting server on APP_PORT=${APP_PORT}"
exec node dist/src/main.js
