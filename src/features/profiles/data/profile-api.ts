import { supabase } from '../../../shared/lib/supabase/client'

export async function updateMyProfile(displayName: string) {
  const { error } = await supabase.rpc('update_my_profile', { p_display_name: displayName }).single()
  if (error) throw error
}
