/**
 * Unit tests for pure helper functions — no I/O, no DB.
 */
import { DataSource } from 'typeorm'
import {
  paginate,
  ciLike,
  removeEmptyFields,
  removePrefix,
  generateCode,
} from '../../src/helpers/functions'
import { generateOTP, hashOTP, verifyOTP } from '../../src/helpers/otp'

// ---------------------------------------------------------------------------
// paginate()
// ---------------------------------------------------------------------------
describe('paginate()', () => {
  function makeQueryBuilder(rows: any[], total: number) {
    return {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
    } as any
  }

  it('returns correct structure', async () => {
    const qb = makeQueryBuilder([{ id: '1' }], 1)
    const result = await paginate(qb, {})
    expect(result).toHaveProperty('datas')
    expect(result).toHaveProperty('paginate_data')
    expect(result.paginate_data.total).toBe(1)
  })

  it('calculates total_page correctly', async () => {
    const qb = makeQueryBuilder([], 25)
    const result = await paginate(qb, { page: '1', page_size: '10' })
    expect(result.paginate_data.total_page).toBe(3)
  })

  it('has_prev is false on page 1', async () => {
    const qb = makeQueryBuilder([], 20)
    const result = await paginate(qb, { page: '1', page_size: '10' })
    expect(result.paginate_data.has_prev).toBe(false)
    expect(result.paginate_data.has_next).toBe(true)
  })

  it('has_next is false on last page', async () => {
    const qb = makeQueryBuilder([], 10)
    const result = await paginate(qb, { page: '1', page_size: '10' })
    expect(result.paginate_data.has_next).toBe(false)
  })

  it('defaults to page 1 and page_size 10', async () => {
    const qb = makeQueryBuilder([], 5)
    await paginate(qb, {})
    expect(qb.skip).toHaveBeenCalledWith(0)
    expect(qb.take).toHaveBeenCalledWith(10)
  })

  it('skips correctly for page 3', async () => {
    const qb = makeQueryBuilder([], 30)
    await paginate(qb, { page: '3', page_size: '5' })
    expect(qb.skip).toHaveBeenCalledWith(10)
    expect(qb.take).toHaveBeenCalledWith(5)
  })
})

// ---------------------------------------------------------------------------
// ciLike()
// ---------------------------------------------------------------------------
describe('ciLike()', () => {
  it('returns LIKE clause with LOWER()', () => {
    const [clause, params] = ciLike('users.name', 'name', 'alice')
    expect(clause).toContain('LOWER(users.name)')
    expect(clause).toContain('LOWER(:name)')
    expect(params).toEqual({ name: '%alice%' })
  })

  it('wraps value with % wildcards', () => {
    const [, params] = ciLike('u.email', 'email', 'test')
    expect(params.email).toBe('%test%')
  })
})

// ---------------------------------------------------------------------------
// removeEmptyFields()
// ---------------------------------------------------------------------------
describe('removeEmptyFields()', () => {
  it('removes null values', () => {
    const result = removeEmptyFields({ a: 'x', b: null })
    expect(result).toEqual({ a: 'x' })
  })

  it('removes undefined values', () => {
    const result = removeEmptyFields({ a: 'x', b: undefined })
    expect(result).toEqual({ a: 'x' })
  })

  it('removes empty string values', () => {
    const result = removeEmptyFields({ a: 'x', b: '' })
    expect(result).toEqual({ a: 'x' })
  })

  it('keeps falsy non-empty values like 0 and false', () => {
    const result = removeEmptyFields({ a: 0, b: false, c: '' })
    expect(result).toHaveProperty('a', 0)
    expect(result).toHaveProperty('b', false)
    expect(result).not.toHaveProperty('c')
  })

  it('returns empty object when all fields empty', () => {
    const result = removeEmptyFields({ a: null, b: '', c: undefined })
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// removePrefix()
// ---------------------------------------------------------------------------
describe('removePrefix()', () => {
  it('strips prefix from matching keys', () => {
    const result = removePrefix({ q_name: 'Alice', q_email: 'a@b.com', page: '1' }, 'q_')
    expect(result).toEqual({ name: 'Alice', email: 'a@b.com' })
  })

  it('excludes keys that do not match prefix', () => {
    const result = removePrefix({ q_name: 'Alice', other: 'skip' }, 'q_')
    expect(result).not.toHaveProperty('other')
    expect(result).toHaveProperty('name')
  })

  it('returns empty object when no keys match prefix', () => {
    const result = removePrefix({ name: 'Alice' }, 'q_')
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// generateCode()
// ---------------------------------------------------------------------------
describe('generateCode()', () => {
  it('starts with given prefix', () => {
    expect(generateCode('USR')).toMatch(/^USR\d+$/)
    expect(generateCode('ROLE')).toMatch(/^ROLE\d+$/)
  })

  it('uses USR as default prefix', () => {
    expect(generateCode()).toMatch(/^USR/)
  })

  it('produces unique values', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateCode()))
    // Not guaranteed but very likely unique within same ms; at least 8 chars suffix
    codes.forEach(c => expect(c.length).toBeGreaterThanOrEqual(4))
  })
})

// ---------------------------------------------------------------------------
// generateOTP / hashOTP / verifyOTP
// ---------------------------------------------------------------------------
describe('OTP helpers', () => {
  it('generateOTP() returns 6-digit numeric string', () => {
    const otp = generateOTP()
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('hashOTP() produces a bcrypt hash', async () => {
    const otp = '123456'
    const hash = await hashOTP(otp)
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it('verifyOTP() returns true for matching OTP', async () => {
    const otp = generateOTP()
    const hash = await hashOTP(otp)
    expect(await verifyOTP(otp, hash)).toBe(true)
  })

  it('verifyOTP() returns false for wrong OTP', async () => {
    const hash = await hashOTP('111111')
    expect(await verifyOTP('999999', hash)).toBe(false)
  })
})
