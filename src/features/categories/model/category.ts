import { z } from 'zod'

/** Mirrors admin_upsert_category bounds; the database remains authoritative. */
export const categoryInputSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, 'Enter a category name.').max(100, 'Use at most 100 characters for the name.'),
  description: z.string().trim().max(500, 'Use at most 500 characters for the description.'),
  departmentId: z.uuid('Select the department that receives these complaints.'),
  active: z.boolean(),
})
export type CategoryInput = z.input<typeof categoryInputSchema>
export const adminCategorySchema = z.object({ id: z.uuid(), name: z.string(), description: z.string().nullable(), department_id: z.uuid(), is_active: z.boolean(), updated_at: z.string() })
export type AdminCategory = z.infer<typeof adminCategorySchema>
export const adminDepartmentSchema = z.object({ id: z.uuid(), name: z.string(), is_active: z.boolean() })
export type AdminDepartment = z.infer<typeof adminDepartmentSchema>

export function categoryMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  if (message.includes('category_name_taken')) return 'Another category already uses this name. Choose a different name.'
  if (message.includes('category_in_use')) return 'This category already has complaints, so its department cannot change. Create a new category for the new department and deactivate this one.'
  if (message.includes('department_unavailable')) return 'An active category must route to an active department. Choose an active department or save the category as inactive.'
  return ''
}
