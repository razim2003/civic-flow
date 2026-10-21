import { supabase } from '../../../shared/lib/supabase/client'
import { profileSchema } from '../../auth'
import type { Role } from '../../auth'
import type { OfficerInvitation } from '../model/invitation'

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
export async function inviteOfficer(input: OfficerInvitation) {
  const { data, error } = await supabase.functions.invoke<unknown>('provision-officer', { body: input })
  if (!error && typeof data === 'object' && data !== null && 'code' in data && data.code === 'officer_invited') return
  let code = ''
  if (error && 'context' in error && error.context instanceof Response) {
    try { const body: unknown = await error.context.json(); if (typeof body === 'object' && body !== null && 'code' in body) code = String(body.code) } catch { /* Generic failure below includes uncertain-response guidance. */ }
  }
  if (code === 'administrator_required' || code === 'not_authenticated') throw new Error('Active Administrator access is required. Sign in again and retry.')
  if (code === 'department_unavailable') throw new Error('This department is unavailable. Choose an active department.')
  if (code === 'email_delivery_unavailable') throw new Error('Email delivery to this address is unavailable. Ask the project operator to configure the email service before retrying.')
  if (code === 'email_rate_limited') throw new Error('The email sending limit was reached. Check User management and wait before trying again.')
  if (code === 'officer_access_pending') throw new Error('The invitation was created, but Officer access could not be assigned. The account has no Officer privileges. Open User management to complete its access setup.')
  throw new Error('The invitation could not be completed. Check User management before trying again; the email may already be registered or the email service may be unavailable.')
}
