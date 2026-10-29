import { supabase } from '../../../shared/lib/supabase/client'
import { feedbackSchema } from '../model/feedback'
import type { FeedbackInput } from '../model/feedback'

const fields = 'complaint_id,citizen_id,rating,comment,created_at'
export async function getFeedback(complaintId: string) {
  const { data, error } = await supabase.from('complaint_feedback').select(fields).eq('complaint_id', complaintId).maybeSingle()
  if (error) throw error
  return data ? feedbackSchema.parse(data) : null
}
export async function submitFeedback(complaintId: string, input: FeedbackInput) {
  const { data, error } = await supabase.rpc('submit_feedback', { p_complaint_id: complaintId, p_rating: input.rating, p_comment: input.comment }).single()
  if (error) throw error
  return feedbackSchema.parse(data)
}
