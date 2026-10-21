import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database } from '../../../src/shared/lib/supabase/database.types.ts'
import { InvitationError, provisionHandler } from './handler.ts'

declare const Deno: { env: { get: (name: string) => string | undefined }; serve: (handler: (request: Request) => Promise<Response>) => void }
function environmentKey(direct: string, map: string) {
  const value = Deno.env.get(direct)
  if (value) return value
  const keys: unknown = JSON.parse(Deno.env.get(map) ?? '{}')
  if (typeof keys === 'object' && keys !== null && 'default' in keys && typeof keys.default === 'string') return keys.default
  throw new Error('Server configuration unavailable')
}
Deno.serve(async (request) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('Server configuration unavailable')
    const appUrl = (Deno.env.get('CIVICFLOW_APP_URL') ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
    const origins = [...new Set([appUrl, 'http://127.0.0.1:5173', 'http://localhost:5173'])]
    const caller = createClient<Database>(url, environmentKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'), { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } }, auth: { persistSession: false, autoRefreshToken: false } })
    return await provisionHandler({
      async authenticate(token) {
        const { data, error } = await caller.auth.getUser(token)
        if (error || !data.user) return null
        const profile = await caller.from('profiles').select('role,is_active').eq('id', data.user.id).maybeSingle()
        return { administrator: !profile.error && profile.data?.role === 'administrator' && profile.data.is_active }
      },
      async departmentActive(id) {
        const { data, error } = await caller.from('departments').select('id').eq('id', id).eq('is_active', true).maybeSingle()
        return !error && !!data
      },
      async invite(input, redirectTo) {
        // This client/key exists only in the trusted Supabase runtime.
        const admin = createClient(url, environmentKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), { auth: { persistSession: false, autoRefreshToken: false } })
        const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { data: { display_name: input.displayName }, redirectTo })
        if (error?.code === 'email_address_not_authorized') throw new InvitationError('email_delivery_unavailable')
        if (error?.code === 'over_email_send_rate_limit') throw new InvitationError('email_rate_limited')
        if (error || !data.user) throw new Error('Invitation incomplete')
        return { id: data.user.id }
      },
      async promote(id, input) {
        // Uses the caller's JWT: the database rechecks current Administrator
        // access, validates the department and writes the existing audit event.
        const { error } = await caller.rpc('admin_update_user', { p_target_id: id, p_role: 'officer', p_department_id: input.departmentId, p_is_active: true, p_display_name: input.displayName }).single()
        if (error) throw new Error('Officer access pending')
      },
    }, origins, appUrl)(request)
  } catch { return new Response(JSON.stringify({ code: 'service_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } }) }
})
