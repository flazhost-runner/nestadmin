/**
 * API tests: Access CRUD endpoints (users, roles, permissions) via supertest.
 */
import 'reflect-metadata'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { createTestApp, TestApp } from '../setup/app-factory'
import { resetDb } from '../setup/jest.setup'
import { loginApi } from '../setup/helpers'

describe('Access API (CRUD)', () => {
  let ctx: TestApp
  let ds: DataSource
  let token: string
  let adminRoleId: string
  let userRoleId: string

  beforeAll(async () => {
    ctx = await createTestApp()
    ds = ctx.ds
  })

  afterAll(async () => {
    await ctx.app.close()
  })

  beforeEach(async () => {
    const seed = await resetDb(ds)
    adminRoleId = seed.adminRoleId
    userRoleId = seed.userRoleId
    token = await loginApi(ctx.app)
  })

  const authHeader = () => ({ Authorization: `Bearer ${token}` })

  // =========================================================================
  // USERS /api/v1/access/users
  // =========================================================================
  describe('Users /api/v1/access/users', () => {
    describe('GET / (index)', () => {
      it('returns 200 with paginated list', async () => {
        const res = await request(ctx.app.getHttpServer())
          .get('/api/v1/access/users')
          .set(authHeader())
        expect(res.status).toBe(200)
        expect(Array.isArray(res.body.data.datas)).toBe(true)
        expect(res.body.data).toHaveProperty('paginate_data')
      })

      it('returns 401 without token', async () => {
        const res = await request(ctx.app.getHttpServer()).get('/api/v1/access/users')
        expect(res.status).toBe(401)
      })

      it('supports filtering by name', async () => {
        const res = await request(ctx.app.getHttpServer())
          .get('/api/v1/access/users?q_name=Administrator')
          .set(authHeader())
        expect(res.status).toBe(200)
        expect(res.body.data.datas.length).toBeGreaterThanOrEqual(1)
      })
    })

    describe('POST / (store)', () => {
      it('returns 201 and creates user', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({
            code: 'API001',
            name: 'API User',
            email: 'apiuser@example.com',
            password: 'password123',
            status: 'Active',
            roles: [userRoleId],
          })
        expect(res.status).toBe(201)
        expect(res.body.data.email).toBe('apiuser@example.com')
      })

      it('returns 4xx for missing required role', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({
            code: 'API002',
            name: 'NoRole',
            email: 'norole@example.com',
            password: 'password123',
            status: 'Active',
            roles: ['non-existent-id'],
          })
        expect(res.status).toBeGreaterThanOrEqual(400)
      })
    })

    describe('GET /:id (show)', () => {
      it('returns 200 with user data', async () => {
        // First create a user
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({
            code: 'SHW001',
            name: 'Show User',
            email: 'show@example.com',
            password: 'password123',
            status: 'Active',
            roles: [userRoleId],
          })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .get(`/api/v1/access/users/${id}`)
          .set(authHeader())
        expect(res.status).toBe(200)
        expect(res.body.data.data.email).toBe('show@example.com')
      })
    })

    describe('PUT /:id (update)', () => {
      it('returns 200 and updates user', async () => {
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({
            code: 'UPD001',
            name: 'Old Name',
            email: 'update@example.com',
            password: 'password123',
            status: 'Active',
            roles: [userRoleId],
          })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .put(`/api/v1/access/users/${id}`)
          .set(authHeader())
          .send({ name: 'Updated Name', roles: [userRoleId] })
        expect(res.status).toBe(200)
        expect(res.body.data.name).toBe('Updated Name')
      })
    })

    describe('DELETE /:id (delete)', () => {
      it('returns 200 and deletes user', async () => {
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({
            code: 'DEL001',
            name: 'Delete Me',
            email: 'deleteme@example.com',
            password: 'password123',
            status: 'Active',
            roles: [userRoleId],
          })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .delete(`/api/v1/access/users/${id}`)
          .set(authHeader())
        expect(res.status).toBe(200)
      })

      it('returns 404 for non-existent user', async () => {
        const res = await request(ctx.app.getHttpServer())
          .delete('/api/v1/access/users/00000000-0000-0000-0000-000000000000')
          .set(authHeader())
        expect(res.status).toBe(404)
      })
    })

    describe('POST /delete_selected (bulk delete)', () => {
      it('returns 200 and deletes multiple users', async () => {
        const c1 = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({ code: 'BLK001', name: 'Bulk1', email: 'bulk1@example.com', password: 'p', status: 'Active', roles: [userRoleId] })
        const c2 = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users')
          .set(authHeader())
          .send({ code: 'BLK002', name: 'Bulk2', email: 'bulk2@example.com', password: 'p', status: 'Active', roles: [userRoleId] })

        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/users/delete_selected')
          .set(authHeader())
          .send({ ids: [c1.body.data.id, c2.body.data.id] })
        expect(res.status).toBe(200)
      })
    })
  })

  // =========================================================================
  // ROLES /api/v1/access/roles
  // =========================================================================
  describe('Roles /api/v1/access/roles', () => {
    describe('GET / (index)', () => {
      it('returns 200 with paginated roles', async () => {
        const res = await request(ctx.app.getHttpServer())
          .get('/api/v1/access/roles')
          .set(authHeader())
        expect(res.status).toBe(200)
        expect(Array.isArray(res.body.data.datas)).toBe(true)
      })

      it('returns 401 without token', async () => {
        const res = await request(ctx.app.getHttpServer()).get('/api/v1/access/roles')
        expect(res.status).toBe(401)
      })
    })

    describe('POST / (store)', () => {
      it('returns 201 and creates role', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'Editor', status: 'Active' })
        expect(res.status).toBe(201)
        expect(res.body.data.name).toBe('Editor')
      })

      it('returns 409 for duplicate role name', async () => {
        await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'UniqueRole', status: 'Active' })
        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'UniqueRole', status: 'Active' })
        expect(res.status).toBe(409)
      })
    })

    describe('GET /:id (show)', () => {
      it('returns 200 with role data', async () => {
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'ShowRole', status: 'Active' })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .get(`/api/v1/access/roles/${id}`)
          .set(authHeader())
        expect(res.status).toBe(200)
        expect(res.body.data.name).toBe('ShowRole')
      })
    })

    describe('PUT /:id (update)', () => {
      it('returns 200 and updates role', async () => {
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'OldRoleName', status: 'Active' })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .put(`/api/v1/access/roles/${id}`)
          .set(authHeader())
          .send({ name: 'NewRoleName', status: 'Active' })
        expect(res.status).toBe(200)
        expect(res.body.data.name).toBe('NewRoleName')
      })
    })

    describe('DELETE /:id (delete)', () => {
      it('returns 200 and deletes role', async () => {
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'ToDeleteRole', status: 'Active' })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .delete(`/api/v1/access/roles/${id}`)
          .set(authHeader())
        expect(res.status).toBe(200)
      })

      it('returns 404 for non-existent role', async () => {
        const res = await request(ctx.app.getHttpServer())
          .delete('/api/v1/access/roles/00000000-0000-0000-0000-000000000000')
          .set(authHeader())
        expect(res.status).toBe(404)
      })
    })

    describe('POST /delete_selected (bulk delete)', () => {
      it('returns 200 and deletes multiple roles', async () => {
        const r1 = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'BulkRole1', status: 'Active' })
        const r2 = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles')
          .set(authHeader())
          .send({ name: 'BulkRole2', status: 'Active' })

        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/roles/delete_selected')
          .set(authHeader())
          .send({ ids: [r1.body.data.id, r2.body.data.id] })
        expect(res.status).toBe(200)
      })
    })
  })

  // =========================================================================
  // PERMISSIONS /api/v1/access/permissions
  // =========================================================================
  describe('Permissions /api/v1/access/permissions', () => {
    describe('GET / (index)', () => {
      it('returns 200 with paginated permissions', async () => {
        const res = await request(ctx.app.getHttpServer())
          .get('/api/v1/access/permissions')
          .set(authHeader())
        expect(res.status).toBe(200)
        expect(Array.isArray(res.body.data.datas)).toBe(true)
      })

      it('returns 401 without token', async () => {
        const res = await request(ctx.app.getHttpServer()).get('/api/v1/access/permissions')
        expect(res.status).toBe(401)
      })
    })

    describe('POST / (store)', () => {
      it('returns 201 and creates permission', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/permissions')
          .set(authHeader())
          .send({ name: 'view-dashboard', method: 'GET', status: 'Active', guard_name: 'api' })
        expect(res.status).toBe(201)
        expect(res.body.data.name).toBe('view-dashboard')
      })
    })

    describe('DELETE /:id (delete)', () => {
      it('returns 200 and deletes permission', async () => {
        const create = await request(ctx.app.getHttpServer())
          .post('/api/v1/access/permissions')
          .set(authHeader())
          .send({ name: 'del-perm', method: 'DELETE', status: 'Active', guard_name: 'api' })
        const id = create.body.data.id

        const res = await request(ctx.app.getHttpServer())
          .delete(`/api/v1/access/permissions/${id}`)
          .set(authHeader())
        expect(res.status).toBe(200)
      })
    })
  })
})
