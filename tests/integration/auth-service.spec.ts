/**
 * Integration tests: AuthService with SQLite :memory:
 */
import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule } from '@nestjs/config'
import { envValidationSchema } from '../../src/config/env'
import { DataSource } from 'typeorm'
import { AuthService } from '../../src/modules/auth/services/auth.service'
import { User } from '../../src/modules/access/models/user.entity'
import { Role } from '../../src/modules/access/models/role.entity'
import { Permission } from '../../src/modules/access/models/permission.entity'
import { Setting } from '../../src/modules/setting/models/setting.entity'
import { InitialSchema1700000000000 } from '../../src/modules/access/migrations/1700000000000-InitialSchema'
import { resetDb, ADMIN } from '../setup/jest.setup'

describe('AuthService (integration, SQLite :memory:)', () => {
  let module: TestingModule
  let service: AuthService
  let ds: DataSource

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          validationSchema: envValidationSchema, // coerces BCRYPT_ROUNDS to number
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
        JwtModule.register({
          secret: 'test-jwt-secret-32chars-minimum-ok',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      providers: [AuthService],
    }).compile()

    service = module.get(AuthService)
    ds = module.get(DataSource)
  })

  afterAll(async () => {
    await module.close()
  })

  beforeEach(async () => {
    await resetDb(ds)
  })

  // -------------------------------------------------------------------------
  // validateUser
  // -------------------------------------------------------------------------
  describe('validateUser()', () => {
    it('returns user object for valid credentials', async () => {
      const result = await service.validateUser(ADMIN.email, ADMIN.password)
      expect(result).toBeTruthy()
      expect(result.email).toBe(ADMIN.email)
      expect(result).not.toHaveProperty('password') // stripped from session object
    })

    it('throws 401 for wrong password', async () => {
      await expect(
        service.validateUser(ADMIN.email, 'wrongpassword'),
      ).rejects.toThrow()
    })

    it('throws 401 for non-existent email', async () => {
      await expect(
        service.validateUser('ghost@example.com', 'password'),
      ).rejects.toThrow()
    })

    it('throws 401 for blocked user', async () => {
      // Block the admin user
      await ds.query(`UPDATE users SET blocked = 1 WHERE email = ?`, [ADMIN.email])
      await expect(
        service.validateUser(ADMIN.email, ADMIN.password),
      ).rejects.toThrow()
    })

    it('throws 401 for inactive user', async () => {
      await ds.query(`UPDATE users SET status = 'Inactive' WHERE email = ?`, [ADMIN.email])
      await expect(
        service.validateUser(ADMIN.email, ADMIN.password),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // loginApi
  // -------------------------------------------------------------------------
  describe('loginApi()', () => {
    it('returns a JWT token', async () => {
      const user = await service.validateUser(ADMIN.email, ADMIN.password)
      const { token } = await service.loginApi(user)
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // valid JWT structure
    })
  })

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------
  describe('register()', () => {
    it('creates a new user successfully', async () => {
      const result = await service.register({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      })
      expect(result.email).toBe('newuser@example.com')
      expect(result.password).not.toBe('password123') // hashed
    })

    it('throws 409 for duplicate email', async () => {
      await expect(
        service.register({
          name: 'Dup',
          email: ADMIN.email, // already seeded
          password: 'password123',
        }),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // OTP flow: requestOTP + processOTP
  // -------------------------------------------------------------------------
  describe('OTP flow', () => {
    it('requestOTP() returns a 6-digit OTP and stores hash', async () => {
      const otp = await service.requestOTP(ADMIN.email)
      expect(otp).toMatch(/^\d{6}$/)
    })

    it('requestOTP() throws 404 for unknown email', async () => {
      await expect(
        service.requestOTP('nobody@example.com'),
      ).rejects.toThrow()
    })

    it('processOTP() resets password with valid OTP', async () => {
      const otp = await service.requestOTP(ADMIN.email)
      await service.processOTP(ADMIN.email, otp, 'newpassword456')
      // Verify new password works
      const user = await service.validateUser(ADMIN.email, 'newpassword456')
      expect(user.email).toBe(ADMIN.email)
    })

    it('processOTP() throws for wrong OTP', async () => {
      await service.requestOTP(ADMIN.email)
      await expect(
        service.processOTP(ADMIN.email, '000000', 'newpassword456'),
      ).rejects.toThrow()
    })

    it('processOTP() throws for expired OTP', async () => {
      await service.requestOTP(ADMIN.email)
      // Simulate expiry by setting expires to the past
      const past = String(Date.now() - 1000)
      await ds.query(
        `UPDATE users SET password_otp_expires = ? WHERE email = ?`,
        [past, ADMIN.email],
      )
      await expect(
        service.processOTP(ADMIN.email, '123456', 'newpassword456'),
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // JWT blacklist: logout + isTokenBlacklisted
  // -------------------------------------------------------------------------
  describe('JWT blacklist', () => {
    it('isTokenBlacklisted() returns false before logout', async () => {
      const jti = 'test-jti-' + Date.now()
      expect(await service.isTokenBlacklisted(jti)).toBe(false)
    })

    it('isTokenBlacklisted() returns true after logout', async () => {
      const jti = 'test-jti-' + Date.now()
      const exp = Math.floor(Date.now() / 1000) + 3600 // 1h from now
      await service.logout(jti, exp)
      expect(await service.isTokenBlacklisted(jti)).toBe(true)
    })

    it('cleans up expired tokens from blacklist', async () => {
      const jti = 'expired-jti-' + Date.now()
      const exp = Math.floor(Date.now() / 1000) - 10 // already expired
      await service.logout(jti, exp)
      // isTokenBlacklisted removes expired entries
      expect(await service.isTokenBlacklisted(jti)).toBe(false)
    })
  })
})
