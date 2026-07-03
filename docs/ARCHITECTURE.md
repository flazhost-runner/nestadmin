# Arsitektur — NestAdmin

Dokumen ini menjelaskan struktur, lapisan, dan keputusan desain aplikasi. Ditujukan untuk developer yang akan mengembangkan/menambah fitur.

## Gambaran Umum

NestAdmin adalah **NestJS port dari NodeAdmin** — aplikasi admin modular per fitur. Setiap modul (`src/modules/<modul>`) berdiri sendiri dengan lapisannya, dan didaftarkan di `src/app.module.ts`.

```
HTTP Request
  → NestJS Router (Controller decorators: @Get/@Post/@Put/@Delete)
  → Guards: SessionAuthGuard | JwtAuthGuard  →  RolesGuard (RBAC)
  → Pipe (class-validator atau Joi — validasi + strip unknown)
  → Controller (@Controller, thin HTTP layer)
      → panggil service, parse req, render view atau kirim JSON
  → Service (@Injectable, implements I*Service)
      → logika bisnis, throw AppError bila gagal
  → Repository (@InjectRepository, TypeORM)
  → Entity / DB
  ↘ error → AppExceptionFilter (src/filters/app-exception.filter.ts)
              ↘ /api/* → JSON { status: false, message, data: null }
              ↘ web    → flash + redirect
```

## Lapisan

| Lapisan | Lokasi | Tanggung jawab |
|---------|--------|----------------|
| Controller (web) | `modules/*/controllers/web/v1` | Parse req, render EJS via `res.render()`. Tanpa logika bisnis. |
| Controller (api) | `modules/*/controllers/api/v1` | Parse req, JSON response. Tanpa logika bisnis. |
| Guard | `modules/auth/guards/` | Auth (session/JWT) + RBAC (roles). |
| Pipe/Validator | `modules/*/validators/` | Validasi input + strip unknown. |
| Service | `modules/*/services/v1/` | Logika bisnis. `@Injectable`, `implements I*Service`. Throw saat gagal. |
| Entity | `modules/*/models/*.entity.ts` | Model TypeORM. Tipe kolom portabel. |
| Module | `modules/*/*.module.ts` | NestJS DI container config (imports, controllers, providers, exports). |
| View | `modules/*/views/be/default/` | EJS + Tailwind (admin UI). |
| Filter | `src/filters/` | Global error handler. |
| Helper | `src/helpers/` | `paginate`, `ciLike`, `removeEmptyFields`, dll. |

## Struktur Modul

```
src/modules/<modul>/
├── <modul>.module.ts          # NestJS @Module declaration
├── models/
│   └── <entity>.entity.ts     # TypeORM entity
├── migrations/
│   └── <ts>-Create<X>Table.ts # TypeORM Table API migration
├── services/v1/
│   ├── I<X>Service.ts         # Interface (contract)
│   └── <X>Service.ts          # Implementation (@Injectable)
├── controllers/
│   ├── web/v1/<X>WebController.ts    # Web (session + EJS)
│   └── api/v1/<X>ApiController.ts   # API (JWT + JSON) — opsional
└── views/be/default/<modul>/
    ├── index.ejs
    ├── create.ejs
    └── edit.ejs
```

## RBAC (Route-Driven)

Model otorisasi **diturunkan dari route** — bukan subject tetap:

- **Permission = `(name, method, guard_name)`** — `name` = nama route yang didaftarkan di `routeRegistry` (mis. `admin.v1.access.user.delete`), `method` = HTTP method (GET/POST/PUT/DELETE), `guard_name` = `api` untuk JWT routes, `web` untuk session routes.
- **Route registry** (`src/utils/named-routes.ts`) — controller mendaftarkan route bernama via `routeRegistry.register(name, method, path)` di constructor. PermissionService membaca registry ini untuk auto-sync permission.
- **`RolesGuard`** — menurunkan `(name, method)` dari request berjalan lalu mengecek apakah role user punya permission yang cocok. `Administrator` role bypass semua.
- **Urutan guard WAJIB**: `SessionAuthGuard/JwtAuthGuard` SEBELUM `RolesGuard` (autentikasi dulu, baru otorisasi).

```typescript
// Mendaftarkan route di constructor controller
routeRegistry.register('admin.v1.product.index',  'GET',    '/admin/v1/product')
routeRegistry.register('admin.v1.product.delete', 'DELETE', '/admin/v1/product/:id')
```

> **Catatan lintas-port:** registry route adalah sumber kebenaran RBAC. JANGAN memakai daftar permission subject tetap — itu menyimpang dari NodeAdmin.

## Dependency Injection (NestJS DI)

NestAdmin menggunakan NestJS built-in DI container (`@nestjs/common`):

- **Service** — `@Injectable()` + constructor injection via `@InjectRepository(Entity)`.
- **Controller** — constructor injection service (bukan `new Service()`).
- **Module** — `TypeOrmModule.forFeature([Entity])` di `imports`; service di `providers`; controller di `controllers`.

Contoh:
```typescript
@Injectable()
export class ProductService implements IProductService {
  constructor(
    @InjectRepository(Product) private repo: Repository<Product>,
    private configService: ConfigService,  // bila butuh config
  ) {}
}
```

Berbeda dengan NodeAdmin (tsyringe + tokens.ts + container.ts), NestAdmin cukup mendaftarkan di `*.module.ts`.

## Error Handling

- **`src/errors/AppError.ts`** — `AppError extends HttpException` + turunan: `NotFoundError(404)`, `ConflictError(409)`, `ValidationError(422)`, `UnauthorizedError(401)`, `ForbiddenError(403)`.
- Service **melempar** error ini — JANGAN `return error`.
- **`src/filters/app-exception.filter.ts`** (global, dipasang di `main.ts`) menangkap semua exception:
  - Path `/api/` → JSON via `{ status: false, message, data: null }`.
  - Web → flash message + redirect.
  - Non-`AppError` → 500 generik (tanpa bocor detail di production).
- Controller TIDAK perlu try/catch — filter sudah handle.

## Konfigurasi (Twelve-Factor)

- **`src/config/env.ts`** — ekspor typed config, hanya dipakai di config module.
- **`@nestjs/config` `ConfigService`** — satu-satunya cara akses env di modules. **Dilarang** `process.env.*` di dalam `src/modules/`.
- **`src/config/ormconfig.ts`** — TypeORM DataSource, dialect-agnostic (baca `DB_TYPE`), mendukung SQLite/MySQL/Postgres.

## Dua Mode Auth

| Mode | Guard | Token | Use case |
|------|-------|-------|----------|
| Web (session) | `SessionAuthGuard` | express-session cookie | Admin UI |
| API (stateless) | `JwtAuthGuard` | JWT Bearer | REST API / mobile |

Kedua mode berjalan bersamaan di aplikasi yang sama. Web routes pakai `SessionAuthGuard`, API routes pakai `JwtAuthGuard`.

## Helper DRY

| Helper | Lokasi | Guna |
|--------|--------|------|
| `paginate(query, filter)` | `helpers/functions.ts` | skip/take + paginate_data seragam |
| `ciLike(col, param, val)` | `helpers/functions.ts` | LIKE case-insensitive lintas-dialek (LOWER) |
| `removeEmptyFields(obj)` | `helpers/functions.ts` | bersihkan field kosong |
| `removePrefix(obj, pfx)` | `helpers/functions.ts` | strip prefix `q_` dari filter query |
| `generateCode(prefix)` | `helpers/functions.ts` | generate kode unik |

## State & Skalabilitas

- **Session** → Redis (`connect-redis`). Stateless app → horizontal scaling tanpa sticky session.
- **Setting** → cache in-memory TTL (`src/services/setting-cache.service.ts`), invalidasi saat update.
- **File** → media module (`src/modules/media/`), dapat dikonfigurasi ke cloud storage.

## Frontend Template (Landing)

Halaman publik `/` memakai template sistem. Dua service di modul `home`:

| Service | Tugas |
|---------|-------|
| `FeCatalogService` | Fetch & cache katalog template dari GitHub tree API (TTL 6 jam) |
| `FeTemplateService` | Kelola template aktif: download, cache lokal, sajikan landing |

## Menambah Modul Baru

1. Jalankan generator: `node scripts/make-module.js <Name>`
2. Sesuaikan entity, service, views sesuai kebutuhan bisnis.
3. Daftarkan `<Name>Module` di `src/app.module.ts` imports.
4. Daftarkan entity di `src/config/ormconfig.ts` entities.
5. Jalankan `npm run migration:run`.
6. Tambah test + update docs.
7. Verifikasi: `npm run lint:conventions && npx tsc --noEmit && npm test`.
