import { useCallback, useRef, useState } from 'react'
import { useResource } from '../../../shared/lib/useResource'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { getFeedback, submitFeedback } from '../data/feedback-api'
import { feedbackInputSchema, feedbackMessage } from '../model/feedback'

export function useFeedback(complaintId: string) {
  const loader = useCallback(() => getFeedback(complaintId), [complaintId])
  const state = useResource(loader)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlight = useRef(false)
  async function submit(rating: number | null, comment: string) {
    if (inFlight.current) return
    setSubmitError('')
    const parsed = feedbackInputSchema.safeParse({ rating: rating ?? undefined, comment })
    if (!parsed.success) { setSubmitError(parsed.error.issues[0].message); return }
    inFlight.current = true; setBusy(true)
    try { await submitFeedback(complaintId, parsed.data); await state.reload() }
    catch (error) { setSubmitError(feedbackMessage(error) || complaintMessage(error)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return { ...state, busy, submitError, submit }
}
