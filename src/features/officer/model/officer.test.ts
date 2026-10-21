// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { queueReturnPath, readQueueFilters, validateIntent, workflowMessage, workflowUnavailable } from './officer'

const id = '10000000-0000-4000-8000-000000000001'
describe('Officer intent validation', () => {
  it('requires an explanation for reassignment after work starts', () => {
    expect(() => validateIntent({ kind: 'assign', officerId: id, reason: '' }, 'in_progress', null)).toThrow()
    expect(() => validateIntent({ kind: 'assign', officerId: id, reason: '' }, 'submitted', null)).not.toThrow()
    expect(() => validateIntent({ kind: 'assign', officerId: id, reason: '' }, 'in_progress', id)).not.toThrow()
  })
  it('requires matching identifiers and a bounded explanation before a transfer request', () => {
    expect(() => validateIntent({ kind: 'transfer', departmentId: id, categoryId: '', reason: 'Route to water services.' }, 'submitted', null)).toThrow()
    expect(() => validateIntent({ kind: 'transfer', departmentId: id, categoryId: id, reason: 'short' }, 'submitted', null)).toThrow()
  })
  it('requires meaningful progress and resolution with their separate bounds', () => {
    expect(() => validateIntent({ kind: 'progress', remark: ' ' }, 'in_progress', id)).toThrow()
    expect(() => validateIntent({ kind: 'resolve', resolution: 'short' }, 'in_progress', id)).toThrow()
    expect(() => validateIntent({ kind: 'resolve', resolution: 'x'.repeat(5001) }, 'in_progress', id)).toThrow()
    expect(() => validateIntent({ kind: 'resolve', resolution: 'x'.repeat(5000) }, 'in_progress', id)).not.toThrow()
  })
  it('explains stale writes without exposing unrelated backend details', () => {
    expect(workflowMessage({ message: 'stale_version' })).toContain('Refresh and review')
    expect(workflowMessage(new Error('sensitive internal exception'))).not.toContain('sensitive')
  })
  it('bounds untrusted queue URLs and retains valid filters', () => {
    expect(readQueueFilters(new URLSearchParams('page=Infinity&category=bad&status=made_up&priority=invalid'), false)).toEqual({ page: 0, search: '', status: 'open', categoryId: '', priority: '', assignment: 'all' })
    expect(readQueueFilters(new URLSearchParams(`page=2&category=${id}&status=resolved&priority=high&assignment=unassigned&search= road `), false)).toMatchObject({ page: 2, search: 'road', categoryId: id, status: 'resolved', priority: 'high', assignment: 'unassigned' })
  })
  it('keeps Assigned to me scoped to the current Officer despite URL tampering', () => {
    expect(readQueueFilters(new URLSearchParams('assignment=all'), true).assignment).toBe('mine')
    expect(readQueueFilters(new URLSearchParams('assignment=unassigned'), true).assignment).toBe('mine')
  })
  it('returns only to permitted internal Officer queues', () => {
    expect(queueReturnPath({ returnTo: '/officer/assigned?status=all&page=2' })).toBe('/officer/assigned?status=all&page=2')
    for (const returnTo of ['https://foreign.example.test/officer/complaints', '//foreign.example.test', 'javascript:alert(1)', '/admin/users']) expect(queueReturnPath({ returnTo })).toBe('/officer/complaints')
    expect(queueReturnPath(null)).toBe('/officer/complaints')
  })
  it('distinguishes an unavailable workflow from denied authorization', () => {
    expect(workflowUnavailable({ code: 'PGRST202' })).toBe(true)
    expect(workflowUnavailable({ code: '42501' })).toBe(false)
    expect(workflowMessage({ code: 'PGRST202' })).toContain('awaiting activation')
  })
})
