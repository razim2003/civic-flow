import { z } from 'zod'

export const priorities = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = typeof priorities[number]
export const openStatuses = ['submitted', 'under_review', 'in_progress'] as const
export const rosterSchema = z.array(z.object({ id: z.uuid(), display_name: z.string() }))
export type Officer = z.infer<typeof rosterSchema>[number]
export const optionalRemark = z.string().trim().max(2000, 'Use at most 2,000 characters.')
export const reasonSchema = optionalRemark.min(10, 'Explain the reason in at least 10 characters.')
export const progressSchema = optionalRemark.min(1, 'Enter a progress update.')
export const resolutionSchema = z.string().trim().min(10, 'Describe the resolution in at least 10 characters.').max(5000, 'Use at most 5,000 characters.')
export type WorkflowIntent =
  | { kind: 'review'; remark: string }
  | { kind: 'assign'; officerId: string; reason: string }
  | { kind: 'priority'; priority: Priority; reason: string }
  | { kind: 'start'; remark: string }
  | { kind: 'progress'; remark: string }
  | { kind: 'resolve'; resolution: string }
  | { kind: 'transfer'; categoryId: string; departmentId: string; reason: string }
export type QueueFilters = { page: number; search: string; status: string; categoryId: string; priority: string; assignment: 'all' | 'mine' | 'unassigned' }
export function readQueueFilters(params: URLSearchParams, mine: boolean): QueueFilters {
  const page = Number(params.get('page') ?? 0)
  const status = params.get('status') ?? 'open', priority = params.get('priority') ?? '', category = params.get('category') ?? ''
  const assignment = params.get('assignment')
  return {
    page: Number.isInteger(page) && page >= 0 && page <= 10000 ? page : 0,
    search: (params.get('search') ?? '').trim().slice(0, 200),
    status: ['open', 'all', ...openStatuses, 'resolved', 'withdrawn'].includes(status) ? status : 'open',
    priority: priorities.some((value) => value === priority) ? priority : '',
    categoryId: z.uuid().safeParse(category).success ? category : '',
    assignment: mine ? 'mine' : assignment === 'mine' || assignment === 'unassigned' ? assignment : 'all',
  }
}
export function queueReturnPath(state: unknown) {
  if (typeof state !== 'object' || state === null || !('returnTo' in state) || typeof state.returnTo !== 'string') return '/officer/complaints'
  try {
    const url = new URL(state.returnTo, 'https://civicflow.invalid')
    if (url.origin === 'https://civicflow.invalid' && ['/officer/complaints', '/officer/assigned'].includes(url.pathname)) return url.pathname + url.search
  } catch { /* Untrusted navigation state falls back to the department queue. */ }
  return '/officer/complaints'
}
export function workflowUnavailable(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'PGRST202' || error.code === '42883')
}
export function queueMessage(error: unknown) {
  if (workflowUnavailable(error)) return 'Complaint processing is awaiting activation. Ask your project Administrator to finish setup.'
  return 'The department workspace could not load. Refresh to try again. If this continues, ask your Administrator to check your access.'
}

export function validateIntent(intent: WorkflowIntent, status: string, assignedId: string | null) {
  if (intent.kind === 'assign') {
    z.uuid('Choose an Officer.').parse(intent.officerId)
    if (status === 'in_progress' && assignedId !== intent.officerId) reasonSchema.parse(intent.reason)
    else optionalRemark.parse(intent.reason)
  } else if (intent.kind === 'transfer') {
    z.uuid('Choose a destination category.').parse(intent.categoryId)
    z.uuid('Choose a valid destination department.').parse(intent.departmentId)
    reasonSchema.parse(intent.reason)
  } else if (intent.kind === 'resolve') resolutionSchema.parse(intent.resolution)
  else if (intent.kind === 'progress') progressSchema.parse(intent.remark)
  else if (intent.kind === 'priority') { z.enum(priorities).parse(intent.priority); optionalRemark.parse(intent.reason) }
  else optionalRemark.parse(intent.remark)
}

export function workflowMessage(error: unknown) {
  if (workflowUnavailable(error)) return queueMessage(error)
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  if (message.includes('stale_version')) return 'This complaint changed. Refresh and review the latest update before trying again.'
  if (message.includes('complaint_closed')) return 'This complaint is resolved or withdrawn. Refresh to see its final status.'
  if (message.includes('not_assigned')) return 'Only the currently assigned Officer can perform this action.'
  if (message.includes('invalid_assignee')) return 'Choose an active Officer in this complaint’s department.'
  if (message.includes('reason_required')) return 'Explain the reason in 10 to 2,000 characters.'
  if (message.includes('progress_required')) return 'Enter a progress update in 1 to 2,000 characters.'
  if (message.includes('resolution_required')) return 'Describe the resolution in 10 to 5,000 characters.'
  if (message.includes('invalid_transition')) return 'This action is unavailable at the complaint’s current stage. Refresh and review its status.'
  if (message.includes('category_unavailable')) return 'Choose an active category and its matching active department.'
  if (message.includes('not_authorized')) return 'You do not have access to perform this action in this department.'
  return 'The request could not be completed. Check the latest complaint history before trying again.'
}
