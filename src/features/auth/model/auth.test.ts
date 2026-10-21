// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, resetPasswordSchema } from './auth'
import { parsePublicConfig } from '../../../shared/config/env'

describe('authentication input boundaries', () => {
  it('allows existing short passwords at login but requires stronger passwords at registration', () => {
    expect(loginSchema.safeParse({ email: 'citizen@example.test', password: 'old-pass' }).success).toBe(true)
    expect(registerSchema.safeParse({ displayName: 'Citizen', email: 'citizen@example.test', password: 'old-pass' }).success).toBe(false)
  })
  it('does not accept blank names, invalid email or mismatched recovery passwords', () => {
    expect(registerSchema.safeParse({ displayName: '  ', email: 'invalid', password: 'a-safe-long-passphrase' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ password: 'a-safe-long-passphrase', confirmPassword: 'another-long-password' }).success).toBe(false)
  })
  it('rejects a secret key accidentally supplied as the public key', () => {
    expect(() => parsePublicConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_in_the_browser' })).toThrow('configuration')
  })
  it('rejects insecure nonlocal project URLs without exposing their value in the error', () => {
    expect(() => parsePublicConfig({ VITE_SUPABASE_URL: 'http://private.example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only_key' })).toThrow('configuration')
  })
})
