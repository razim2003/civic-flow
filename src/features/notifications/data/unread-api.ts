import { supabase } from '../../../shared/lib/supabase/client'

// Kept separate from the inbox adapter so the app shell badge stays lightweight.
export async function countUnread() {
  const { error, count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  if (error) throw error
  return count ?? 0
}
export async function markRead(ids: string[] | null) {
  const { error } = await supabase.rpc('mark_notifications_read', { p_notification_ids: ids, p_all: ids === null })
  if (error) throw error
}
