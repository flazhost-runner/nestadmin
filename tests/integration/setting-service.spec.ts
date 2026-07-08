/**
 * Integration tests: SettingService with SQLite :memory:
 * Fokus: upload file (icon/logo/login_image) benar-benar tersimpan sebagai
 * object key via StorageService — bukan diabaikan.
 */
import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SettingService } from '../../src/modules/setting/services/v1/SettingService'
import { SettingCacheService } from '../../src/services/setting-cache.service'
import { StorageService } from '../../src/services/storage.service'
import { User } from '../../src/modules/access/models/user.entity'
import { Role } from '../../src/modules/access/models/role.entity'
import { Permission } from '../../src/modules/access/models/permission.entity'
import { Setting } from '../../src/modules/setting/models/setting.entity'
import { InitialSchema1700000000000 } from '../../src/modules/access/migrations/1700000000000-InitialSchema'

describe('SettingService (integration, SQLite :memory:)', () => {
  let module: TestingModule
  let service: SettingService

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
        TypeOrmModule.forFeature([Setting]),
      ],
      // StorageService: dependensi baru SettingService untuk upload file
      // (di app asli disediakan StorageModule yang @Global).
      providers: [SettingService, SettingCacheService, StorageService],
    }).compile()

    service = module.get(SettingService)
  })

  afterAll(async () => {
    await module.close()
  })

  it('menyimpan field teks biasa', async () => {
    const result: any = await service.update({ name: 'Kube Admin' }, {})
    expect(result.name).toBe('Kube Admin')
  })

  it('menyimpan upload logo & icon sebagai object key', async () => {
    const result: any = await service.update({ name: 'Kube Admin' }, {
      logo: [{ originalname: 'logo.png', buffer: Buffer.from('x') }],
      icon: [{ originalname: 'icon.WEBP', buffer: Buffer.from('x') }],
    } as any)
    expect(result.logo).toMatch(/^uploads\/setting\/[0-9a-f-]+\.png$/)
    expect(result.icon).toMatch(/^uploads\/setting\/[0-9a-f-]+\.webp$/)
  })

  it('field file kosong tidak menimpa nilai lama', async () => {
    await service.update({ name: 'Kube Admin' }, {
      logo: [{ originalname: 'a.png', buffer: Buffer.from('x') }],
    } as any)
    const before: any = await service.update({ name: 'Kube Admin' }, {})
    const logoBefore = before.logo
    const after: any = await service.update({ description: 'no file' }, {})
    expect(after.logo).toBe(logoBefore)
  })
})
