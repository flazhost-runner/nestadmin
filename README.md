# NestAdmin

NestJS port of [NodeAdmin](../NodeAdmin) — a full-featured admin panel framework built with NestJS, TypeORM, EJS, and Tailwind CSS. Supports multi-database (SQLite / MySQL / PostgreSQL), session-based web UI, and REST API with JWT authentication.

## Features

- **Authentication** — session login + JWT API, bcrypt passwords, CSRF protection, rate limiting
- **Access Control (RBAC)** — roles, permissions, guard_name scoping (web/api), user-role assignment
- **Settings** — key-value store with global cache, template switcher (Tailwind theme variables)
- **Profile** — avatar upload, password change, personal settings
- **Dashboard** — stats cards, Chart.js graphs
- **Media Manager** — local file upload/list/delete, Trumbowyg rich-text file manager plugin
- **Components** — UI kitchen-sink preview page
- **Home / Landing Page** — FE template download, preview, and live deploy via Home module
- **Multi-DB** — `DB_TYPE=better-sqlite3|sqlite|mysql|postgres` with zero code changes
- **Modular architecture** — each feature is a self-contained NestJS module (controller, service, entity, migration, views)

## Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Run migrations (creates all tables)
pnpm run migration:run

# 4. Seed initial admin user and default settings
pnpm run seed

# 5. Start development server
pnpm run start:dev
```

Open `http://localhost:3000` — login with `admin@example.com` / `password`.

## Environment Variables

| Variable        | Default              | Description                                      |
|-----------------|----------------------|--------------------------------------------------|
| `NODE_ENV`      | `development`        | `development` / `production` / `test`           |
| `PORT`          | `3000`               | HTTP port                                        |
| `APP_NAME`      | `NestAdmin`          | Shown in browser title and UI                   |
| `APP_URL`       | `http://localhost:3000` | Base URL (used in emails / redirects)        |
| `DB_TYPE`       | `better-sqlite3`     | `better-sqlite3` / `sqlite` / `mysql` / `postgres` |
| `DB_NAME`       | `nestadmin.sqlite`   | Database name (or path for SQLite)              |
| `DB_HOST`       | `localhost`          | DB host (MySQL/Postgres only)                   |
| `DB_PORT`       | `3306`               | DB port (MySQL: 3306, Postgres: 5432)           |
| `DB_USER`       | `root`               | DB username                                     |
| `DB_PASS`       |                      | DB password                                     |
| `SESSION_SECRET`| *(required)*         | Express session secret (min 32 chars)           |
| `JWT_SECRET`    | *(required)*         | JWT signing secret (min 32 chars)               |
| `JWT_EXPIRY`    | `7d`                 | JWT token expiry                                |
| `REDIS_URL`     |                      | Optional Redis URL for session store            |
| `STORAGE_DRIVER`| `local`              | `local` / `oss` / `s3` — see [Storage](#storage--switching-backends) |
| `STORAGE_BASE_PATH` | `public/storage` | Local driver: dir where objects are written (URL prefix stays `/storage`) |
| `STORAGE_ACCESS_KEY_ID` |            | oss/s3 access key                               |
| `STORAGE_SECRET_ACCESS_KEY` |        | oss/s3 secret key                               |
| `STORAGE_ENDPOINT` |                  | oss/s3 endpoint (set → S3 path-style: MinIO/R2) |
| `STORAGE_BUCKET` |                    | oss/s3 bucket name                              |
| `STORAGE_REGION` | `us-east-1`          | s3 region                                       |
| `STORAGE_SSL`   | `true`               | Use HTTPS for oss/s3 URLs                        |

## Multi-Database Support

Switch database with a single env variable — no code changes required:

```bash
# SQLite (default, zero setup)
DB_TYPE=better-sqlite3
DB_NAME=nestadmin.sqlite

# MySQL
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=secret
DB_NAME=nestadmin

# PostgreSQL
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=secret
DB_NAME=nestadmin
```

## Storage & switching backends

File storage (avatars, setting logos, Trumbowyg editor uploads) goes through a
single adapter (`src/config/storageClient.ts` + `StorageService`). **The DB
stores only the object _key_** (e.g. `editor/uuid.png`); the render URL is built
at request time, so switching backends is a pure `.env` change + restart — no
code or view edits.

| `STORAGE_DRIVER` | Render URL for a stored key                     | Local mount |
|------------------|-------------------------------------------------|-------------|
| `local`          | `/storage/<key>` (relative)                     | yes         |
| `s3`             | absolute presigned URL (AWS SigV4, 6 h TTL)     | no          |
| `oss`            | absolute presigned URL (Alibaba OSS)            | no          |

```bash
# Local (default, zero setup) — files under STORAGE_BASE_PATH
STORAGE_DRIVER=local
STORAGE_BASE_PATH=public/storage        # relative → resolved from cwd; absolute OK

# AWS S3 (or S3-compatible: MinIO, Cloudflare R2, Backblaze B2 — set STORAGE_ENDPOINT)
STORAGE_DRIVER=s3
STORAGE_ACCESS_KEY_ID=AKIA...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_BUCKET=my-bucket
STORAGE_REGION=us-east-1
# STORAGE_ENDPOINT=http://minio:9000   # set → path-style; leave empty for AWS

# Alibaba Cloud OSS
STORAGE_DRIVER=oss
STORAGE_ACCESS_KEY_ID=LTAI...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_BUCKET=my-bucket
STORAGE_ENDPOINT=oss-ap-southeast-5.aliyuncs.com
```

**How local serving works.** When `STORAGE_DRIVER=local`, `main.ts` mounts
`STORAGE_BASE_PATH` at the stable URL prefix **`/storage`**
(`app.useStaticAssets(localStorageDir(), { prefix: '/storage' })`). The prefix is
**decoupled** from the filesystem path, so an absolute `STORAGE_BASE_PATH`
(e.g. `/var/data` in Docker) still renders valid `/storage/<key>` URLs. For
`oss`/`s3` no mount is registered — URLs are absolute and presigned.

**SDKs.** `s3` URL signing is SDK-free (hand-rolled AWS SigV4), so rendering S3
URLs needs no extra package. Actual **uploads** to `s3`/`oss` (and OSS URL
signing) use `@aws-sdk/client-s3` / `ali-oss`, declared as
**optionalDependencies** — a normal `npm install` includes them.

**Migrating existing files when you switch.** The DB keys don't change, so just
copy the objects to the new backend and restart:

```bash
# local → S3 / MinIO / R2
aws s3 sync ./public/storage s3://my-bucket/
# local → Alibaba OSS
ossutil cp -r ./public/storage oss://my-bucket/
```

**Notes / caveats.**
- Uploaded content is **git-ignored** (`public/storage/*`); only `.gitkeep`
  scaffolding is tracked, so the dirs survive a fresh clone.
- `local` in production is **ephemeral** on container/PaaS filesystems — mount a
  **persistent volume** at `STORAGE_BASE_PATH`, or use `s3`/`oss`.
- Presigned URLs expire (6 h for render); they are regenerated on each request.

## Testing

```bash
# All tests
pnpm test

# Unit tests only
pnpm run test:unit

# Integration tests
pnpm run test:integration

# API (supertest) tests
pnpm run test:api

# Security tests
pnpm run test:security

# Coverage report
pnpm run test:cov
```

Tests use an in-memory SQLite DB (`DB_NAME=:memory:`) with `migrationsRun: true` — no setup required.

## API Documentation

Base path: `/api/v1`

| Method | Endpoint                    | Auth    | Description                    |
|--------|-----------------------------|---------|--------------------------------|
| POST   | `/api/v1/auth/login`        | Public  | Login, returns JWT token       |
| POST   | `/api/v1/auth/logout`       | JWT     | Invalidate token (blacklist)   |
| GET    | `/api/v1/auth/profile`      | JWT     | Current user info              |
| GET    | `/api/v1/access/roles`      | JWT+ACL | List roles                     |
| POST   | `/api/v1/access/roles`      | JWT+ACL | Create role                    |
| PUT    | `/api/v1/access/roles/:id`  | JWT+ACL | Update role                    |
| DELETE | `/api/v1/access/roles/:id`  | JWT+ACL | Delete role                    |
| GET    | `/api/v1/access/users`      | JWT+ACL | List users                     |
| POST   | `/api/v1/access/users`      | JWT+ACL | Create user                    |
| PUT    | `/api/v1/access/users/:id`  | JWT+ACL | Update user                    |
| DELETE | `/api/v1/access/users/:id`  | JWT+ACL | Delete user                    |
| GET    | `/api/v1/setting`           | JWT+ACL | Get all settings               |
| PUT    | `/api/v1/setting/:key`      | JWT+ACL | Update a setting               |
| GET    | `/admin/v1/media/list`      | Session | List uploaded files            |
| POST   | `/admin/v1/media/upload`    | Session | Upload a file                  |
| POST   | `/admin/v1/media/delete`    | Session | Delete a file                  |

Full API reference: [`docs/API.md`](docs/API.md)

Postman collection: [`docs/postman/NestAdmin.postman_collection.json`](docs/postman/NestAdmin.postman_collection.json) (default `base_url` = `http://localhost:3000`).

## Architecture

```
src/
  config/          # env validation (Joi), ormconfig, constants
  database/        # seed script
  errors/          # AppError, AppException, global exception filter
  filters/         # HttpExceptionFilter
  helpers/         # renderView(), handler(), pagination helpers
  middleware/       # ViewLocalsMiddleware, CSRF, session setup
  resources/        # EJS layouts and shared partials (be/fe themes)
  services/         # shared services (e.g. SettingCacheService via @Global)
  utils/            # misc utilities
  modules/
    auth/           # session login/logout + JWT strategy + guards
    access/         # roles, permissions, users RBAC
    setting/        # key-value settings + cache (@Global)
    profile/        # avatar, password change
    dashboard/      # stats + charts
    media/          # file upload/list/delete
    components/     # UI component preview
    home/           # landing page + FE template manager
public/
  be/default/      # admin panel static assets (CSS, JS, img)
  fe/default/      # landing page static assets
  vendor/          # third-party plugins (Trumbowyg filemanager)
  storage/         # user uploads (gitignored)
  fe/templates/    # downloaded FE templates cache (gitignored)
```

Each module follows the pattern: `entity` → `migration` → `IService interface` → `Service` → `Controller` → `Module` → `Views (EJS)`.

## Scripts

| Script                   | Description                              |
|--------------------------|------------------------------------------|
| `pnpm start:dev`         | Dev server with hot reload               |
| `pnpm build`             | Compile TypeScript to dist/              |
| `pnpm start:prod`        | Run compiled production build            |
| `pnpm run migration:run` | Apply pending migrations                 |
| `pnpm run migration:revert` | Revert last migration                 |
| `pnpm run seed`          | Seed admin user + default settings       |
| `pnpm run lint:conventions` | Check module conventions (AGENTS.md) |
| `npx tsc --noEmit`       | TypeScript type check without emit       |

## License

MIT
