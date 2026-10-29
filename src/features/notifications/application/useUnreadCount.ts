import { useCallback, useEffect, useRef, useState } from 'react'
import { countUnread } from '../data/unread-api'
import { unreadChangedEvent } from '../model/events'

/** Unread badge count; refreshes when the trigger (route) changes or the inbox marks items read. */
export function useUnreadCount(enabled: boolean, trigger: string) {
  const [count, setCount] = useState(0)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const ticket = ++sequence.current
    if (!enabled) { setCount(0); return }
    // The badge is a convenience; a failed count leaves the inbox itself to report errors.
    try { const unread = await countUnread(); if (ticket === sequence.current) setCount(unread) }
    catch { if (ticket === sequence.current) setCount(0) }
  }, [enabled])
  useEffect(() => { void load() }, [load, trigger])
  useEffect(() => {
    const listener = () => { void load() }
    window.addEventListener(unreadChangedEvent, listener)
    return () => { window.removeEventListener(unreadChangedEvent, listener); ++sequence.current }
  }, [load])
  return count
}
