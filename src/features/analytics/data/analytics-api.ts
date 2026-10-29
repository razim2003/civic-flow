import { supabase } from '../../../shared/lib/supabase/client'
import { analyticsSchema } from '../model/analytics'

export async function getAnalytics() {
  const { data, error } = await supabase.rpc('admin_analytics')
  if (error) throw error
  return analyticsSchema.parse(data)
}
