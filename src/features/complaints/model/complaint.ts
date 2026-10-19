import { z } from 'zod'

export const progressStatuses = ['submitted', 'under_review', 'in_progress', 'resolved'] as const
export const statuses = [...progressStatuses, 'withdrawn'] as const
export const statusLabels = { submitted: 'Submitted', under_review: 'Under review', in_progress: 'In progress', resolved: 'Resolved', withdrawn: 'Withdrawn' }
export const eventLabels: Record<string, string> = { submitted: 'Complaint submitted', reviewed: 'Complaint reviewed', assigned: 'Officer assigned', transferred: 'Transferred to another service', priority_changed: 'Priority updated', started: 'Work started', progress_added: 'Progress update', resolved: 'Complaint resolved', evidence_added: 'Supporting evidence added', withdrawn: 'Complaint withdrawn' }
export const submissionSchema = z.object({
  categoryId: z.uuid('Select a service category.'),
  description: z.string().trim().min(10, 'Describe the issue in at least 10 characters.').max(5000, 'Use at most 5,000 characters.'),
  locationText: z.string().trim().min(1, 'Describe where the issue is located.').max(300, 'Use at most 300 characters.'),
  latitude: z.number({ error: 'Select a location or enter a latitude.' }).finite().min(-90, 'Latitude must be between -90 and 90.').max(90, 'Latitude must be between -90 and 90.'),
  longitude: z.number({ error: 'Select a location or enter a longitude.' }).finite().min(-180, 'Longitude must be between -180 and 180.').max(180, 'Longitude must be between -180 and 180.'),
})
export type Submission = z.infer<typeof submissionSchema>
export const complaintSchema = z.object({
  id: z.uuid(), citizen_id: z.uuid(), category_id: z.uuid(), department_id: z.uuid(),
  description: z.string(), location_text: z.string(), latitude: z.number(), longitude: z.number(),
  status: z.enum(statuses), priority: z.enum(['low', 'normal', 'high', 'urgent']),
  resolution_text: z.string().nullable(), resolved_at: z.string().nullable(),
  withdrawal_reason: z.string().nullable(), withdrawn_at: z.string().nullable(), withdrawn_by: z.uuid().nullable(),
  version: z.number(), created_at: z.string(), updated_at: z.string(),
})
export type Complaint = z.infer<typeof complaintSchema>
export function canWithdraw(status: Complaint['status']) { return status === 'submitted' || status === 'under_review' || status === 'in_progress' }
export const withdrawalSchema = z.object({
  reason: z.string().trim().min(10, 'Explain your reason in at least 10 characters.').max(2000, 'Use at most 2,000 characters.'),
  confirmed: z.literal(true, { error: 'Confirm that you want to withdraw this complaint.' }),
})
export const categorySchema = z.object({ id: z.uuid(), name: z.string(), description: z.string().nullable(), department_id: z.uuid(), is_active: z.boolean() })
export const departmentSchema = z.object({ id: z.uuid(), name: z.string(), is_active: z.boolean() })
export type Category = z.infer<typeof categorySchema>
export type Department = z.infer<typeof departmentSchema>
export const eventSchema = z.object({ id: z.uuid(), complaint_id: z.uuid(), complaint_version: z.number(), event_type: z.string(), remark: z.string().nullable(), created_at: z.string() })
export type ComplaintEvent = z.infer<typeof eventSchema>
export const PAGE_SIZE = 10
export function shortReference(id: string) { return `CF-${id.slice(0, 8).toUpperCase()}` }
export function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
}
