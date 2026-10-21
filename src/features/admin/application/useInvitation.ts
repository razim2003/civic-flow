import { useCallback, useRef, useState } from 'react'
import { useResource } from '../../../shared/lib/useResource'
import { listDepartments, inviteOfficer } from '../data/users-api'
import { invitationSchema } from '../model/invitation'

export function useInvitation() {
  const departments = useResource(useCallback(listDepartments, []))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const inFlight = useRef(false)
  async function submit(values: unknown) {
    if (inFlight.current) return
    setError(''); setSuccess('')
    const parsed = invitationSchema.safeParse(values)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    inFlight.current = true; setBusy(true)
    try { await inviteOfficer(parsed.data); setSuccess('Officer account created and invitation sent. The Officer can set their password using the email link.') }
    catch (error) { setError(error instanceof Error ? error.message : 'The invitation could not be completed. Check User management before trying again.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return { departments, busy, error, success, submit }
}
