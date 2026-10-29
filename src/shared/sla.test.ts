// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { describeSla, slaHours, slaState } from './sla'

const now = new Date('2026-10-29T12:00:00Z')
describe('service-level targets (mirrors private.sla_hours)', () => {
  it('uses the agreed targets per priority', () => expect(slaHours).toEqual({ urgent: 24, high: 72, normal: 168, low: 336 }))
  it('classifies on track, due soon and overdue open complaints', () => {
    expect(slaState('2026-10-29T10:00:00Z', 'normal', 'submitted', now).kind).toBe('on_track')
    expect(slaState('2026-10-28T16:00:00Z', 'urgent', 'under_review', now).kind).toBe('due_soon')
    const overdue = slaState('2026-10-27T12:00:00Z', 'urgent', 'in_progress', now)
    expect(overdue.kind).toBe('overdue')
    expect(describeSla(overdue)).toBe('Overdue by 24 h')
  })
  it('ignores final states and invalid dates', () => {
    expect(slaState('2026-01-01T00:00:00Z', 'urgent', 'resolved', now).kind).toBe('closed')
    expect(slaState('not a date', 'urgent', 'submitted', now).kind).toBe('closed')
  })
})
