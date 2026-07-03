import 'reflect-metadata'

// ---------------------------------------------------------------------------
// Mock Redis — Map-based in-memory store; NestAdmin uses in-process Map for
// JWT blacklist so this mainly prevents any accidental real Redis calls.
// ---------------------------------------------------------------------------
jest.mock('redis', () => {
  const store = new Map<string, string>()
  const client = {
    isOpen: true,
    on: jest.fn(),
    connect: jest.fn(async () => {}),
    quit: jest.fn(async () => {}),
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => { store.set(k, v); return 'OK' }),
    del: jest.fn(async (k: string) => { store.delete(k); return 1 }),
  }
  return { createClient: jest.fn(() => client) }
})

// ---------------------------------------------------------------------------
// Mock connect-redis to avoid real Redis for session store
// ---------------------------------------------------------------------------
jest.mock('connect-redis', () => {
  return {
    RedisStore: jest.fn().mockImplementation(() => ({})),
  }
})

// ---------------------------------------------------------------------------
// Mock multer / file storage — local disk, no-op uploads in tests
// ---------------------------------------------------------------------------
jest.mock('multer', () => {
  const multer = jest.fn(() => ({
    single: jest.fn(() => (req: any, _res: any, next: any) => next()),
    array: jest.fn(() => (req: any, _res: any, next: any) => next()),
    fields: jest.fn(() => (req: any, _res: any, next: any) => next()),
    none: jest.fn(() => (req: any, _res: any, next: any) => next()),
  }))
  ;(multer as any).diskStorage = jest.fn(() => ({}))
  ;(multer as any).memoryStorage = jest.fn(() => ({}))
  return multer
})

// ---------------------------------------------------------------------------
// Exported constants used across all test files
// ---------------------------------------------------------------------------
export const ADMIN = { email: 'admin@test.com', password: 'testpassword123' }
export const USER  = { email: 'user@test.com',  password: 'testpassword123' }

// ---------------------------------------------------------------------------
// seedTestDb — seed a DataSource instance with minimal data:
//   1 Setting row, Administrator + User roles, admin + regular users
// ---------------------------------------------------------------------------
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

export async function seedTestDb(ds: DataSource): Promise<{
  adminRoleId: string
  userRoleId: string
  adminUserId: string
  userUserId: string
}> {
  const rounds = 4 // fast for tests

  // Setting singleton
  await ds.query(
    `INSERT INTO settings (id, initial, name, description, theme, fe_template, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [randomUUID(), 'NA', 'NestAdmin Test', 'Test instance', 'Blue', 'agency-consulting-002-creative-agency'],
  )

  // Roles
  const adminRoleId = randomUUID()
  const userRoleId = randomUUID()
  await ds.query(
    `INSERT INTO roles (id, name, status, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [adminRoleId, 'Administrator', 'Active'],
  )
  await ds.query(
    `INSERT INTO roles (id, name, status, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [userRoleId, 'User', 'Active'],
  )

  // Users
  const adminUserId = randomUUID()
  const userUserId  = randomUUID()
  const adminPwd    = await bcrypt.hash(ADMIN.password, rounds)
  const userPwd     = await bcrypt.hash(USER.password, rounds)

  await ds.query(
    `INSERT INTO users (id, code, name, email, password, status, blocked, timezone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [adminUserId, 'ADM001', 'Administrator', ADMIN.email, adminPwd, 'Active', false, 'UTC'],
  )
  await ds.query(
    `INSERT INTO users (id, code, name, email, password, status, blocked, timezone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [userUserId, 'USR001', 'Regular User', USER.email, userPwd, 'Active', false, 'UTC'],
  )

  // Assign roles
  await ds.query(`INSERT INTO users_roles (user_id, role_id) VALUES (?, ?)`, [adminUserId, adminRoleId])
  await ds.query(`INSERT INTO users_roles (user_id, role_id) VALUES (?, ?)`, [userUserId, userRoleId])

  return { adminRoleId, userRoleId, adminUserId, userUserId }
}

// ---------------------------------------------------------------------------
// resetDb — clear all rows then re-seed; call in beforeEach
// ---------------------------------------------------------------------------
export async function resetDb(ds: DataSource) {
  // Delete join tables first (FK order for SQLite)
  await ds.query('DELETE FROM roles_permissions').catch(() => {})
  await ds.query('DELETE FROM users_roles').catch(() => {})
  await ds.query('DELETE FROM users').catch(() => {})
  await ds.query('DELETE FROM permissions').catch(() => {})
  await ds.query('DELETE FROM roles').catch(() => {})
  await ds.query('DELETE FROM settings').catch(() => {})
  return seedTestDb(ds)
}
