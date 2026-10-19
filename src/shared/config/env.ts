import { z } from 'zod'

const publicConfigSchema = z.object({
  VITE_SUPABASE_URL: z.url().refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
  }, 'Use HTTPS or a local Supabase URL.'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_').min(24),
})

export function parsePublicConfig(input: Record<string, unknown>) {
  const result = publicConfigSchema.safeParse(input)
  if (!result.success) throw new Error('Supabase configuration is missing or invalid. Check the public variables in .env.local.')
  return { supabaseUrl: result.data.VITE_SUPABASE_URL, supabasePublishableKey: result.data.VITE_SUPABASE_PUBLISHABLE_KEY }
}
