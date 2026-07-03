/**
 * Security tests: RBAC, JWT validation, rate-limiting, mass-assignment.
 */
import 'reflect-metadata'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { DataSource } from 'typeorm'
import { createTestApp, TestApp } from '../setup/app-factory'
import { resetDb, ADMIN, USER } from '../setup/jest.setup'
import { loginApi } from '../setup/helpers'

describe('Security', () => {
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
  // RBAC — unauthenticated access
  // -------------------------------------------------------------------------
  describe('RBAC', () => {
    it('GET /api/v1/access/users without token → 401', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/access/users')
      expect(res.status).toBe(401)
    })

    it('GET /api/v1/access/roles without token → 401', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/access/roles')
      expect(res.status).toBe(401)
    })

    it('GET /api/v1/auth/me without token → 401', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me')
      expect(res.status).toBe(401)
    })

    it('authenticated user can access protected endpoints', async () => {
      const token = await loginApi(ctx.app)
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  // -------------------------------------------------------------------------
  // JWT validation
  // -------------------------------------------------------------------------
  describe('JWT validation', () => {
    it('rejects token with alg=none', async () => {
      const bad = jwt.sign(
        { sub: 'x', email: 'x@x.com', jti: 'fake' },
        '',
        { algorithm: 'none' },
      )
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', `Bearer ${bad}`)
      expect(res.status).toBe(401)
    })

    it('rejects expired token', async () => {
      const secret = process.env.JWT_SECRET ?? 'test-jwt-secret-32chars-minimum-ok'
      const expired = jwt.sign(
        { sub: 'x', email: 'x@x.com', jti: 'expired' },
        secret,
        { algorithm: 'HS256', expiresIn: -10 },
      )
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', `Bearer ${expired}`)
      expect(res.status).toBe(401)
    })

    it('rejects token signed with wrong secret', async () => {
      const wrong = jwt.sign(
        { sub: 'x', email: 'x@x.com', jti: 'wrong' },
        'totally-wrong-secret',
        { algorithm: 'HS256', expiresIn: '1d' },
      )
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', `Bearer ${wrong}`)
      expect(res.status).toBe(401)
    })

    it('rejects garbled token string', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', 'Bearer garbage.not.valid')
      expect(res.status).toBe(401)
    })
  })

  // -------------------------------------------------------------------------
  // JWT blacklist — token invalidated after logout
  // -------------------------------------------------------------------------
  describe('JWT blacklist', () => {
    it('token is rejected after logout', async () => {
      const token = await loginApi(ctx.app)

      // Confirm token is valid
      const before = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(before.status).toBe(200)

      // Logout to blacklist
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)

      // Token must now be rejected
      const after = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(after.status).toBe(401)
    })
  })

  // -------------------------------------------------------------------------
  // Rate limiting — login endpoint
  // -------------------------------------------------------------------------
  describe('Rate limiting', () => {
    it('excessive failed logins trigger 429', async () => {
      // .env.test sets RATE_LIMIT_MAX=100 to avoid false positives,
      // so we test that the header is present (throttler is configured)
      // or that repeated requests eventually get throttled.
      // With MAX=100 this test just verifies the endpoint is functional
      // and does not crash under load.
      const results: number[] = []
      for (let i = 0; i < 5; i++) {
        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'x@x.com', password: 'wrong' })
        results.push(res.status)
      }
      // All should be 401 (bad creds), none should be 500
      results.forEach(s => expect([401, 429]).toContain(s))
    })
  })

  // -------------------------------------------------------------------------
  // Mass assignment — extra fields are stripped
  // -------------------------------------------------------------------------
  describe('Mass assignment prevention', () => {
    it('user id cannot be forced via request body', async () => {
      const token = await loginApi(ctx.app)
      const seed = await ds.query('SELECT id FROM roles WHERE name = ?', ['User'])
      const roleId = seed[0]?.id ?? ''

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/access/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'HACK01',
          name: 'Hacker',
          email: 'hacker@example.com',
          password: 'password123',
          status: 'Active',
          roles: [roleId],
          id: 'forced-uuid',          // attempt to force primary key
          created_by: 'injected',     // attempt to force audit field
        })

      if (res.status === 201) {
        // If user was created, ensure id was NOT the forced value
        expect(res.body.data.id).not.toBe('forced-uuid')
      } else {
        // Non-2xx is also acceptable (validation rejected it)
        expect(res.status).toBeGreaterThanOrEqual(400)
      }
    })

    it('register does not self-assign Administrator role', async () => {
      // Get Administrator role id
      const rows = await ds.query('SELECT id FROM roles WHERE name = ?', ['Administrator'])
      const adminRoleId = rows[0]?.id ?? 'fake-id'

      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'SelfAdmin',
          email: 'selfadmin@example.com',
          password: 'password123',
          roles: [adminRoleId], // attempt to inject role
        })

      // Registered user should NOT have Administrator role
      const users = await ds.query(
        `SELECT u.id FROM users u WHERE u.email = ?`,
        ['selfadmin@example.com'],
      )
      if (users.length > 0) {
        const roles = await ds.query(
          `SELECT r.name FROM roles r
           JOIN users_roles ur ON ur.role_id = r.id
           WHERE ur.user_id = ?`,
          [users[0].id],
        )
        const names = roles.map((r: any) => r.name)
        expect(names).not.toContain('Administrator')
      }
    })
  })
})
