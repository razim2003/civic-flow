import { useCallback, useState } from 'react'
import { eventLabels } from '../../complaints'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { useResource } from '../../../shared/lib/useResource'
import { listNotifications } from '../data/notifications-api'
import { markRead } from '../data/unread-api'
import { unreadChangedEvent } from '../model/events'
import { toInboxItem } from '../model/notification'

export function useNotifications(page: number, unreadOnly: boolean) {
  const loader = useCallback(async () => {
    const result = await listNotifications(page, unreadOnly)
    return { count: result.count, items: result.notifications.map((item) => toInboxItem(item, result.events.find((event) => event.id === item.event_id), eventLabels)) }
  }, [page, unreadOnly])
  const state = useResource(loader)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  async function mark(ids: string[] | null) {
    if (busy) return
    setBusy(true); setActionError('')
    try { await markRead(ids); await state.reload(); window.dispatchEvent(new Event(unreadChangedEvent)) }
    catch (error) { setActionError(complaintMessage(error)) }
    finally { setBusy(false) }
  }
  return { ...state, busy, actionError, markOne: (id: string) => mark([id]), markAll: () => mark(null) }
}
