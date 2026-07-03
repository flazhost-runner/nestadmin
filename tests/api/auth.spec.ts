/**
 * API tests: Auth endpoints via supertest.
 * Each test suite gets its own NestJS app + fresh in-memory SQLite.
 */
import 'reflect-metadata'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { createTestApp, TestApp } from '../setup/app-factory'
import { resetDb, ADMIN } from '../setup/jest.setup'
import { loginApi } from '../setup/helpers'

describe('Auth API (POST /api/v1/auth/*)', () => {
  let ctx: TestApp
  let ds: DataSource

  beforeAll(async () => {
    ctx = await createTestApp()
    ds = ctx.ds
  })

  afterAll(async () => {
    await ctx.app.close()
  })

  beforeEach(async () => {
    await resetDb(ds)
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/auth/login
  // -------------------------------------------------------------------------
  describe('POST /api/v1/auth/login', () => {
    it('returns 200 and JWT token for valid credentials', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN.email, password: ADMIN.password })
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('token')
      expect(typeof res.body.data.token).toBe('string')
    })

    it('returns 401 for wrong password', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN.email, password: 'wrongpassword' })
      expect(res.status).toBe(401)
    })

    it('returns 401 for unknown email', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password' })
      expect(res.status).toBe(401)
    })

    it('returns user object alongside token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN.email, password: ADMIN.password })
      expect(res.body.data).toHaveProperty('user')
      expect(res.body.data.user.email).toBe(ADMIN.email)
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/v1/auth/me
  // -------------------------------------------------------------------------
  describe('GET /api/v1/auth/me', () => {
    it('returns 200 with user when token is valid', async () => {
      const token = await loginApi(ctx.app)
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.email).toBe(ADMIN.email)
    })

    it('returns 401 without token', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns 401 for malformed token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.jwt')
      expect(res.status).toBe(401)
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/auth/logout + blacklist verification
  // -------------------------------------------------------------------------
  describe('POST /api/v1/auth/logout', () => {
    it('returns 200 and blacklists the token', async () => {
      const token = await loginApi(ctx.app)

      // Verify token works before logout
      const before = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(before.status).toBe(200)

      // Logout
      const logout = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
      expect(logout.status).toBe(200)

      // Token must now be rejected
      const after = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(after.status).toBe(401)
    })

    it('returns 401 when called without token', async () => {
      const res = await request(ctx.app.getHttpServer()).post('/api/v1/auth/logout')
      expect(res.status).toBe(401)
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/auth/register
  // -------------------------------------------------------------------------
  describe('POST /api/v1/auth/register', () => {
    it('returns 201 and creates user', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'New Person',
          email: 'newperson@example.com',
          password: 'password123',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.email).toBe('newperson@example.com')
    })

    it('returns 409 for duplicate email', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Dup', email: ADMIN.email, password: 'password123' })
      expect(res.status).toBe(409)
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/auth/reset/request
  // -------------------------------------------------------------------------
  describe('POST /api/v1/auth/reset/request', () => {
    it('returns 200 for valid email', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/reset/request')
        .send({ email: ADMIN.email })
      expect(res.status).toBe(200)
    })

    it('returns 404 for unknown email', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/reset/request')
        .send({ email: 'ghost@example.com' })
      expect(res.status).toBe(404)
    })
  })
})
