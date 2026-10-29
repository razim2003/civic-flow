// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { attentionFlags, dispatchInputSchema, dispatchMessage } from './dispatch'

const department = randomUUID(), now = new Date('2026-10-29T12:00:00Z')
const base = { department_id: department, assigned_officer_id: randomUUID(), created_at: '2026-10-29T10:00:00Z', priority: 'normal' as const, status: 'submitted' }

describe('CR-006 dispatch rules', () => {
  it('flags complaints nobody can see, nobody owns or that are past target', () => {
    expect(attentionFlags(base, new Set([department]), now)).toEqual([])
    expect(attentionFlags({ ...base, assigned_officer_id: null }, new Set(), now)).toEqual(['unstaffed', 'unassigned'])
    expect(attentionFlags({ ...base, priority: 'urgent', created_at: '2026-10-27T10:00:00Z' }, new Set([department]), now)).toEqual(['overdue'])
    expect(attentionFlags({ ...base, priority: 'urgent', created_at: '2026-10-27T10:00:00Z', status: 'resolved' }, new Set([department]), now)).toEqual([])
  })
  it('matches the RPC input bounds', () => {
    const valid = { departmentId: department, categoryId: randomUUID(), officerId: null, reason: 'Routed to the staffed team.' }
    expect(dispatchInputSchema.safeParse(valid).success).toBe(true)
    expect(dispatchInputSchema.safeParse({ ...valid, reason: 'short' }).success).toBe(false)
    expect(dispatchInputSchema.safeParse({ ...valid, reason: 'x'.repeat(2001) }).success).toBe(false)
    expect(dispatchInputSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false)
  })
  it('explains database refusals', () => {
    expect(dispatchMessage({ message: 'invalid_transition' })).toMatch(/Work has started/)
    expect(dispatchMessage(new Error('invalid_assignee'))).toMatch(/active Officer/)
    expect(dispatchMessage(new Error('other'))).toBe('')
  })
})
