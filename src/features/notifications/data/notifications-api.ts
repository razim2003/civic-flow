import { supabase } from '../../../shared/lib/supabase/client'
import { NOTIFICATION_PAGE_SIZE, notificationEventSchema, notificationSchema } from '../model/notification'

// RLS returns only the caller's own notifications; no recipient filter is trusted from the client.
export async function listNotifications(page: number, unreadOnly: boolean) {
  let query = supabase.from('notifications').select('id,complaint_id,event_id,kind,created_at,read_at', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id').range(page * NOTIFICATION_PAGE_SIZE, (page + 1) * NOTIFICATION_PAGE_SIZE - 1)
  if (unreadOnly) query = query.is('read_at', null)
  const { data, error, count } = await query
  if (error) throw error
  const notifications = notificationSchema.array().parse(data)
  if (!notifications.length) return { notifications, events: [], count: count ?? 0 }
  const events = await supabase.from('complaint_events').select('id,event_type,remark').in('id', notifications.map((item) => item.event_id))
  if (events.error) throw events.error
  return { notifications, events: notificationEventSchema.array().parse(events.data), count: count ?? 0 }
}
