import { createClient } from '@supabase/supabase-js'
import { parsePublicConfig } from '../../config/env'
import type { Database } from './database.types'

const config = parsePublicConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

export const supabase = createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true },
})
