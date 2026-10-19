import { useState } from 'react'
import { z } from 'zod'
import { useAuth } from '../../auth'
import { updateMyProfile } from '../data/profile-api'
import { userMessage } from '../../../shared/errors/message'

export function useProfileForm() {
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(displayName: string) {
    if (busy) return
    const parsed = z.string().trim().min(1).max(100).safeParse(displayName)
    if (!parsed.success) { setError('Enter a name between 1 and 100 characters.'); return }
    setBusy(true); setError('')
    try { await updateMyProfile(parsed.data); await refreshProfile() } catch (error) { setError(userMessage(error)) } finally { setBusy(false) }
  }
  return { busy, error, save }
}
