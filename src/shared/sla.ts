// Service-level targets by priority. Mirrors private.sla_hours() in migration 20261029000400.
export const slaHours = { urgent: 24, high: 72, normal: 168, low: 336 } as const
export type Priority = keyof typeof slaHours
const openStatuses = new Set(['submitted', 'under_review', 'in_progress'])

export type SlaState = { kind: 'closed' } | { kind: 'on_track' | 'due_soon' | 'overdue'; dueAt: Date; hoursLeft: number }

/** Due soon = less than a quarter of the target time remaining. */
export function slaState(createdAt: string, priority: Priority, status: string, now = new Date()): SlaState {
  if (!openStatuses.has(status)) return { kind: 'closed' }
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return { kind: 'closed' }
  const target = slaHours[priority]
  const dueAt = new Date(created.getTime() + target * 3_600_000)
  const hoursLeft = (dueAt.getTime() - now.getTime()) / 3_600_000
  return { kind: hoursLeft < 0 ? 'overdue' : hoursLeft < target / 4 ? 'due_soon' : 'on_track', dueAt, hoursLeft }
}

export function describeSla(state: SlaState) {
  if (state.kind === 'closed') return ''
  const hours = Math.abs(state.hoursLeft)
  const span = hours >= 48 ? `${Math.round(hours / 24)} days` : hours >= 1 ? `${Math.round(hours)} h` : 'under 1 h'
  return state.kind === 'overdue' ? `Overdue by ${span}` : `Due in ${span}`
}
