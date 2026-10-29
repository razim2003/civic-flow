import { useState } from 'react'
import { Star } from 'lucide-react'
import { Notice, SubmitButton } from '../../../shared/ui/Form'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { useFeedback } from '../application/useFeedback'
import { ratingLabels, ratings } from '../model/feedback'

function Stars({ value }: { value: number }) {
  return <span className="rating-stars" role="img" aria-label={`${value} out of 5`}>{ratings.map((rating) => <Star key={rating} size={16} aria-hidden="true" className={rating <= value ? 'star-filled' : ''} />)}</span>
}

/** Shown for resolved complaints. The owner submits once; other authorized viewers read it. */
export function FeedbackPanel({ complaintId, canSubmit }: { complaintId: string; canSubmit: boolean }) {
  const state = useFeedback(complaintId)
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  if (state.loading && !state.data) return <section className="panel feedback-panel"><h2>Service feedback</h2><p role="status" className="muted">Loading feedback…</p></section>
  if (state.error) return <section className="panel feedback-panel"><h2>Service feedback</h2><Notice>{complaintMessage(state.error)}</Notice><button className="button button-secondary" type="button" onClick={() => void state.reload()}>Try again</button></section>
  const feedback = state.data
  if (feedback) return <section className="panel feedback-panel"><h2>Service feedback</h2><div className="feedback-summary"><Stars value={feedback.rating} /><strong>{ratingLabels[feedback.rating]}</strong></div>{feedback.comment ? <p className="complaint-description">{feedback.comment}</p> : <p className="muted">No comment was added.</p>}<p className="muted">{canSubmit ? 'Thank you for your feedback. It cannot be changed after submission.' : 'Submitted by the complaint owner.'}</p></section>
  if (!canSubmit) return <section className="panel feedback-panel"><h2>Service feedback</h2><p className="muted">The complaint owner has not given feedback yet.</p></section>
  return <section className="panel feedback-panel"><h2>How was the service?</h2><p className="muted">Your complaint is resolved. Rate how it was handled to help the service team improve. Feedback can be submitted once.</p>
    <form noValidate onSubmit={(event) => { event.preventDefault(); void state.submit(rating, comment) }}>
      {state.submitError && <Notice>{state.submitError}</Notice>}
      <fieldset className="rating-choice" disabled={state.busy}><legend>Rating</legend>{ratings.map((value) => <label key={value} className={rating === value ? 'rating-selected' : ''}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} /><Stars value={value} /><span>{ratingLabels[value]}</span></label>)}</fieldset>
      <div className="field"><label htmlFor="feedback-comment">Comment (optional)</label><textarea id="feedback-comment" rows={3} maxLength={2000} value={comment} disabled={state.busy} aria-describedby="feedback-comment-hint" onChange={(event) => setComment(event.target.value)} /><p id="feedback-comment-hint" className="field-hint">Up to 2,000 characters. The service team can read your feedback.</p></div>
      <SubmitButton busy={state.busy}>Submit feedback</SubmitButton>
    </form></section>
}
