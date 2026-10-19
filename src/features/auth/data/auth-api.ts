import { supabase } from '../../../shared/lib/supabase/client'
import { profileSchema } from '../model/auth'

export const authApi = {
  subscribe(callback: (userId: string | null, recovery: boolean) => void) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session?.user.id ?? null, event === 'PASSWORD_RECOVERY'))
    return () => data.subscription.unsubscribe()
  },
  async profile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('id,display_name,role,is_active,department_id,created_at,updated_at').eq('id', userId).maybeSingle()
    if (error) throw error
    if (!data || !data.is_active) throw new Error('not_authorized')
    return profileSchema.parse(data)
  },
  async login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },
  async register(displayName: string, email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/auth/callback` } })
    if (error) throw error
    return { needsConfirmation: !data.session }
  },
  async logout() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
  },
  async requestRecovery(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) throw error
  },
  async changePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },
}
