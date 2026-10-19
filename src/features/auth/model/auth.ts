import { z } from 'zod'

export const roles = ['citizen', 'officer', 'administrator'] as const
export type Role = typeof roles[number]
export const roleLabels: Record<Role, string> = { citizen: 'Citizen', officer: 'Officer', administrator: 'Administrator' }
export const profileSchema = z.object({
  id: z.uuid(), display_name: z.string().min(1).max(100), role: z.enum(roles),
  is_active: z.boolean(), department_id: z.uuid().nullable(), created_at: z.string(), updated_at: z.string(),
})
export type Profile = z.infer<typeof profileSchema>
export const emailSchema = z.email('Enter a valid email address.').trim().max(254)
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.').max(128) })
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128, 'Use at most 128 characters.')
export const registerSchema = z.object({ displayName: z.string().trim().min(1, 'Enter your name.').max(100), email: emailSchema, password: passwordSchema })
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords must match.' })

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}
