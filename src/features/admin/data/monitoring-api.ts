import { supabase } from '../../../shared/lib/supabase/client'
import { statuses } from '../../complaints'
import { summarizeMonitoring } from '../model/monitoring'

// Administrator RLS already permits monitoring reads; these are head-only counts plus ratings.
export async function getMonitoringSummary() {
  const [counts, ratings] = await Promise.all([
    Promise.all(statuses.map((status) => supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', status))),
    supabase.from('complaint_feedback').select('rating'),
  ])
  for (const result of counts) if (result.error) throw result.error
  if (ratings.error) throw ratings.error
  return summarizeMonitoring(statuses.map((status, index) => [status, counts[index].count ?? 0] as const), ratings.data.map((row) => row.rating))
}
