import { z } from 'zod'
import { slaState } from '../../../shared/sla'
import type { Priority } from '../../../shared/sla'

/** Mirrors admin_dispatch_complaint: route + optional Officer + 10–2,000 character reason. */
export const dispatchInputSchema = z.object({
  departmentId: z.uuid('Choose the department that should handle this complaint.'),
  categoryId: z.uuid('Choose a category that belongs to that department.'),
  officerId: z.uuid().nullable(),
  reason: z.string().trim().min(10, 'Explain the dispatch in at least 10 characters.').max(2000, 'Use at most 2,000 characters.'),
})
export type DispatchInput = z.input<typeof dispatchInputSchema>
export const officerSchema = z.object({ id: z.uuid(), display_name: z.string(), department_id: z.uuid().nullable() })
export type StaffOfficer = z.infer<typeof officerSchema>

export type AttentionFlag = 'unstaffed' | 'unassigned' | 'overdue'
type Dispatchable = { department_id: string; assigned_officer_id: string | null; created_at: string; priority: Priority; status: string }

/** Why an open complaint needs an Administrator: nobody can see it, nobody owns it, or it is late. */
export function attentionFlags(complaint: Dispatchable, staffedDepartments: ReadonlySet<string>, now = new Date()): AttentionFlag[] {
  const flags: AttentionFlag[] = []
  if (!staffedDepartments.has(complaint.department_id)) flags.push('unstaffed')
  if (!complaint.assigned_officer_id) flags.push('unassigned')
  if (slaState(complaint.created_at, complaint.priority, complaint.status, now).kind === 'overdue') flags.push('overdue')
  return flags
}
export const flagLabels: Record<AttentionFlag, string> = { unstaffed: 'No Officers in department', unassigned: 'Unassigned', overdue: 'Past service target' }

export function dispatchMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  if (message.includes('reason_required')) return 'Explain the dispatch in 10 to 2,000 characters.'
  if (message.includes('category_unavailable')) return 'Choose an active category that belongs to the selected active department.'
  if (message.includes('invalid_assignee')) return 'Choose an active Officer from the selected department.'
  if (message.includes('invalid_transition')) return 'Work has started: keep the department and choose an Officer to take over.'
  if (message.includes('complaint_closed')) return 'This complaint is already resolved or withdrawn.'
  if (message.includes('stale_version')) return 'This complaint changed while you were viewing it. Refresh and try again.'
  return ''
}
