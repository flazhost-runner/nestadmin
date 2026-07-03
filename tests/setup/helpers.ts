/**
 * helpers.ts — shared test utilities for HTTP-level tests (supertest).
 */
import request, { Agent } from 'supertest'
import { INestApplication } from '@nestjs/common'
import { ADMIN, USER } from './jest.setup'

export { ADMIN, USER }

/**
 * Login via web form (session cookie + CSRF).
 * Returns a supertest agent with the session cookie already set.
 */
export async function loginWeb(
  app: INestApplication,
  creds: { email: string; password: string } = ADMIN,
): Promise<{ agent: Agent; csrf: string }> {
  const agent = request.agent(app.getHttpServer())
  const loginPage = await agent.get('/auth/login')
  const csrf = extractCsrf(loginPage.text)
  await agent
    .post('/auth/login')
    .type('form')
    .send({ email: creds.email, password: creds.password, _csrf: csrf })
  return { agent, csrf }
}

/**
 * Login via REST API — returns the JWT bearer token.
 */
export async function loginApi(
  app: INestApplication,
  creds: { email: string; password: string } = ADMIN,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: creds.email, password: creds.password })
  return res.body?.data?.token ?? ''
}

/**
 * Fetch a fresh CSRF token from a page that embeds one.
 */
export async function getCsrf(
  agent: Agent,
  path = '/admin/v1/setting',
): Promise<string> {
  const page = await agent.get(path)
  return extractCsrf(page.text)
}

/**
 * Extract CSRF token from HTML meta tag: <meta name="csrf-token" content="...">
 */
export function extractCsrf(html: string): string {
  const m = html.match(/name=["']csrf-token["'] content=["']([^"']+)["']/)
  return m ? m[1] : ''
}
