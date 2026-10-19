import { useState } from 'react'
import { z } from 'zod'
import { authApi } from '../data/auth-api'
import { emailSchema, fieldErrors, loginSchema, registerSchema, resetPasswordSchema } from '../model/auth'
import { userMessage } from '../../../shared/errors/message'

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password'

export function useAuthForm(mode: AuthMode) {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(form: HTMLFormElement) {
    if (busy) return
    setError(''); setSuccess(''); setErrors({})
    const values = Object.fromEntries(new FormData(form))
    const schema = mode === 'login' ? loginSchema : mode === 'register' ? registerSchema : mode === 'forgot-password' ? z.object({ email: emailSchema }) : resetPasswordSchema
    const result = schema.safeParse(values)
    if (!result.success) { setErrors(fieldErrors(result.error)); return }
    setBusy(true)
    try {
      if (mode === 'login') { const parsed = loginSchema.parse(values); await authApi.login(parsed.email, parsed.password) }
      else if (mode === 'register') {
        const parsed = registerSchema.parse(values)
        const result = await authApi.register(parsed.displayName, parsed.email, parsed.password)
        if (result.needsConfirmation) { setSuccess('Check your email for a verification link, then sign in to get started.'); form.reset() }
      } else if (mode === 'forgot-password') {
        await authApi.requestRecovery(emailSchema.parse(values.email))
        setSuccess('If an account exists for this email, you will receive a password reset link.')
      } else {
        await authApi.changePassword(resetPasswordSchema.parse(values).password)
        setSuccess('Your password has been updated. You can now return to your workspace.'); form.reset()
      }
    } catch (error) { setError(userMessage(error)) }
    finally { setBusy(false) }
  }
  return { busy, errors, error, success, submit }
}
