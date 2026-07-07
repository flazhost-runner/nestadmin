/**
 * Integration tests: RoleService with SQLite :memory:
 */
import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { RoleService } from '../../src/modules/access/services/v1/RoleService'
import { Role } from '../../src/modules/access/models/role.entity'
import { Permission } from '../../src/modules/access/models/permission.entity'
import { User } from '../../src/modules/access/models/user.entity'
import { Setting } from '../../src/modules/setting/models/setting.entity'
import { InitialSchema1700000000000 } from '../../src/modules/access/migrations/1700000000000-InitialSchema'
import { resetDb } from '../setup/jest.setup'

describe('RoleService (integration, SQLite :memory:)', () => {
  let module: TestingModule
  let service: RoleService
  let ds: DataSource

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
        TypeOrmModule.forFeature([Role, Permission]),
      ],
      providers: [RoleService],
    }).compile()

    service = module.get(RoleService)
    ds = module.get(DataSource)
  })

  afterAll(async () => {
    await module.close()
  })

  beforeEach(async () => {
    await resetDb(ds)
  })

  // -------------------------------------------------------------------------
  // store
  // -------------------------------------------------------------------------
  describe('store()', () => {
    it('creates a new role', async () => {
      const result: any = await service.store({ name: 'Editor', status: 'Active' })
      expect(result.name).toBe('Editor')
      expect(result.id).toBeTruthy()
    })

    it('throws 409 ConflictError when role name already exists', async () => {
      await service.store({ name: 'Duplicate', status: 'Active' })
      await expect(
        service.store({ name: 'Duplicate', status: 'Active' }),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // index
  // -------------------------------------------------------------------------
  describe('index()', () => {
    it('returns paginated list', async () => {
      const result = await service.index({})
      expect(result.datas.length).toBeGreaterThanOrEqual(2) // Administrator + User seeds
      expect(result.paginate_data).toHaveProperty('total')
    })

    it('filters by name (case-insensitive)', async () => {
      const result = await service.index({ q_name: 'ADMINISTRATOR' })
      expect(result.datas.some((r: any) => r.name === 'Administrator')).toBe(true)
    })

    it('filters by status', async () => {
      const result = await service.index({ q_status: 'Active' })
      result.datas.forEach((r: any) => expect(r.status).toBe('Active'))
    })
  })

  // -------------------------------------------------------------------------
  // edit
  // -------------------------------------------------------------------------
  describe('edit()', () => {
    it('returns role for existing id', async () => {
      const created: any = await service.store({ name: 'ViewRole', status: 'Active' })
      const result = await service.edit(created.id)
      expect(result).toBeTruthy()
      expect((result as any).name).toBe('ViewRole')
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
    it('updates role name', async () => {
      const created: any = await service.store({ name: 'OldRole', status: 'Active' })
      const result: any = await service.update(created.id, {
        name: 'NewRole',
        status: 'Active',
      })
      expect(result.name).toBe('NewRole')
    })

    it('throws 404 for non-existent role', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', {
          name: 'Ghost',
          status: 'Active',
        }),
      ).rejects.toThrow()
    })

    it('throws 409 if new name conflicts with another role', async () => {
      await service.store({ name: 'RoleA', status: 'Active' })
      const roleB: any = await service.store({ name: 'RoleB', status: 'Active' })
      await expect(
        service.update(roleB.id, { name: 'RoleA', status: 'Active' }),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('deletes an existing role', async () => {
      const created: any = await service.store({ name: 'ToDelete', status: 'Active' })
      await service.delete(created.id)
      await expect(service.edit(created.id)).rejects.toThrow()
    })

    it('throws 404 for non-existent role', async () => {
      await expect(
        service.delete('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // deleteSelected
  // -------------------------------------------------------------------------
  describe('deleteSelected()', () => {
    it('bulk deletes multiple roles', async () => {
      const r1: any = await service.store({ name: 'Bulk1', status: 'Active' })
      const r2: any = await service.store({ name: 'Bulk2', status: 'Active' })
      await service.deleteSelected([r1.id, r2.id])
      await expect(service.edit(r1.id)).rejects.toThrow()
      await expect(service.edit(r2.id)).rejects.toThrow()
    })

    it('returns empty array for empty ids', async () => {
      const result = await service.deleteSelected([])
      expect(result).toEqual([])
    })
  })
})
