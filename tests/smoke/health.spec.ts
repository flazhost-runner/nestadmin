/**
 * Smoke tests: basic reachability checks.
 * Validates the app boots, DB is connected, and key routes respond.
 */
import 'reflect-metadata'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { createTestApp, TestApp } from '../setup/app-factory'
import { seedTestDb } from '../setup/jest.setup'
import { loginWeb } from '../setup/helpers'

describe('Smoke tests', () => {
  let ctx: TestApp
  let ds: DataSource

  beforeAll(async () => {
    ctx = await createTestApp()
    ds = ctx.ds
  })

  afterAll(async () => {
    await ctx.app.close()
  })

  // -------------------------------------------------------------------------
  // Database connectivity
  // -------------------------------------------------------------------------
  describe('Database', () => {
    it('DataSource is initialized and connected', () => {
      expect(ds.isInitialized).toBe(true)
    })

    it('can execute a simple query', async () => {
      const rows = await ds.query('SELECT 1 as ping')
      expect(rows[0].ping).toBe(1)
    })

    it('migrations ran: users table exists', async () => {
      const rows = await ds.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      expect(rows.length).toBeGreaterThan(0)
    })

    it('seed data present: Administrator role exists', async () => {
      const rows = await ds.query("SELECT name FROM roles WHERE name = 'Administrator'")
      expect(rows.length).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Public web routes
  // -------------------------------------------------------------------------
  describe('Public routes', () => {
    it('GET / → 200 (landing page)', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/')
      // Home page or redirect — not a server error
      expect([200, 301, 302]).toContain(res.status)
    })

    it('GET /auth/login → 200', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/auth/login')
      expect(res.status).toBe(200)
    })

    it('GET /api/v1/auth/login route exists (405 or 404 from GET, not 500)', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/auth/login')
      // GET on a POST-only route should be 404/405, not 500
      expect(res.status).not.toBe(500)
    })
  })

  // -------------------------------------------------------------------------
  // Protected web routes
  // -------------------------------------------------------------------------
  describe('Protected routes (require session)', () => {
    it('GET /admin/v1/dashboard without session → redirect to login', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/admin/v1/dashboard')
      expect([302, 401]).toContain(res.status)
    })

    it('GET /admin/v1/dashboard with valid session → 200', async () => {
      const { agent } = await loginWeb(ctx.app)
      const res = await agent.get('/admin/v1/dashboard')
      expect(res.status).toBe(200)
    })
  })

  // -------------------------------------------------------------------------
  // API health
  // -------------------------------------------------------------------------
  describe('API routes', () => {
    it('POST /api/v1/auth/login responds (not 500)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong' })
      expect(res.status).not.toBe(500)
      expect([401, 400]).toContain(res.status)
    })

    it('GET /api/v1/auth/me returns 401 without token', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me')
      expect(res.status).toBe(401)
    })

    it('GET /api/v1/access/users returns 401 without token', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/access/users')
      expect(res.status).toBe(401)
    })
  })
})
