import { supabase } from '../../../shared/lib/supabase/client'
import { profileSchema } from '../../auth'
import type { Role } from '../../auth'

const PAGE_SIZE = 20
export async function listUsers(search: string, page: number) {
  let query = supabase.from('profiles').select('id,display_name,role,is_active,department_id,created_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (search.trim()) query = query.ilike('display_name', `%${search.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
  const { data, error, count } = await query
  if (error) throw error
  return { users: profileSchema.array().parse(data), count: count ?? 0, pageSize: PAGE_SIZE }
}
export async function listDepartments() {
  const { data, error } = await supabase.from('departments').select('id,name').eq('is_active', true).order('name')
  if (error) throw error
  return data
}
export async function updateUser(input: { id: string; role: Role; departmentId: string | null; active: boolean; name: string }) {
  const { error } = await supabase.rpc('admin_update_user', { p_target_id: input.id, p_role: input.role, p_department_id: input.departmentId, p_is_active: input.active, p_display_name: input.name }).single()
  if (error) throw error
}
