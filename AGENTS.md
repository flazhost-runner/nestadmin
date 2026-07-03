# AGENTS.md — Aturan Pengembangan NestAdmin (untuk AI & developer)

> **Sumber kebenaran tunggal.** Setiap AI (Claude Code, Cursor, Copilot, Codex) dan developer WAJIB mengikuti dokumen ini saat menambah/mengubah kode. `CLAUDE.md` hanya mirror tipis yang menunjuk ke sini.

NestAdmin adalah **NestJS port dari NodeAdmin** — bootstrap admin yang dikembangkan menjadi aplikasi apa pun. Konsistensi dijaga oleh: dokumen ini + convention checker (`node scripts/check-conventions.js` via `npm run lint:conventions`) sebagai CI gate. Penyimpangan **ditolak CI**.

Sebelum coding, baca juga: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/MODULE_GUIDE.md`](docs/MODULE_GUIDE.md), [`docs/TESTING.md`](docs/TESTING.md).

---

## Alur Wajib (request lifecycle)

```
HTTP Request
  → NestJS Router (route decorators @Get/@Post/etc.)
  → Guards: SessionAuthGuard | JwtAuthGuard  →  RolesGuard (RBAC)
  → Pipe/Validator (class-validator atau Joi)
  → Controller (@Controller, thin HTTP layer)
  → Service (@Injectable, implements I*Service, logika bisnis)
  → Repository (@InjectRepository, TypeORM)
  → Entity / DB
  ↘ error → AppExceptionFilter (terpusat, di main.ts)
```

## Prinsip Wajib

1. **SOLID / DI (NestJS DI container).** Service `@Injectable()`, repository di-inject via `@InjectRepository(Entity)` di constructor. **Dilarang** `new XService()` — gunakan module providers. Service `implements I*Service`.
2. **DRY.** Pakai helper yang ADA: `paginate()`, `ciLike()`, `removeEmptyFields()`, `removePrefix()`, `generateCode()` (`src/helpers/functions.ts`). Jangan tulis ulang.
3. **Error handling.** Service **`throw`** `AppError`/`NotFoundError`/`ConflictError`/`ValidationError`/`UnauthorizedError`/`ForbiddenError` (`src/errors/AppError.ts`). Controller TIDAK menangani error manual — `AppExceptionFilter` yang menangani. **Dilarang** `return error` & `instanceof Error`.
4. **Separation of Concerns.** Controller = thin HTTP layer (parse req, panggil service, render/respond). Logika bisnis hanya di service.
5. **Config terpusat.** Akses env HANYA via `ConfigService` dari `@nestjs/config`. **Dilarang** `process.env.*` di dalam `src/modules/`.
6. **Portabilitas DB.** ORM mendukung banyak dialek, tapi aplikasi tetap portabel hanya bila:
   - Entity: tipe abstrak (`text`/`varchar`/`int`/`timestamp`/`boolean`). **Dilarang** `longtext`/`mediumtext`/`datetime`, dan **`collation` hardcoded**.
   - Migration: TypeORM Table API, **bukan** raw SQL vendor (no `ENGINE=`, backtick, `AUTO_INCREMENT`).
   - Query: **dilarang raw `.query()`** di modul & **`LIKE :param` manual** — pakai `ciLike()` (`LOWER(..) LIKE LOWER(..)`).
   - Test jalan di SQLite in-memory → membuktikan portabilitas.

## Sebelum Coding: Sajikan Rencana Artefak + Konfirmasi

Saat diminta membuat fitur/modul, AI **wajib** lebih dulu menyimpulkan artefak yang dibutuhkan (pakai Matriks di bawah) lalu **menyajikan rencana** ke user. **Ajukan pertanyaan HANYA bila ambigu**; jika prompt sudah jelas, sajikan rencana lalu lanjut.

Pertanyaan klarifikasi yang umum perlu (bila ambigu):
- Butuh **UI admin** (halaman web) atau **API-only**?
- **Read-only** (lihat saja) atau **CRUD** (ada input tulis)?
- Butuh endpoint **API** (untuk mobile/integrasi) atau cukup web?

Contoh format rencana:
> Fitur **Product**: entity+migration, IProductService+ProductService, WebController+ApiController, views CRUD, product.module.ts, test (integration+api), update README+docs/API.md. → *Butuh UI admin atau API-only?*

## Matriks Kebutuhan Artefak

**TEST WAJIB untuk fitur APA PUN.** Setiap modul yang memiliki service harus punya minimal 1 test. Modul ber-service → wajib **integration test**; user-facing (service+views) → wajib **BDD**.

**Selalu ada** (modul fungsional ber-service):
| Artefak | Catatan |
|---------|---------|
| Service + `I*Service` | semua logika bisnis |
| Controller | pintu HTTP (web dan/atau api) |
| `*.module.ts` | NestJS module declaration |
| **Test** | **WAJIB** — integration jika ada service; BDD jika user-facing |
| Update docs | README; + `docs/API.md` bila ada API |

**Kondisional** (sesuai kebutuhan):
| Artefak | Wajib JIKA | Aturan checker |
|---------|------------|----------------|
| Entity | menyimpan data | — |
| Migration | **ada entity** | entity → migration **wajib** |
| Validator/Pipe | **ada input tulis** | store/update ada → validator wajib |
| Views (EJS) | ada **UI admin** | — |
| API Controller | fitur perlu API | ada ApiController → api test + entri `docs/API.md` **wajib** |

**API itu OPSIONAL** untuk modul baru — tidak dipaksa ada. Untuk modul resource (CRUD data), **tawarkan** ke user apakah perlu API.

> Pola acuan termutakhir: modul `access` & `setting`.

## Checklist Membuat Modul Baru

Ikuti `docs/MODULE_GUIDE.md` (ada template lengkap). Urutan & file wajib:

1. **Entity** `src/modules/<m>/models/<x>.entity.ts` — tipe portabel.
2. **Migration** `src/modules/<m>/migrations/` — TypeORM Table API portabel, bukan raw SQL vendor. Buat via `npm run migration:create`.
3. **Interface** `src/modules/<m>/services/v1/I<X>Service.ts`.
4. **Service** `<X>Service.ts` — `@Injectable()`, `implements I<X>Service`, `@InjectRepository(Entity)` di constructor, `throw` AppError, pakai `paginate`/`ciLike`.
5. **Controllers** `controllers/web/v1/<X>WebController.ts` &/ `controllers/api/v1/<X>ApiController.ts` — `@Controller()`, inject service via constructor. Web: `res.render(...)`. API: `{ status: true, message, data }`. Tanpa try/catch error.
6. **Module** `<m>.module.ts` — daftarkan entity di `TypeOrmModule.forFeature([...])`, daftarkan service di `providers`, daftarkan controller di `controllers`. Tambah ke `imports` di `src/app.module.ts`.
7. **Validator/Pipe** `http/validators/<X>.pipe.ts` — Joi atau class-validator. Strip unknown fields.
8. **Views** `views/be/default/<m>/` — Tailwind, ikuti pola tabel/form/pagination modul `access`.
9. **Test** (lihat `docs/TESTING.md`): integration (service↔SQLite), api (supertest), + BDD bila user-facing.
10. **Docs** — tambah fitur di `README.md`, endpoint di `docs/API.md`.

## Security Checklist

- Route admin: `SessionAuthGuard` atau `JwtAuthGuard` SEBELUM `RolesGuard` (urutan guard wajib).
- Form web mutasi: token CSRF (csurf middleware + injeksi `_csrf` di view).
- Endpoint sensitif (login/register/OTP): pasang ThrottlerGuard / rate limiter.
- Validasi semua input (strip unknown) — cegah mass-assignment.
- Upload: validasi mime & ukuran file via multer config.
- Jangan bocorkan detail error ke user (AppExceptionFilter sudah generik di production).
- Secret hanya dari `ConfigService`; jangan hardcode.

## DO NOT (akan ditolak CI)

- ❌ `new XService()` di controller / module — gunakan NestJS DI (providers + constructor injection).
- ❌ `return error` / `instanceof Error` — pakai `throw AppError`.
- ❌ `process.env.*` di `src/modules/` — pakai `ConfigService`.
- ❌ `type: 'longtext'|'mediumtext'|'datetime'` atau `collation:` di entity (tak portabel).
- ❌ raw `.query()` di modul, atau `LIKE :param` manual — pakai QueryBuilder + `ciLike()`.
- ❌ Service tanpa `@Injectable()` / tanpa `implements I*Service`.
- ❌ Controller tanpa `@Controller()` decorator.
- ❌ Menambah modul tanpa test & tanpa update docs.
- ❌ Hardcode secret/kredensial.
- ❌ Logika bisnis di controller (hanya parse req + panggil service + render/respond).

## Definition of Done (modul/fitur)

- [ ] Mengikuti checklist & pola di atas.
- [ ] `npm run lint:conventions` → lolos.
- [ ] `npx tsc --noEmit` → 0.
- [ ] `npm test` → hijau (+ test baru untuk fitur).
- [ ] Security checklist terpenuhi.
- [ ] README + docs/API.md diperbarui (bila ada API).

## Perintah Penting

```bash
npm run lint:conventions   # cek kepatuhan pola (WAJIB sebelum selesai)
npm run start:dev          # jalankan dev (watch mode)
npm run migration:run      # jalankan migrasi
npm run migration:create   # buat file migrasi baru
npm test                   # semua Jest (unit+integration+api+security+smoke)
npm run test:bdd           # BDD (jest-cucumber)
npm run test:cov           # coverage report
npx tsc --noEmit           # type check tanpa emit
node scripts/make-module.js <Name>  # generate scaffold modul baru
```

## NestJS DI Contract

### Service
```typescript
@Injectable()
export class ProductService implements IProductService {
  constructor(
    @InjectRepository(Product) private repo: Repository<Product>,
    private configService: ConfigService,   // bila butuh config
  ) {}
  // ...throw AppError, tidak return error
}
```

### Module
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductWebController, ProductApiController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
```

### Controller
```typescript
@Controller()
@UseGuards(SessionAuthGuard)
export class ProductWebController {
  constructor(private productService: ProductService) {}

  @Get('/admin/v1/product')
  async index(@Req() req: Request, @Res() res: Response) {
    const result = await this.productService.index(req.query as any)
    res.render('product/views/be/default/product/index', { ...result })
  }
}
```
