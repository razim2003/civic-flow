// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { categoryInputSchema, categoryMessage } from './category'

const valid = { id: null, name: 'Street lighting', description: '', departmentId: randomUUID(), active: true }

describe('CF-20 category input matches admin_upsert_category bounds', () => {
  it('accepts a new or existing category and trims text', () => {
    expect(categoryInputSchema.parse({ ...valid, name: '  Street lighting ' }).name).toBe('Street lighting')
    expect(categoryInputSchema.safeParse({ ...valid, id: randomUUID() }).success).toBe(true)
  })
  it.each([
    ['empty name', { name: '   ' }], ['long name', { name: 'x'.repeat(101) }], ['long description', { description: 'x'.repeat(501) }],
    ['missing department', { departmentId: '' }], ['invalid id', { id: 'not-a-uuid' }],
  ])('rejects %s', (_label, change) => expect(categoryInputSchema.safeParse({ ...valid, ...change }).success).toBe(false))
  it('explains database rule violations', () => {
    expect(categoryMessage({ message: 'category_name_taken' })).toMatch(/already uses this name/)
    expect(categoryMessage({ message: 'category_in_use' })).toMatch(/cannot change/)
    expect(categoryMessage(new Error('department_unavailable'))).toMatch(/active department/)
    expect(categoryMessage(new Error('x'))).toBe('')
  })
})
