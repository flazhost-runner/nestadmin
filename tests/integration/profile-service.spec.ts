/**
 * Integration tests: ProfileService with SQLite :memory:
 */
import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { envValidationSchema } from '../../src/config/env'
import { DataSource } from 'typeorm'
import { ProfileService } from '../../src/modules/profile/services/v1/ProfileService'
import { StorageService } from '../../src/services/storage.service'
import { User } from '../../src/modules/access/models/user.entity'
import { Role } from '../../src/modules/access/models/role.entity'
import { Permission } from '../../src/modules/access/models/permission.entity'
import { Setting } from '../../src/modules/setting/models/setting.entity'
import { InitialSchema1700000000000 } from '../../src/modules/access/migrations/1700000000000-InitialSchema'
import { resetDb, ADMIN } from '../setup/jest.setup'

describe('ProfileService (integration, SQLite :memory:)', () => {
  let module: TestingModule
  let service: ProfileService
  let ds: DataSource
  let adminUserId: string

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          validationSchema: envValidationSchema,
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [User, Role, Permission, Setting],
          migrations: [InitialSchema1700000000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([User]),
      ],
      // StorageService: dependensi baru ProfileService untuk upload foto
      // (di app asli disediakan StorageModule yang @Global).
      providers: [ProfileService, StorageService],
    }).compile()

    service = module.get(ProfileService)
    ds = module.get(DataSource)
    const seed = await resetDb(ds)
    adminUserId = seed.adminUserId
  })

  afterAll(async () => {
    await module.close()
  })

  describe('index()', () => {
    it('returns user data with timezones list', async () => {
      const result = await service.index(adminUserId)
      expect(result.data).toBeDefined()
      expect(result.data.email).toBe(ADMIN.email)
      expect(Array.isArray(result.timezones)).toBe(true)
      expect(result.timezones).toContain('UTC')
      expect(result.timezones).toContain('Asia/Jakarta')
    })

    it('throws NotFoundError for unknown userId', async () => {
      await expect(
        service.index('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow('User not found')
    })
  })

  describe('update()', () => {
    it('updates user name without touching password', async () => {
      const updated = await service.update(adminUserId, { name: 'Admin Renamed' })
      expect(updated.name).toBe('Admin Renamed')
    })

    it('hashes password when provided', async () => {
      const updated = await service.update(adminUserId, {
        password: 'newpassword123',
        password_confirmation: 'newpassword123',
      })
      // password must be stored hashed, not plain
      expect(updated.password).not.toBe('newpassword123')
      expect(updated.password.startsWith('$2')).toBe(true)
    })

    it('throws NotFoundError for unknown userId', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', { name: 'Ghost' }),
      ).rejects.toThrow('User not found')
    })
  })
})
