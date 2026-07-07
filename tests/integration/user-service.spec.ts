/**
 * Integration tests: UserService with SQLite :memory:
 * Uses @nestjs/testing TestingModule — isolated per suite.
 */
import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { UserService } from '../../src/modules/access/services/v1/UserService'
import { User } from '../../src/modules/access/models/user.entity'
import { Role } from '../../src/modules/access/models/role.entity'
import { Permission } from '../../src/modules/access/models/permission.entity'
import { Setting } from '../../src/modules/setting/models/setting.entity'
import { InitialSchema1700000000000 } from '../../src/modules/access/migrations/1700000000000-InitialSchema'
import { resetDb, ADMIN } from '../setup/jest.setup'

describe('UserService (integration, SQLite :memory:)', () => {
  let module: TestingModule
  let service: UserService
  let ds: DataSource
  let userRoleId: string

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [User, Role, Permission, Setting],
          migrations: [InitialSchema1700000000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([User, Role, Permission]),
      ],
      providers: [UserService],
    }).compile()

    service = module.get(UserService)
    ds = module.get(DataSource)
  })

  afterAll(async () => {
    await module.close()
  })

  beforeEach(async () => {
    const seed = await resetDb(ds)
    userRoleId = seed.userRoleId
  })

  // -------------------------------------------------------------------------
  // store
  // -------------------------------------------------------------------------
  describe('store()', () => {
    it('creates a user with a valid role', async () => {
      const result: any = await service.store({
        code: 'TST001',
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        status: 'Active',
        roles: [userRoleId],
      })
      expect(result.email).toBe('test@example.com')
      expect(result.password).not.toBe('password123') // hashed
    })

    it('throws 404 when role does not exist', async () => {
      await expect(
        service.store({
          code: 'TST002',
          name: 'Bad',
          email: 'bad@example.com',
          password: 'password123',
          status: 'Active',
          roles: ['non-existent-role-id'],
        }),
      ).rejects.toThrow()
    })

    it('throws when required fields missing (password)', async () => {
      await expect(
        service.store({
          code: 'TST003',
          name: 'NoPass',
          email: 'nopass@example.com',
          roles: [userRoleId],
        }),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // index
  // -------------------------------------------------------------------------
  describe('index()', () => {
    it('returns paginated list with roles lookup', async () => {
      const result = await service.index({})
      expect(result.datas.length).toBeGreaterThanOrEqual(2) // admin + user seeds
      expect(result.paginate_data).toHaveProperty('total')
      expect(Array.isArray(result.roles)).toBe(true)
    })

    it('filters by email (case-insensitive)', async () => {
      const result = await service.index({ q_email: ADMIN.email.toUpperCase() })
      expect(result.datas.some((u: any) => u.email === ADMIN.email)).toBe(true)
    })

    it('filters by status', async () => {
      const result = await service.index({ q_status: 'Active' })
      result.datas.forEach((u: any) => expect(u.status).toBe('Active'))
    })

    it('respects page_size pagination', async () => {
      // UserService.index() calls removePrefix(filter, 'q_') before paginate(),
      // so pagination params must be prefixed with q_
      const result = await service.index({ q_page: '1', q_page_size: '1' })
      expect(result.datas.length).toBe(1)
      expect(result.paginate_data.page_size).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // edit
  // -------------------------------------------------------------------------
  describe('edit()', () => {
    it('returns user + roles for existing id', async () => {
      const all = await service.index({})
      const id = all.datas[0].id
      const result = await service.edit(id)
      expect(result.data).toBeTruthy()
      expect(Array.isArray(result.roles)).toBe(true)
    })

    it('throws 404 for non-existent id', async () => {
      await expect(
        service.edit('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('updates name successfully', async () => {
      const created: any = await service.store({
        code: 'UPD001',
        name: 'Old Name',
        email: 'old@example.com',
        password: 'password123',
        status: 'Active',
        roles: [userRoleId],
      })
      const result: any = await service.update(created.id, {
        name: 'New Name',
        roles: [userRoleId],
      })
      expect(result.name).toBe('New Name')
    })

    it('throws 404 for non-existent user', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', {
          name: 'Ghost',
          roles: [userRoleId],
        }),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('deletes an existing user', async () => {
      const created: any = await service.store({
        code: 'DEL001',
        name: 'To Delete',
        email: 'del@example.com',
        password: 'password123',
        status: 'Active',
        roles: [userRoleId],
      })
      await service.delete(created.id)
      await expect(service.edit(created.id)).rejects.toThrow()
    })

    it('throws 404 for non-existent user', async () => {
      await expect(
        service.delete('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow()
    })
  })
})
