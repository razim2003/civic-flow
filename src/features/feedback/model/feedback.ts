import { z } from 'zod'

export const ratings = [1, 2, 3, 4, 5] as const
export type Rating = (typeof ratings)[number]
export const ratingLabels: Record<Rating, string> = { 1: 'Very poor', 2: 'Poor', 3: 'Acceptable', 4: 'Good', 5: 'Excellent' }
const ratingMessage = 'Choose a rating from 1 to 5.'
/** Mirrors submit_feedback: rating 1-5, optional trimmed comment up to 2,000 characters. */
export const feedbackInputSchema = z.object({
  rating: z.number({ error: ratingMessage }).int(ratingMessage).min(1, ratingMessage).max(5, ratingMessage),
  comment: z.string().trim().max(2000, 'Use at most 2,000 characters.'),
})
export type FeedbackInput = z.infer<typeof feedbackInputSchema>
export const feedbackSchema = z.object({ complaint_id: z.uuid(), citizen_id: z.uuid(), rating: z.union(ratings.map((rating) => z.literal(rating))), comment: z.string().nullable(), created_at: z.string() })
export type Feedback = z.infer<typeof feedbackSchema>

export function feedbackMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  if (message.includes('feedback_exists')) return 'Feedback was already submitted for this complaint. Refresh to see it.'
  if (message.includes('feedback_closed')) return 'Feedback can be given only after your complaint is resolved.'
  if (message.includes('invalid_feedback')) return 'Choose a rating from 1 to 5 and keep your comment within 2,000 characters.'
  return ''
}
