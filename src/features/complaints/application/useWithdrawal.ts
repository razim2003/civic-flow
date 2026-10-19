import { useRef, useState } from 'react'
import { withdrawComplaint } from '../data/complaints-api'
import { withdrawalSchema } from '../model/complaint'
import { complaintMessage } from '../model/message'

export function useWithdrawal(id: string, version: number, onWithdrawn: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  async function submit(reason: string, confirmed: boolean) {
    if (inFlight.current) return
    setError('')
    const parsed = withdrawalSchema.safeParse({ reason, confirmed })
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    inFlight.current = true; setBusy(true)
    try { await withdrawComplaint(id, parsed.data.reason, version); await onWithdrawn() }
    catch (error) { setError(complaintMessage(error)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return { busy, error, submit }
}
