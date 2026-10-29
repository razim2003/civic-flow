import { supabase } from '../../../shared/lib/supabase/client'
import { adminCategorySchema, adminDepartmentSchema } from '../model/category'
import type { categoryInputSchema } from '../model/category'
import type { z } from 'zod'

// Administrators can read inactive lookups through RLS; other roles see active ones only.
export async function listCategoriesForAdmin() {
  const [categories, departments] = await Promise.all([
    supabase.from('categories').select('id,name,description,department_id,is_active,updated_at').order('name'),
    supabase.from('departments').select('id,name,is_active').order('name'),
  ])
  if (categories.error) throw categories.error
  if (departments.error) throw departments.error
  return { categories: adminCategorySchema.array().parse(categories.data), departments: adminDepartmentSchema.array().parse(departments.data) }
}
export async function saveCategory(input: z.output<typeof categoryInputSchema>) {
  const { data, error } = await supabase.rpc('admin_upsert_category', { p_id: input.id, p_name: input.name, p_description: input.description, p_department_id: input.departmentId, p_is_active: input.active }).single()
  if (error) throw error
  return adminCategorySchema.parse(data)
}
