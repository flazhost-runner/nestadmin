#!/usr/bin/env node
/**
 * NestAdmin Module Generator
 * Usage: node scripts/make-module.js <ModuleName>
 * Example: node scripts/make-module.js Product
 *
 * Generates a full CRUD module scaffold following AGENTS.md patterns.
 * After generation, run: npm run lint:conventions && npx tsc --noEmit && npm test
 */
'use strict'

const fs = require('fs')
const path = require('path')

// ─── CLI arg ──────────────────────────────────────────────────────────────────

const [, , rawName] = process.argv
if (!rawName) {
  console.error('Usage: node scripts/make-module.js <ModuleName>')
  console.error('Example: node scripts/make-module.js Product')
  process.exit(1)
}

// Normalize: PascalCase for class names, kebab/lower for paths
const Name = rawName.charAt(0).toUpperCase() + rawName.slice(1)   // Product
const name = rawName.charAt(0).toLowerCase() + rawName.slice(1)   // product
const nameLower = rawName.toLowerCase()                             // product
const nameUpper = rawName.toUpperCase()                             // PRODUCT
const names = nameLower + 's'                                       // products (simple plural)

const ROOT = path.resolve(__dirname, '..')
const MODULE_DIR = path.join(ROOT, 'src', 'modules', nameLower)
const TESTS_DIR = path.join(ROOT, 'tests')

const created = []

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function write(filePath, content) {
  const dir = path.dirname(filePath)
  mkdirp(dir)
  if (fs.existsSync(filePath)) {
    console.warn(`  SKIP (exists): ${path.relative(ROOT, filePath)}`)
    return
  }
  fs.writeFileSync(filePath, content, 'utf8')
  created.push(path.relative(ROOT, filePath))
  console.log(`  CREATE: ${path.relative(ROOT, filePath)}`)
}

// ─── Templates ────────────────────────────────────────────────────────────────

function tEntity() {
  return `import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum ${Name}Status {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

@Entity('${names}')
export class ${Name} {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 100 })
  @Index('${names}__name')
  name!: string

  @Column({ type: 'varchar', length: 20, default: ${Name}Status.ACTIVE })
  status!: ${Name}Status

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
`
}

function tMigration() {
  const ts = Date.now()
  return `import { MigrationInterface, QueryRunner, Table } from 'typeorm'

export class Create${Name}Table${ts} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: '${names}',
        columns: [
          { name: 'id',          type: 'varchar',   length: '36',  isPrimary: true },
          { name: 'name',        type: 'varchar',   length: '100', isNullable: false },
          { name: 'status',      type: 'varchar',   length: '20',  isNullable: false, default: "'Active'" },
          { name: 'description', type: 'text',                     isNullable: true  },
          { name: 'created_at',  type: 'timestamp',                isNullable: false, default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at',  type: 'timestamp',                isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: '${names}__name', columnNames: ['name'] },
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('${names}')
  }
}
`
}

function tIService() {
  return `export interface I${Name}Service {
  index(filter: Record<string, any>): Promise<any>
  create(): Promise<any>
  store(data: Record<string, any>): Promise<any>
  edit(id: string): Promise<any>
  update(id: string, data: Record<string, any>): Promise<any>
  delete(id: string): Promise<any>
}
`
}

function tService() {
  return `import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ${Name} } from '../../models/${nameLower}.entity'
import { I${Name}Service } from './I${Name}Service'
import { paginate, ciLike, removePrefix, removeEmptyFields } from '../../../../helpers/functions'
import { AppError, NotFoundError, ConflictError } from '../../../../errors/AppError'

@Injectable()
export class ${Name}Service implements I${Name}Service {
  constructor(
    @InjectRepository(${Name}) private repo: Repository<${Name}>,
  ) {}

  async index(filter: Record<string, any>) {
    const clean = removePrefix(filter, 'q_')
    let query = this.repo.createQueryBuilder('${names}')
    if (clean.name)   query = query.andWhere(...ciLike('${names}.name', 'name', clean.name))
    if (clean.status) query = query.andWhere('${names}.status = :status', { status: clean.status })
    return paginate(query, clean)
  }

  async create() {
    return {}
  }

  async store(data: Record<string, any>) {
    const exists = await this.repo.findOne({ where: { name: data.name } })
    if (exists) throw new ConflictError('${Name} already exists')
    const clean = removeEmptyFields(data)
    const result = await this.repo.save(this.repo.create(clean))
    if (!result) throw new AppError('Store ${Name} failed', 500)
    return result
  }

  async edit(id: string) {
    const data = await this.repo.findOne({ where: { id } })
    if (!data) throw new NotFoundError('${Name} not found')
    return { data }
  }

  async update(id: string, data: Record<string, any>) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundError('${Name} not found')
    const clean = removeEmptyFields(data)
    return this.repo.save(this.repo.merge(item, clean))
  }

  async delete(id: string) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundError('${Name} not found')
    return this.repo.remove(item)
  }
}
`
}

function tWebController() {
  const BASE = `/admin/v1/${nameLower}`
  return `import { Controller, Get, Post, Put, Delete, Param, Req, Res, Body, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { ${Name}Service } from '../../../services/v1/${Name}Service'
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard'
import { routeRegistry } from '../../../../../utils/named-routes'

const BASE = '${BASE}'

@Controller()
@UseGuards(SessionAuthGuard)
export class ${Name}WebController {
  constructor(private ${name}Service: ${Name}Service) {
    routeRegistry.register('admin.v1.${nameLower}.index',  'GET',    BASE)
    routeRegistry.register('admin.v1.${nameLower}.create', 'GET',    \`\${BASE}/create\`)
    routeRegistry.register('admin.v1.${nameLower}.store',  'POST',   BASE)
    routeRegistry.register('admin.v1.${nameLower}.edit',   'GET',    \`\${BASE}/:id/edit\`)
    routeRegistry.register('admin.v1.${nameLower}.update', 'PUT',    \`\${BASE}/:id\`)
    routeRegistry.register('admin.v1.${nameLower}.delete', 'DELETE', \`\${BASE}/:id\`)
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>
    const result = await this.${name}Service.index(filter)
    res.render('${nameLower}/views/be/default/${nameLower}/index', {
      title: '${Name} Management',
      filter,
      ...result,
    })
  }

  @Get(\`\${BASE}/create\`)
  async create(@Req() req: Request, @Res() res: Response) {
    await this.${name}Service.create()
    res.render('${nameLower}/views/be/default/${nameLower}/create', {
      title: 'Create ${Name}',
    })
  }

  @Post(BASE)
  async store(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    await this.${name}Service.store(body)
    ;(req as any).flash?.('success', '${Name} created successfully')
    res.redirect(BASE)
  }

  @Get(\`\${BASE}/:id/edit\`)
  async edit(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const result = await this.${name}Service.edit(id)
    res.render('${nameLower}/views/be/default/${nameLower}/edit', {
      title: 'Edit ${Name}',
      ...result,
    })
  }

  @Put(\`\${BASE}/:id\`)
  async update(@Param('id') id: string, @Body() body: any, @Req() req: Request, @Res() res: Response) {
    await this.${name}Service.update(id, body)
    ;(req as any).flash?.('success', '${Name} updated successfully')
    res.redirect(BASE)
  }

  @Delete(\`\${BASE}/:id\`)
  async delete(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    await this.${name}Service.delete(id)
    ;(req as any).flash?.('success', '${Name} deleted successfully')
    res.redirect(BASE)
  }
}
`
}

function tApiController() {
  const BASE = `/api/v1/${nameLower}`
  return `import { Controller, Get, Post, Put, Delete, Param, Req, Res, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'
import { ${Name}Service } from '../../../services/v1/${Name}Service'
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard'

const BASE = '${BASE}'

@Controller()
@UseGuards(JwtAuthGuard)
export class ${Name}ApiController {
  constructor(private ${name}Service: ${Name}Service) {}

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>
    const result = await this.${name}Service.index(filter)
    return res.json({ status: true, message: 'Success', data: result })
  }

  @Post(BASE)
  @HttpCode(HttpStatus.CREATED)
  async store(@Body() body: any, @Res() res: Response) {
    const result = await this.${name}Service.store(body)
    return res.status(HttpStatus.CREATED).json({ status: true, message: '${Name} created', data: result })
  }

  @Get(\`\${BASE}/:id\`)
  async edit(@Param('id') id: string, @Res() res: Response) {
    const result = await this.${name}Service.edit(id)
    return res.json({ status: true, message: 'Success', data: result })
  }

  @Put(\`\${BASE}/:id\`)
  async update(@Param('id') id: string, @Body() body: any, @Res() res: Response) {
    const result = await this.${name}Service.update(id, body)
    return res.json({ status: true, message: '${Name} updated', data: result })
  }

  @Delete(\`\${BASE}/:id\`)
  async delete(@Param('id') id: string, @Res() res: Response) {
    await this.${name}Service.delete(id)
    return res.json({ status: true, message: '${Name} deleted', data: null })
  }
}
`
}

function tModule() {
  return `import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ${Name} } from './models/${nameLower}.entity'
import { ${Name}Service } from './services/v1/${Name}Service'
import { ${Name}WebController } from './controllers/web/v1/${Name}WebController'
import { ${Name}ApiController } from './controllers/api/v1/${Name}ApiController'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([${Name}]),
    AuthModule,
  ],
  controllers: [
    ${Name}WebController,
    ${Name}ApiController,
  ],
  providers: [${Name}Service],
  exports: [${Name}Service],
})
export class ${Name}Module {}
`
}

function tViewIndex() {
  return `<%- include(be_layout + '/head', { title: title }) %>
<%- include(be_layout + '/topbar') %>
<%- include(be_layout + '/sidebar') %>

<main class="p-4 md:ml-64 pt-20">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold">${Name} Management</h1>
    <a href="/admin/v1/${nameLower}/create"
       class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
      + Add ${Name}
    </a>
  </div>

  <%# Flash messages %>
  <% if (typeof flash !== 'undefined' && flash?.success) { %>
    <div class="mb-4 p-3 bg-green-100 text-green-800 rounded"><%= flash.success %></div>
  <% } %>

  <%# Search form %>
  <form method="GET" class="flex gap-2 mb-4">
    <input type="text" name="q_name" value="<%= filter?.q_name ?? '' %>"
           placeholder="Search name..." class="border rounded px-3 py-1.5 text-sm flex-1" />
    <select name="q_status" class="border rounded px-3 py-1.5 text-sm">
      <option value="">All Status</option>
      <option value="Active"   <%= filter?.q_status === 'Active'   ? 'selected' : '' %>>Active</option>
      <option value="Inactive" <%= filter?.q_status === 'Inactive' ? 'selected' : '' %>>Inactive</option>
    </select>
    <button type="submit" class="px-4 py-1.5 bg-gray-600 text-white rounded text-sm">Search</button>
    <a href="/admin/v1/${nameLower}" class="px-4 py-1.5 bg-gray-200 rounded text-sm">Reset</a>
  </form>

  <%# Table %>
  <div class="overflow-x-auto bg-white rounded shadow">
    <table class="w-full text-sm text-left">
      <thead class="bg-gray-50 text-gray-600 uppercase text-xs">
        <tr>
          <th class="px-4 py-3">#</th>
          <th class="px-4 py-3">Name</th>
          <th class="px-4 py-3">Status</th>
          <th class="px-4 py-3">Created</th>
          <th class="px-4 py-3">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <% datas.forEach((item, i) => { %>
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3"><%= (paginate_data.page - 1) * paginate_data.page_size + i + 1 %></td>
          <td class="px-4 py-3 font-medium"><%= item.name %></td>
          <td class="px-4 py-3">
            <% if (item.status === 'Active') { %>
              <span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Active</span>
            <% } else { %>
              <span class="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Inactive</span>
            <% } %>
          </td>
          <td class="px-4 py-3"><%= item.created_at?.toLocaleDateString() ?? '' %></td>
          <td class="px-4 py-3 flex gap-2">
            <a href="/admin/v1/${nameLower}/<%= item.id %>/edit"
               class="text-blue-600 hover:underline text-xs">Edit</a>
            <form method="POST" action="/admin/v1/${nameLower}/<%= item.id %>?_method=DELETE"
                  onsubmit="return confirm('Delete this ${name}?')">
              <input type="hidden" name="_csrf" value="<%= typeof csrfToken !== 'undefined' ? csrfToken : '' %>">
              <button type="submit" class="text-red-600 hover:underline text-xs">Delete</button>
            </form>
          </td>
        </tr>
        <% }) %>
        <% if (!datas.length) { %>
        <tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">No records found.</td></tr>
        <% } %>
      </tbody>
    </table>
  </div>

  <%# Pagination %>
  <% if (paginate_data.total_pages > 1) { %>
  <div class="flex gap-2 mt-4 items-center text-sm">
    <% if (paginate_data.has_prev) { %>
      <a href="?q_page=<%= paginate_data.page - 1 %>" class="px-3 py-1 rounded border hover:bg-gray-100">Prev</a>
    <% } %>
    <span class="text-gray-600">Page <%= paginate_data.page %> / <%= paginate_data.total_pages %></span>
    <% if (paginate_data.has_next) { %>
      <a href="?q_page=<%= paginate_data.page + 1 %>" class="px-3 py-1 rounded border hover:bg-gray-100">Next</a>
    <% } %>
  </div>
  <% } %>
</main>

<%- include(be_layout + '/foot') %>
`
}

function tViewCreate() {
  return `<%- include(be_layout + '/head', { title: title }) %>
<%- include(be_layout + '/topbar') %>
<%- include(be_layout + '/sidebar') %>

<main class="p-4 md:ml-64 pt-20">
  <div class="flex items-center gap-2 mb-6">
    <a href="/admin/v1/${nameLower}" class="text-gray-500 hover:text-gray-700">← Back</a>
    <h1 class="text-xl font-semibold">Create ${Name}</h1>
  </div>

  <% if (typeof errors !== 'undefined' && errors?.length) { %>
    <div class="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
      <ul class="list-disc list-inside">
        <% errors.forEach(e => { %><li><%= e.msg %></li><% }) %>
      </ul>
    </div>
  <% } %>

  <form method="POST" action="/admin/v1/${nameLower}" class="bg-white rounded shadow p-6 max-w-lg space-y-4">
    <input type="hidden" name="_csrf" value="<%= typeof csrfToken !== 'undefined' ? csrfToken : '' %>">

    <div>
      <label class="block text-sm font-medium mb-1">Name <span class="text-red-500">*</span></label>
      <input type="text" name="name" value="<%= typeof old !== 'undefined' ? old?.name ?? '' : '' %>"
             class="border rounded w-full px-3 py-2 text-sm" required />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Description</label>
      <textarea name="description" rows="3"
                class="border rounded w-full px-3 py-2 text-sm"><%= typeof old !== 'undefined' ? old?.description ?? '' : '' %></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Status</label>
      <select name="status" class="border rounded w-full px-3 py-2 text-sm">
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
      </select>
    </div>

    <div class="flex gap-3">
      <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
        Save
      </button>
      <a href="/admin/v1/${nameLower}" class="px-6 py-2 bg-gray-200 rounded text-sm">Cancel</a>
    </div>
  </form>
</main>

<%- include(be_layout + '/foot') %>
`
}

function tViewEdit() {
  return `<%- include(be_layout + '/head', { title: title }) %>
<%- include(be_layout + '/topbar') %>
<%- include(be_layout + '/sidebar') %>

<main class="p-4 md:ml-64 pt-20">
  <div class="flex items-center gap-2 mb-6">
    <a href="/admin/v1/${nameLower}" class="text-gray-500 hover:text-gray-700">← Back</a>
    <h1 class="text-xl font-semibold">Edit ${Name}</h1>
  </div>

  <% if (typeof errors !== 'undefined' && errors?.length) { %>
    <div class="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
      <ul class="list-disc list-inside">
        <% errors.forEach(e => { %><li><%= e.msg %></li><% }) %>
      </ul>
    </div>
  <% } %>

  <form method="POST" action="/admin/v1/${nameLower}/<%= data.id %>?_method=PUT"
        class="bg-white rounded shadow p-6 max-w-lg space-y-4">
    <input type="hidden" name="_csrf" value="<%= typeof csrfToken !== 'undefined' ? csrfToken : '' %>">
    <input type="hidden" name="_method" value="PUT">

    <div>
      <label class="block text-sm font-medium mb-1">Name <span class="text-red-500">*</span></label>
      <input type="text" name="name"
             value="<%= typeof old !== 'undefined' ? old?.name ?? data.name : data.name %>"
             class="border rounded w-full px-3 py-2 text-sm" required />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Description</label>
      <textarea name="description" rows="3" class="border rounded w-full px-3 py-2 text-sm"><%= typeof old !== 'undefined' ? old?.description ?? data.description ?? '' : data.description ?? '' %></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Status</label>
      <select name="status" class="border rounded w-full px-3 py-2 text-sm">
        <option value="Active"   <%= data.status === 'Active'   ? 'selected' : '' %>>Active</option>
        <option value="Inactive" <%= data.status === 'Inactive' ? 'selected' : '' %>>Inactive</option>
      </select>
    </div>

    <div class="flex gap-3">
      <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
        Update
      </button>
      <a href="/admin/v1/${nameLower}" class="px-6 py-2 bg-gray-200 rounded text-sm">Cancel</a>
    </div>
  </form>
</main>

<%- include(be_layout + '/foot') %>
`
}

function tIntegrationTest() {
  return `import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ${Name}Service } from '../../src/modules/${nameLower}/services/v1/${Name}Service'
import { ${Name} } from '../../src/modules/${nameLower}/models/${nameLower}.entity'

describe('${Name}Service (integration)', () => {
  let service: ${Name}Service
  let module: TestingModule

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          synchronize: true,
          entities: [${Name}],
        }),
        TypeOrmModule.forFeature([${Name}]),
      ],
      providers: [${Name}Service],
    }).compile()

    service = module.get<${Name}Service>(${Name}Service)
  })

  afterAll(async () => {
    await module.close()
  })

  it('store: creates a new ${name}', async () => {
    const result = await service.store({ name: 'Test ${Name}', status: 'Active' })
    expect(result).toHaveProperty('id')
    expect(result.name).toBe('Test ${Name}')
  })

  it('store: rejects duplicate name', async () => {
    await service.store({ name: 'Unique ${Name}' })
    await expect(service.store({ name: 'Unique ${Name}' })).rejects.toThrow()
  })

  it('index: returns paginated results', async () => {
    const result = await service.index({})
    expect(result).toHaveProperty('datas')
    expect(result).toHaveProperty('paginate_data')
  })

  it('edit: returns ${name} by id', async () => {
    const created = await service.store({ name: 'Edit Test ${Name}' })
    const result = await service.edit(created.id)
    expect(result.data.id).toBe(created.id)
  })

  it('edit: throws NotFoundError for unknown id', async () => {
    await expect(service.edit('non-existent-id')).rejects.toThrow()
  })

  it('update: updates ${name} fields', async () => {
    const created = await service.store({ name: 'Before Update ${Name}' })
    const result = await service.update(created.id, { name: 'After Update ${Name}' })
    expect(result.name).toBe('After Update ${Name}')
  })

  it('delete: removes ${name}', async () => {
    const created = await service.store({ name: 'To Delete ${Name}' })
    await service.delete(created.id)
    await expect(service.edit(created.id)).rejects.toThrow()
  })
})
`
}

// ─── Generate files ───────────────────────────────────────────────────────────

console.log(`\nGenerating module: ${Name}\n`)

// Entity
write(
  path.join(MODULE_DIR, 'models', `${nameLower}.entity.ts`),
  tEntity(),
)

// Migration
const migrationTs = Date.now()
write(
  path.join(MODULE_DIR, 'migrations', `${migrationTs}-Create${Name}Table.ts`),
  tMigration(),
)

// IService
write(
  path.join(MODULE_DIR, 'services', 'v1', `I${Name}Service.ts`),
  tIService(),
)

// Service
write(
  path.join(MODULE_DIR, 'services', 'v1', `${Name}Service.ts`),
  tService(),
)

// Web Controller
write(
  path.join(MODULE_DIR, 'controllers', 'web', 'v1', `${Name}WebController.ts`),
  tWebController(),
)

// API Controller
write(
  path.join(MODULE_DIR, 'controllers', 'api', 'v1', `${Name}ApiController.ts`),
  tApiController(),
)

// Module
write(
  path.join(MODULE_DIR, `${nameLower}.module.ts`),
  tModule(),
)

// Views
write(path.join(MODULE_DIR, 'views', 'be', 'default', nameLower, 'index.ejs'), tViewIndex())
write(path.join(MODULE_DIR, 'views', 'be', 'default', nameLower, 'create.ejs'), tViewCreate())
write(path.join(MODULE_DIR, 'views', 'be', 'default', nameLower, 'edit.ejs'), tViewEdit())

// Integration test
write(
  path.join(TESTS_DIR, 'integration', `${nameLower}.service.spec.ts`),
  tIntegrationTest(),
)

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n✅ Module ${Name} generated (${created.length} files created)\n`)
console.log('Next steps:')
console.log(`  1. Add ${Name}Module to src/app.module.ts imports array:`)
console.log(`       import { ${Name}Module } from './modules/${nameLower}/${nameLower}.module'`)
console.log(`       // add ${Name}Module to @Module imports: [...]`)
console.log(`  2. Add the ${Name} entity to src/config/ormconfig.ts entities list`)
console.log(`  3. Register the migration file path in ormconfig.ts migrations list`)
console.log('  4. Run: npm run migration:run')
console.log('  5. Run: npm run lint:conventions && npx tsc --noEmit && npm test')
console.log(`\n  API routes (JWT):`)
console.log(`    GET    /api/v1/${nameLower}        — list`)
console.log(`    POST   /api/v1/${nameLower}        — create`)
console.log(`    GET    /api/v1/${nameLower}/:id    — detail`)
console.log(`    PUT    /api/v1/${nameLower}/:id    — update`)
console.log(`    DELETE /api/v1/${nameLower}/:id    — delete`)
console.log(`\n  Web routes (session):`)
console.log(`    GET    /admin/v1/${nameLower}              — index`)
console.log(`    GET    /admin/v1/${nameLower}/create       — create form`)
console.log(`    POST   /admin/v1/${nameLower}              — store`)
console.log(`    GET    /admin/v1/${nameLower}/:id/edit     — edit form`)
console.log(`    PUT    /admin/v1/${nameLower}/:id          — update`)
console.log(`    DELETE /admin/v1/${nameLower}/:id          — delete`)
