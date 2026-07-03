# Panduan Membuat Modul Baru — NestAdmin

Langkah konkret + template untuk menambah modul agar **otomatis sejalan** dengan pola, prinsip, security, testing, dan dokumentasi yang ada. Contoh: modul **Product** (`name`, `status`, `description`). Ganti `Product`/`product` sesuai kebutuhan.

> Setelah selesai, WAJIB: `npm run lint:conventions` → `npx tsc --noEmit` → `npm test` (semua lolos). Aturan: lihat `AGENTS.md`.

> **Cepat:** Gunakan generator — `node scripts/make-module.js Product` — untuk scaffold otomatis semua file di bawah, lalu sesuaikan.

Struktur target:
```
src/modules/product/
├── product.module.ts
├── models/product.entity.ts
├── migrations/<ts>-CreateProductTable.ts
├── services/v1/
│   ├── IProductService.ts
│   └── ProductService.ts
├── controllers/
│   ├── web/v1/ProductWebController.ts
│   └── api/v1/ProductApiController.ts    (opsional)
└── views/be/default/product/
    ├── index.ejs
    ├── create.ejs
    └── edit.ejs

tests/integration/product.service.spec.ts
tests/api/product.spec.ts                  (bila ada API controller)
```

---

## 1. Entity — tipe portabel

```typescript
// src/modules/product/models/product.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum ProductStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 100 })
  @Index('products__name')
  name!: string

  @Column({ type: 'varchar', length: 20, default: ProductStatus.ACTIVE })
  status!: ProductStatus

  @Column({ type: 'text', nullable: true })   // ✅ 'text', BUKAN 'longtext'
  description?: string

  @CreateDateColumn()   // ✅ tanpa { type: ... }
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
```

**Aturan kolom:**
- Tipe portabel: `varchar`, `text`, `int`, `boolean`, `timestamp` — semua didukung SQLite/MySQL/Postgres.
- **Dilarang**: `longtext`, `mediumtext`, `datetime`, `collation: '...'`.
- `@CreateDateColumn()` / `@UpdateDateColumn()` tanpa argumen `{ type }` — biarkan TypeORM pilih tipe per dialect.

## 2. Migration

```bash
npm run migration:create   # buat file kosong, isi dengan TypeORM Table API
```

Isi pakai TypeORM `Table` API — **JANGAN** raw SQL vendor:

```typescript
// src/modules/product/migrations/<ts>-CreateProductTable.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm'

export class CreateProductTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          { name: 'id',          type: 'varchar',   length: '36', isPrimary: true },
          { name: 'name',        type: 'varchar',   length: '100', isNullable: false },
          { name: 'status',      type: 'varchar',   length: '20',  isNullable: false, default: "'Active'" },
          { name: 'description', type: 'text',                     isNullable: true },
          { name: 'created_at',  type: 'timestamp',                isNullable: false, default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at',  type: 'timestamp',                isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: 'products__name', columnNames: ['name'] },
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('products')
  }
}
```

Lihat `src/modules/access/migrations/1700000000000-InitialSchema.ts` sebagai acuan.

## 3. Interface Service

```typescript
// src/modules/product/services/v1/IProductService.ts
export interface IProductService {
  index(filter: Record<string, any>): Promise<any>
  create(): Promise<any>
  store(data: Record<string, any>): Promise<any>
  edit(id: string): Promise<any>
  update(id: string, data: Record<string, any>): Promise<any>
  delete(id: string): Promise<any>
}
```

## 4. Service — @Injectable, implements, throw AppError

```typescript
// src/modules/product/services/v1/ProductService.ts
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../../models/product.entity'
import { IProductService } from './IProductService'
import { paginate, ciLike, removePrefix, removeEmptyFields } from '../../../../helpers/functions'
import { AppError, NotFoundError, ConflictError } from '../../../../errors/AppError'

@Injectable()
export class ProductService implements IProductService {
  constructor(
    @InjectRepository(Product) private repo: Repository<Product>,
  ) {}

  async index(filter: Record<string, any>) {
    const clean = removePrefix(filter, 'q_')
    let query = this.repo.createQueryBuilder('products')
    if (clean.name)   query = query.andWhere(...ciLike('products.name', 'name', clean.name))
    if (clean.status) query = query.andWhere('products.status = :status', { status: clean.status })
    return paginate(query, clean)
  }

  async create() {
    return {}   // return data needed for create form (e.g. related lists)
  }

  async store(data: Record<string, any>) {
    const exists = await this.repo.findOne({ where: { name: data.name } })
    if (exists) throw new ConflictError('Product already exists')
    const clean = removeEmptyFields(data)
    const result = await this.repo.save(this.repo.create(clean))
    if (!result) throw new AppError('Store Product failed', 500)
    return result
  }

  async edit(id: string) {
    const data = await this.repo.findOne({ where: { id } })
    if (!data) throw new NotFoundError('Product not found')
    return { data }
  }

  async update(id: string, data: Record<string, any>) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundError('Product not found')
    const clean = removeEmptyFields(data)
    return this.repo.save(this.repo.merge(item, clean))
  }

  async delete(id: string) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundError('Product not found')
    return this.repo.remove(item)
  }
}
```

**Aturan service:**
- `@Injectable()` wajib.
- `implements I*Service` wajib.
- `@InjectRepository(Entity)` di constructor — JANGAN `new Repository()`.
- Selalu `throw AppError` (atau subkelas) — JANGAN `return error`.
- Pakai `paginate()` + `ciLike()` + `removeEmptyFields()` dari `src/helpers/functions.ts`.
- JANGAN `process.env` — gunakan `ConfigService` bila butuh config.
- JANGAN raw `.query()` — gunakan `createQueryBuilder()`.

## 5. Controller Web

```typescript
// src/modules/product/controllers/web/v1/ProductWebController.ts
import { Controller, Get, Post, Put, Delete, Param, Req, Res, Body, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { ProductService } from '../../../services/v1/ProductService'
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard'
import { routeRegistry } from '../../../../../utils/named-routes'

const BASE = '/admin/v1/product'

@Controller()
@UseGuards(SessionAuthGuard)
export class ProductWebController {
  constructor(private productService: ProductService) {
    routeRegistry.register('admin.v1.product.index',  'GET',    BASE)
    routeRegistry.register('admin.v1.product.create', 'GET',    `${BASE}/create`)
    routeRegistry.register('admin.v1.product.store',  'POST',   BASE)
    routeRegistry.register('admin.v1.product.edit',   'GET',    `${BASE}/:id/edit`)
    routeRegistry.register('admin.v1.product.update', 'PUT',    `${BASE}/:id`)
    routeRegistry.register('admin.v1.product.delete', 'DELETE', `${BASE}/:id`)
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>
    const result = await this.productService.index(filter)
    res.render('product/views/be/default/product/index', {
      title: 'Product Management',
      filter,
      ...result,
    })
  }

  @Get(`${BASE}/create`)
  async create(@Req() req: Request, @Res() res: Response) {
    await this.productService.create()
    res.render('product/views/be/default/product/create', { title: 'Create Product' })
  }

  @Post(BASE)
  async store(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    await this.productService.store(body)
    ;(req as any).flash?.('success', 'Product created successfully')
    res.redirect(BASE)
  }

  @Get(`${BASE}/:id/edit`)
  async edit(@Param('id') id: string, @Res() res: Response) {
    const result = await this.productService.edit(id)
    res.render('product/views/be/default/product/edit', { title: 'Edit Product', ...result })
  }

  @Put(`${BASE}/:id`)
  async update(@Param('id') id: string, @Body() body: any, @Req() req: Request, @Res() res: Response) {
    await this.productService.update(id, body)
    ;(req as any).flash?.('success', 'Product updated successfully')
    res.redirect(BASE)
  }

  @Delete(`${BASE}/:id`)
  async delete(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    await this.productService.delete(id)
    ;(req as any).flash?.('success', 'Product deleted successfully')
    res.redirect(BASE)
  }
}
```

**Aturan controller:**
- `@Controller()` wajib.
- `@UseGuards(SessionAuthGuard)` untuk web (session-based).
- Inject service via constructor — JANGAN `new ProductService()`.
- TIDAK ada logika bisnis — hanya parse req, panggil service, render/redirect.
- TIDAK ada try/catch — error dihandle `AppExceptionFilter`.
- Daftarkan named-routes via `routeRegistry.register(...)` di constructor (untuk RBAC auto-sync).

## 6. Controller API (opsional)

```typescript
// src/modules/product/controllers/api/v1/ProductApiController.ts
import { Controller, Get, Post, Put, Delete, Param, Req, Res, Body, UseGuards, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { ProductService } from '../../../services/v1/ProductService'
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard'

@Controller()
@UseGuards(JwtAuthGuard)
export class ProductApiController {
  constructor(private productService: ProductService) {}

  @Get('/api/v1/product')
  async index(@Req() req: any, @Res() res: Response) {
    const result = await this.productService.index(req.query)
    return res.json({ status: true, message: 'Success', data: result })
  }

  @Post('/api/v1/product')
  async store(@Body() body: any, @Res() res: Response) {
    const result = await this.productService.store(body)
    return res.status(HttpStatus.CREATED).json({ status: true, message: 'Product created', data: result })
  }

  @Get('/api/v1/product/:id')
  async edit(@Param('id') id: string, @Res() res: Response) {
    const result = await this.productService.edit(id)
    return res.json({ status: true, message: 'Success', data: result })
  }

  @Put('/api/v1/product/:id')
  async update(@Param('id') id: string, @Body() body: any, @Res() res: Response) {
    const result = await this.productService.update(id, body)
    return res.json({ status: true, message: 'Product updated', data: result })
  }

  @Delete('/api/v1/product/:id')
  async delete(@Param('id') id: string, @Res() res: Response) {
    await this.productService.delete(id)
    return res.json({ status: true, message: 'Product deleted', data: null })
  }
}
```

## 7. Module Declaration

```typescript
// src/modules/product/product.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Product } from './models/product.entity'
import { ProductService } from './services/v1/ProductService'
import { ProductWebController } from './controllers/web/v1/ProductWebController'
import { ProductApiController } from './controllers/api/v1/ProductApiController'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    AuthModule,
  ],
  controllers: [ProductWebController, ProductApiController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
```

Daftarkan di `src/app.module.ts`:
```typescript
import { ProductModule } from './modules/product/product.module'

@Module({
  imports: [
    // ... existing modules
    ProductModule,
  ],
})
export class AppModule {}
```

## 8. Views (EJS + Tailwind)

Salin pola dari `src/modules/access/views/be/default/users/` atau gunakan generator.

- **index.ejs**: tabel + search form + pagination
- **create.ejs**: form kosong + CSRF token
- **edit.ejs**: form terisi data + `?_method=PUT`

CSRF token injection:
```html
<input type="hidden" name="_csrf" value="<%= typeof csrfToken !== 'undefined' ? csrfToken : '' %>">
```

Method override (form HTML hanya GET/POST):
```html
<!-- UPDATE -->
<form method="POST" action="/admin/v1/product/<%= data.id %>?_method=PUT">
<!-- DELETE -->
<form method="POST" action="/admin/v1/product/<%= item.id %>?_method=DELETE"
      onsubmit="return confirm('Delete?')">
```

## 9. Test

### Integration test (wajib)
```typescript
// tests/integration/product.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductService } from '../../src/modules/product/services/v1/ProductService'
import { Product } from '../../src/modules/product/models/product.entity'

describe('ProductService (integration)', () => {
  let service: ProductService
  let module: TestingModule

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          synchronize: true,
          entities: [Product],
        }),
        TypeOrmModule.forFeature([Product]),
      ],
      providers: [ProductService],
    }).compile()

    service = module.get<ProductService>(ProductService)
  })

  afterAll(() => module.close())

  it('store: creates a product', async () => {
    const result = await service.store({ name: 'Test', status: 'Active' })
    expect(result).toHaveProperty('id')
  })

  it('store: rejects duplicate name', async () => {
    await service.store({ name: 'Dup' })
    await expect(service.store({ name: 'Dup' })).rejects.toThrow()
  })

  it('edit: throws for unknown id', async () => {
    await expect(service.edit('not-found')).rejects.toThrow()
  })
})
```

### API test (bila ada API controller)
```typescript
// tests/api/product.spec.ts
import * as request from 'supertest'
import { Test } from '@nestjs/testing'
// ... bootstrap NestJS test app, login JWT, test endpoints
```

## 10. Dokumentasi

- `README.md` → tambah fitur Product.
- `docs/API.md` → tambah endpoint bila ada API controller.

## 11. Verifikasi Akhir

```bash
npm run lint:conventions   # harus lolos
npx tsc --noEmit           # 0 error
npm test                   # hijau (termasuk test Product baru)
```
