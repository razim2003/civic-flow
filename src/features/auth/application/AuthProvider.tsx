import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../data/auth-api'
import type { Profile } from '../model/auth'
import { userMessage } from '../../../shared/errors/message'

type AuthState = { loading: boolean; userId: string | null; profile: Profile | null; error: string | null; recovery: boolean }
type AuthContextValue = AuthState & { refreshProfile: () => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)
const emptyState: AuthState = { loading: false, userId: null, profile: null, error: null, recovery: false }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...emptyState, loading: true })
  const sequence = useRef(0)
  const userRef = useRef<string | null>(null)
  const mounted = useRef(false)

  const loadProfile = useCallback(async (userId: string, ticket: number) => {
    try {
      const profile = await authApi.profile(userId)
      if (mounted.current && ticket === sequence.current) setState((s) => ({ ...s, loading: false, profile, error: null }))
    } catch (error) {
      if (mounted.current && ticket === sequence.current) setState((s) => ({ ...s, loading: false, profile: null, error: userMessage(error) }))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = authApi.subscribe((userId, recovery) => {
      const ticket = ++sequence.current
      userRef.current = userId
      setState((previous) => userId ? {
        ...emptyState,
        userId,
        loading: previous.userId !== userId || !previous.profile,
        profile: previous.userId === userId ? previous.profile : null,
        recovery: recovery || (previous.userId === userId && previous.recovery),
      } : emptyState)
      // Do not await another Supabase call inside the synchronous Auth callback.
      if (userId) window.setTimeout(() => { if (mounted.current && ticket === sequence.current) void loadProfile(userId, ticket) }, 0)
    })
    return () => { mounted.current = false; ++sequence.current; unsubscribe() }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    const userId = userRef.current
    if (!userId) return
    const ticket = ++sequence.current
    setState((s) => ({ ...s, loading: true, profile: null, error: null }))
    await loadProfile(userId, ticket)
  }, [loadProfile])

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && userRef.current) void refreshProfile() }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [refreshProfile])

  const logout = useCallback(async () => {
    // Clear privileged UI even if a network logout fails.
    ++sequence.current
    userRef.current = null
    setState(emptyState)
    await authApi.logout()
  }, [])

  return <AuthContext.Provider value={{ ...state, refreshProfile, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requires AuthProvider')
  return context
}
