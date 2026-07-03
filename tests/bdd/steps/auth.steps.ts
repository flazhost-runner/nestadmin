/**
 * BDD step definitions for auth.feature (jest-cucumber).
 */
import 'reflect-metadata'
import { loadFeature, defineFeature } from 'jest-cucumber'
import request, { Agent } from 'supertest'
import { INestApplication } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { createTestApp, TestApp } from '../../setup/app-factory'
import { resetDb, ADMIN } from '../../setup/jest.setup'
import { extractCsrf } from '../../setup/helpers'

const feature = loadFeature('./tests/bdd/features/auth.feature')

defineFeature(feature, test => {
  let ctx: TestApp
  let ds: DataSource
  let agent: Agent
  let lastResponse: request.Response

  beforeAll(async () => {
    ctx = await createTestApp()
    ds = ctx.ds
  })

  afterAll(async () => {
    await ctx.app.close()
  })

  beforeEach(async () => {
    await resetDb(ds)
    agent = request.agent(ctx.app.getHttpServer())
  })

  // ---------------------------------------------------------------------------
  // Scenario: Admin can login with valid credentials
  // ---------------------------------------------------------------------------
  test('Admin can login with valid credentials', ({ given, when, then, and }) => {
    given('I am on the login page', async () => {
      lastResponse = await agent.get('/auth/login')
      expect(lastResponse.status).toBe(200)
    })

    when(/^I submit email "([^"]*)" and password "([^"]*)"$/, async (email: string, password: string) => {
      const csrf = extractCsrf(lastResponse.text)
      lastResponse = await agent
        .post('/auth/login')
        .type('form')
        .send({ email, password, _csrf: csrf })
    })

    then('I should be redirected to dashboard', () => {
      // After successful login, expect a redirect (302) to dashboard
      expect(lastResponse.status).toBe(302)
      expect(lastResponse.headers.location).toContain('/admin/v1/dashboard')
    })

    and(/^I should see "([^"]*)"$/, async (text: string) => {
      // Follow the redirect and check dashboard content
      const dashRes = await agent.get('/admin/v1/dashboard')
      expect(dashRes.status).toBe(200)
      // Welcome text may be in page body or title
      expect(dashRes.text.toLowerCase()).toContain(text.toLowerCase())
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario: Login fails with wrong password
  // ---------------------------------------------------------------------------
  test('Login fails with wrong password', ({ given, when, then }) => {
    given('I am on the login page', async () => {
      lastResponse = await agent.get('/auth/login')
      expect(lastResponse.status).toBe(200)
    })

    when(/^I submit email "([^"]*)" and password "([^"]*)"$/, async (email: string, password: string) => {
      const csrf = extractCsrf(lastResponse.text)
      lastResponse = await agent
        .post('/auth/login')
        .type('form')
        .send({ email, password, _csrf: csrf })
    })

    then('I should see an error message', async () => {
      // Failed login redirects back to /auth/login
      expect(lastResponse.status).toBe(302)
      expect(lastResponse.headers.location).toContain('/auth/login')
      // Following redirect shows error flash message
      const loginPage = await agent.get('/auth/login')
      expect(loginPage.text).toMatch(/invalid|incorrect|wrong|error/i)
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario: Logout invalidates session
  // ---------------------------------------------------------------------------
  test('Logout invalidates session', ({ given, when, then }) => {
    given('I am logged in as admin', async () => {
      const loginPage = await agent.get('/auth/login')
      const csrf = extractCsrf(loginPage.text)
      const res = await agent
        .post('/auth/login')
        .type('form')
        .send({ email: ADMIN.email, password: ADMIN.password, _csrf: csrf })
      expect(res.headers.location).toContain('/admin/v1/dashboard')
    })

    when('I logout', async () => {
      // Navigate to dashboard first to get CSRF token for logout
      const dashboard = await agent.get('/admin/v1/dashboard')
      const csrf = extractCsrf(dashboard.text)
      lastResponse = await agent
        .post('/auth/logout')
        .type('form')
        .send({ _csrf: csrf })
    })

    then('I cannot access admin pages', async () => {
      const res = await agent.get('/admin/v1/dashboard')
      // Should redirect to login page
      expect([302, 401]).toContain(res.status)
      if (res.status === 302) {
        expect(res.headers.location).toContain('/auth/login')
      }
    })
  })
})
