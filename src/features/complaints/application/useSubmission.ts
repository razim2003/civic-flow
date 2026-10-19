import { useCallback, useRef, useState } from 'react'
import { useResource } from '../../../shared/lib/useResource'
import { submitComplaint, getLookups } from '../data/complaints-api'
import { submissionSchema } from '../model/complaint'
import type { Submission } from '../model/complaint'
import { complaintMessage } from '../model/message'

export function useSubmission() {
  const lookups = useResource(useCallback(getLookups, []))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')
  const requestId = useRef(crypto.randomUUID())
  const inFlight = useRef(false)
  async function submit(values: Submission) {
    if (inFlight.current || savedId) return
    setErrors({}); setError('')
    const parsed = submissionSchema.safeParse(values)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message
      setErrors(fields); return
    }
    inFlight.current = true; setBusy(true)
    try { const complaint = await submitComplaint(parsed.data, requestId.current); setSavedId(complaint.id) }
    catch (error) { setError(complaintMessage(error)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return { lookups, busy, errors, error, savedId, submit }
}
