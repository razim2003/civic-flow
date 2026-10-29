import { AlarmClock, Timer } from 'lucide-react'
import { describeSla, slaState } from '../sla'
import type { Priority } from '../sla'

export function SlaBadge({ createdAt, priority, status }: { createdAt: string; priority: Priority; status: string }) {
  const state = slaState(createdAt, priority, status)
  if (state.kind === 'closed') return null
  const Icon = state.kind === 'overdue' ? AlarmClock : Timer
  return <span className={`sla-badge sla-${state.kind === 'on_track' ? 'ok' : state.kind === 'due_soon' ? 'due' : 'overdue'}`} title={`Target: ${state.dueAt.toLocaleString('en-LK')}`}><Icon size={13} aria-hidden="true" />{describeSla(state)}</span>
}
