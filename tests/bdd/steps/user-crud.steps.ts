/**
 * BDD step definitions for user-crud.feature (jest-cucumber).
 */
import 'reflect-metadata'
import { loadFeature, defineFeature } from 'jest-cucumber'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { createTestApp, TestApp } from '../../setup/app-factory'
import { resetDb, ADMIN } from '../../setup/jest.setup'
import { loginApi } from '../../setup/helpers'

const feature = loadFeature('./tests/bdd/features/user-crud.feature')

defineFeature(feature, test => {
  let ctx: TestApp
  let ds: DataSource
  let token: string
  let userRoleId: string
  let createdUserId: string

  beforeAll(async () => {
    ctx = await createTestApp()
    ds = ctx.ds
  })

  afterAll(async () => {
    await ctx.app.close()
  })

  beforeEach(async () => {
    const seed = await resetDb(ds)
    userRoleId = seed.userRoleId
    token = await loginApi(ctx.app)
  })

  // Background step — runs before each scenario
  const givenLoggedInAsAdmin = (given: (step: string, fn: () => Promise<void>) => void) => {
    given('I am logged in as admin', async () => {
      token = await loginApi(ctx.app)
      expect(token).toBeTruthy()
    })
  }

  // ---------------------------------------------------------------------------
  // Scenario: Create a new user
  // ---------------------------------------------------------------------------
  test('Create a new user', ({ given, when, then }) => {
    givenLoggedInAsAdmin(given)

    when(/^I create a user with name "([^"]*)" and email "([^"]*)"$/, async (name: string, email: string) => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/access/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'BDD001',
          name,
          email,
          password: 'password123',
          status: 'Active',
          roles: [userRoleId],
        })
      expect(res.status).toBe(201)
      createdUserId = res.body.data.id
    })

    then(/^the user list should contain "([^"]*)"$/, async (name: string) => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const names = res.body.data.datas.map((u: any) => u.name)
      expect(names).toContain(name)
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario: Delete a user
  // ---------------------------------------------------------------------------
  test('Delete a user', ({ given, when, then }) => {
    givenLoggedInAsAdmin(given)

    given(/^user "([^"]*)" exists$/, async (name: string) => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/access/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'BDD002',
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          password: 'password123',
          status: 'Active',
          roles: [userRoleId],
        })
      expect(res.status).toBe(201)
      createdUserId = res.body.data.id
    })

    when(/^I delete user "([^"]*)"$/, async (_name: string) => {
      const res = await request(ctx.app.getHttpServer())
        .delete(`/api/v1/access/users/${createdUserId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })

    then(/^the user list should not contain "([^"]*)"$/, async (name: string) => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/access/users')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const names = res.body.data.datas.map((u: any) => u.name)
      expect(names).not.toContain(name)
    })
  })
})
