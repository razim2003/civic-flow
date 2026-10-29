import { z } from 'zod'

export const NOTIFICATION_PAGE_SIZE = 10
export const notificationSchema = z.object({
  id: z.uuid(), complaint_id: z.uuid(), event_id: z.uuid(),
  kind: z.enum(['submission', 'progress', 'resolution']), created_at: z.string(), read_at: z.string().nullable(),
})
export type Notification = z.infer<typeof notificationSchema>
export const notificationEventSchema = z.object({ id: z.uuid(), event_type: z.string(), remark: z.string().nullable() })
export type NotificationEvent = z.infer<typeof notificationEventSchema>
export type InboxItem = Notification & { title: string; detail: string | null }

const kindTitles: Record<Notification['kind'], string> = { submission: 'Complaint received', progress: 'Complaint updated', resolution: 'Complaint resolved' }

/** Builds display text from the authorized history event; never trusts stored HTML. */
export function toInboxItem(notification: Notification, event: NotificationEvent | undefined, eventLabels: Record<string, string>): InboxItem {
  return { ...notification, title: (event && eventLabels[event.event_type]) ?? kindTitles[notification.kind], detail: event?.remark ?? null }
}
