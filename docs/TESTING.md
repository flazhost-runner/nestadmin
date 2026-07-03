# Testing — NestAdmin

Suite pengujian menyeluruh: **Unit, Integration, API, Security, Smoke, dan BDD**. CI menjalankan Jest + audit + matrix DB (SQLite/MySQL/Postgres). **E2E dijalankan lokal** (Playwright, jika ditambahkan).

## Stack

| Layer | Tool |
|-------|------|
| Test runner | Jest + ts-jest |
| HTTP assertion | supertest (in-process, tanpa listen port) |
| NestJS test | `@nestjs/testing` — `Test.createTestingModule()` |
| DB test | better-sqlite3 (in-memory) — portabilitas terjamin |
| BDD | jest-cucumber (Gherkin feature files) |
| Mock | `jest.fn()`, `jest.mock()` |

## Konfigurasi

- **`tests/.env.test`** (atau `.env.test` di root) — env khusus test: SQLite in-memory, secret dummy, `NODE_ENV=test`.
- **`jest` config di `package.json`**:
  - `rootDir: "."`, `testMatch: ["<rootDir>/tests/**/*.spec.ts", ".../*.test.ts"]`
  - `setupFiles: ["<rootDir>/tests/setup/loadEnv.ts"]`
  - `setupFilesAfterFramework: ["<rootDir>/tests/setup/jest.setup.ts"]`
- **`tests/setup/`**:
  - `loadEnv.ts` — muat `.env.test` paling awal (sebelum module NestJS di-import).
  - `jest.setup.ts` — mock Redis/OSS bila ada, setup global seed helper.

## Struktur

```
tests/
├── setup/
│   ├── loadEnv.ts           # dotenv .env.test loader
│   └── jest.setup.ts        # global mock + seed helper
├── unit/                    # helper murni (functions, otp, env)
├── integration/             # service ↔ SQLite in-memory
│   └── *.service.spec.ts
├── api/                     # endpoint via supertest
│   └── *.spec.ts
├── security/                # RBAC, CSRF, rate-limit, JWT
│   └── *.spec.ts
├── smoke/                   # health, login, DB connect
│   └── *.spec.ts
└── bdd/
    ├── features/            # *.feature (Gherkin)
    └── steps/               # step definitions
```

## Menjalankan

```bash
npm test                  # semua Jest (unit+integration+api+security+smoke)
npm run test:unit         # --testPathPattern=tests/unit
npm run test:integration  # --testPathPattern=tests/integration
npm run test:api          # --testPathPattern=tests/api
npm run test:security     # --testPathPattern=tests/security
npm run test:smoke        # --testPathPattern=tests/smoke
npm run test:bdd          # --testPathPattern=tests/bdd
npm run test:cov          # coverage report di coverage/
```

## Menulis Test Baru

### Unit test (helper murni)
```typescript
// tests/unit/functions.spec.ts
import { ciLike, removeEmptyFields, paginate } from '../../src/helpers/functions'

describe('ciLike', () => {
  it('wraps value in LOWER() LIKE LOWER()', () => {
    const [sql, params] = ciLike('users.name', 'name', 'admin')
    expect(sql).toBe('LOWER(users.name) LIKE LOWER(:name)')
    expect(params).toEqual({ name: '%admin%' })
  })
})
```

### Integration test (service ↔ SQLite)
```typescript
// tests/integration/product.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductService } from '../../src/modules/product/services/v1/ProductService'
import { Product } from '../../src/modules/product/models/product.entity'

describe('ProductService', () => {
  let service: ProductService
  let app: TestingModule

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          synchronize: true,       // auto-create tables from entity
          entities: [Product],
        }),
        TypeOrmModule.forFeature([Product]),
      ],
      providers: [ProductService],
    }).compile()

    service = app.get<ProductService>(ProductService)
  })

  afterAll(() => app.close())

  it('store + reject duplicate', async () => {
    const item = await service.store({ name: 'A', status: 'Active' })
    expect(item.name).toBe('A')
    await expect(service.store({ name: 'A' })).rejects.toThrow()
  })

  it('edit throws NotFoundError for unknown id', async () => {
    await expect(service.edit('unknown')).rejects.toThrow()
  })
})
```

**Pola kunci integration test:**
- `TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', synchronize: true, entities: [...] })` — SQLite in-memory.
- `synchronize: true` — auto-create tables; tidak perlu jalankan migration di test.
- `beforeAll` / `afterAll` — satu module per describe (efficient).
- Untuk reset data antar test: bisa gunakan `repository.clear()` di `beforeEach`.

### API test (supertest)
```typescript
// tests/api/auth.spec.ts
import * as request from 'supertest'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../../src/app.module'

describe('Auth API', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('POST /api/v1/auth/login — sukses', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@admin.com', password: '12345678' })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('access_token')
  })

  it('POST /api/v1/auth/login — salah password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@admin.com', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body.status).toBe(false)
  })
})
```

**Helper login JWT untuk test:**
```typescript
// tests/setup/helpers.ts
export async function loginApi(app: INestApplication, email = 'admin@admin.com', password = '12345678') {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
  return res.body.data?.access_token as string
}
```

Gunakan di test:
```typescript
const token = await loginApi(app)
const res = await request(app.getHttpServer())
  .get('/api/v1/access/user')
  .set('Authorization', `Bearer ${token}`)
expect(res.status).toBe(200)
```

### BDD (jest-cucumber)
```gherkin
# tests/bdd/features/product.feature
Feature: Product Management

  Scenario: Create a new product
    Given I am logged in as admin
    When I create a product with name "Laptop"
    Then the product "Laptop" should exist
```

```typescript
// tests/bdd/steps/product.steps.ts
import { loadFeature, defineFeature } from 'jest-cucumber'
import * as request from 'supertest'

const feature = loadFeature('tests/bdd/features/product.feature')

defineFeature(feature, test => {
  test('Create a new product', ({ given, when, then }) => {
    let token: string
    let productId: string

    given('I am logged in as admin', async () => {
      token = await loginApi(app)
    })

    when(/^I create a product with name "(.*)"$/, async (name) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/product')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, status: 'Active' })
      productId = res.body.data?.id
    })

    then(/^the product "(.*)" should exist$/, async (name) => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/product/${productId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.body.data.data.name).toBe(name)
    })
  })
})
```

## Pemetaan Jenis Testing

| Jenis | Di mana | Kapan wajib |
|-------|---------|-------------|
| Unit | `tests/unit/` | Helper murni (functions, otp) |
| Integration | `tests/integration/` | Tiap modul ber-service |
| API | `tests/api/` | Bila ada API controller |
| Security | `tests/security/` | RBAC, CSRF, rate-limit |
| Smoke | `tests/smoke/` | Health, login, DB connect |
| BDD | `tests/bdd/` | Fitur user-facing |

## CI

`.github/workflows/ci.yml`:
- **lint**: ESLint + convention checker + tsc --noEmit
- **test**: Jest --coverage (SQLite in-memory)
- **audit**: npm audit --audit-level=moderate
- **db-compat**: migrasi di matrix SQLite/MySQL/Postgres

> **E2E (Playwright) tidak di CI** — jalankan lokal sebelum push: butuh server hidup + DB nyata.

## Tips

- Tiap test integration **buat `TestingModule` sendiri** — jangan share state antar describe.
- `synchronize: true` hanya untuk test (SQLite) — production pakai migrasi.
- Mock `ConfigService` bila service membutuhkannya:
  ```typescript
  import { ConfigModule } from '@nestjs/config'
  // atau
  providers: [
    { provide: ConfigService, useValue: { get: (k: string) => process.env[k] } },
  ]
  ```
- Test harus jalan tanpa port terbuka — gunakan `app.getHttpServer()` (supertest langsung ke Express instance).
