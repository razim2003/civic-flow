import { supabase } from '../../../shared/lib/supabase/client'
import { categorySchema, complaintSchema, departmentSchema } from '../../complaints'
import { officerSchema } from '../model/dispatch'
import type { dispatchInputSchema } from '../model/dispatch'
import type { z } from 'zod'

const fields = 'id,citizen_id,category_id,department_id,assigned_officer_id,description,location_text,latitude,longitude,status,priority,resolution_text,resolved_at,withdrawal_reason,withdrawn_at,withdrawn_by,version,created_at,updated_at'
export const BOARD_LIMIT = 200

// Administrator RLS permits monitoring reads of every complaint and application profile.
export async function loadDispatchBoard() {
  const [complaints, categories, departments, officers] = await Promise.all([
    supabase.from('complaints').select(fields, { count: 'exact' }).in('status', ['submitted', 'under_review', 'in_progress']).order('created_at').order('id').limit(BOARD_LIMIT),
    supabase.from('categories').select('id,name,description,department_id,is_active').order('name'),
    supabase.from('departments').select('id,name,is_active').order('name'),
    supabase.from('profiles').select('id,display_name,department_id').eq('role', 'officer').eq('is_active', true).order('display_name'),
  ])
  for (const result of [complaints, categories, departments, officers]) if (result.error) throw result.error
  return {
    complaints: complaintSchema.array().parse(complaints.data), total: complaints.count ?? 0,
    categories: categorySchema.array().parse(categories.data), departments: departmentSchema.array().parse(departments.data),
    officers: officerSchema.array().parse(officers.data),
  }
}
export async function dispatchComplaint(id: string, version: number, input: z.output<typeof dispatchInputSchema>) {
  const { data, error } = await supabase.rpc('admin_dispatch_complaint', { p_id: id, p_department_id: input.departmentId, p_category_id: input.categoryId, p_officer_id: input.officerId, p_expected_version: version, p_reason: input.reason }).single()
  if (error) throw error
  return complaintSchema.parse(data)
}
