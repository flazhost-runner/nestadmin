# CLAUDE.md

**Aturan pengembangan lengkap ada di [`AGENTS.md`](AGENTS.md) — baca & patuhi itu sebagai sumber kebenaran.** File ini hanya catatan ringkas untuk Claude Code.

## Wajib sebelum menulis/mengubah kode
1. Baca `AGENTS.md` (alur, prinsip SOLID/DI, error handling, security, larangan).
2. **Fitur/modul baru**: simpulkan artefak via "Matriks Kebutuhan Artefak" di AGENTS.md, **sajikan rencana artefak** ke user; tanya bila ambigu (UI vs API-only, read-only vs CRUD, perlu API?). Lalu ikuti `docs/MODULE_GUIDE.md`.
3. Sebelum menganggap selesai: `npm run lint:conventions` (cek pola + kelengkapan kontekstual) → lolos, lalu `npx tsc --noEmit` & `npm test`.

## Inti yang TIDAK boleh dilanggar
- **DI**: service `@Injectable()` + `@InjectRepository()` via constructor. JANGAN `new XService()`.
- **Interface**: service `implements I*Service` — wajib ada file `I<X>Service.ts`.
- **Error**: service `throw AppError`; **dilarang** `return error` / `instanceof Error`.
- **Render web**: `res.render('path/to/view', locals)` — Content-Type text/html.
- **Config**: hanya via `ConfigService` dari `@nestjs/config`. **Dilarang** `process.env` di `src/modules/`.
- **Entity**: tipe kolom portabel (varchar/text/int/boolean/timestamp). Lihat AGENTS.md.
- **Migration**: TypeORM Table API — bukan raw SQL vendor.
- **Query**: `ciLike()` helper, bukan `LIKE :param` manual.
- Tiap modul baru: + test + update `README.md`/`docs/API.md`.

## Pola Acuan Termutakhir
- Modul: `src/modules/access/` & `src/modules/setting/`
- Error: `src/errors/AppError.ts`
- Helpers: `src/helpers/functions.ts`
- Filter: `src/filters/app-exception.filter.ts`

## Perintah
```bash
npm run start:dev          # dev server (watch)
npm run migration:run      # jalankan migrasi
npm run migration:create   # buat file migrasi
npm run lint:conventions   # convention checker (WAJIB sebelum selesai)
npm test                   # semua Jest
npm run test:bdd           # BDD jest-cucumber
npm run test:cov           # coverage
npx tsc --noEmit           # type check
node scripts/make-module.js <Name>  # scaffold modul baru
```

## Catatan Claude Code
- Gunakan plan mode untuk perubahan multi-file besar.
- Verifikasi nyata (jalankan checker/test), jangan klaim tanpa bukti.
- Jangan tambah `process.env` langsung — selalu lewat ConfigService.
- Controller harus TIPIS — tanpa try/catch, tanpa logika bisnis.
- Module baru harus didaftarkan di `src/app.module.ts` imports array.
