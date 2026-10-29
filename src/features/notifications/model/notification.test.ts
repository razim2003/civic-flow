// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { notificationSchema, toInboxItem } from './notification'

const base = { id: randomUUID(), complaint_id: randomUUID(), event_id: randomUUID(), created_at: '2026-10-29T10:00:00Z', read_at: null }
const labels = { assigned: 'Officer assigned', resolved: 'Complaint resolved' }

describe('CF-13 inbox items', () => {
  it('uses the history event label and remark as plain text', () => {
    const item = toInboxItem({ ...base, kind: 'progress' }, { id: base.event_id, event_type: 'assigned', remark: '<b>Team A</b>' }, labels)
    expect(item).toMatchObject({ title: 'Officer assigned', detail: '<b>Team A</b>' })
  })
  it('falls back to the notification kind when the event is unavailable or unknown', () => {
    expect(toInboxItem({ ...base, kind: 'resolution' }, undefined, labels).title).toBe('Complaint resolved')
    expect(toInboxItem({ ...base, kind: 'submission' }, { id: base.event_id, event_type: 'unknown', remark: null }, labels).title).toBe('Complaint received')
  })
  it('rejects notification kinds outside the database constraint', () => {
    expect(notificationSchema.safeParse({ ...base, kind: 'sms' }).success).toBe(false)
  })
})
