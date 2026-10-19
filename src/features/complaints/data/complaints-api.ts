import { supabase } from '../../../shared/lib/supabase/client'
import { categorySchema, complaintSchema, departmentSchema, eventSchema, PAGE_SIZE, statuses } from '../model/complaint'
import type { Submission } from '../model/complaint'

const fields = 'id,citizen_id,category_id,department_id,description,location_text,latitude,longitude,status,priority,resolution_text,resolved_at,withdrawal_reason,withdrawn_at,withdrawn_by,version,created_at,updated_at'

export async function getLookups() {
  const [categories, departments] = await Promise.all([
    supabase.from('categories').select('id,name,description,department_id,is_active').order('name'),
    supabase.from('departments').select('id,name,is_active').order('name'),
  ])
  if (categories.error) throw categories.error
  if (departments.error) throw departments.error
  return { categories: categorySchema.array().parse(categories.data), departments: departmentSchema.array().parse(departments.data) }
}
export async function submitComplaint(input: Submission, requestId: string) {
  const { data, error } = await supabase.rpc('submit_complaint', { p_category_id: input.categoryId, p_description: input.description, p_location_text: input.locationText, p_latitude: input.latitude, p_longitude: input.longitude, p_request_id: requestId }).single()
  if (error) throw error
  return complaintSchema.parse(data)
}
export async function withdrawComplaint(id: string, reason: string, version: number) {
  const { data, error } = await supabase.rpc('withdraw_complaint', { p_complaint_id: id, p_reason: reason, p_expected_version: version }).single()
  if (error) throw error
  return complaintSchema.parse(data)
}
export async function getMyComplaints(userId: string, page: number, search = '', status = '') {
  let query = supabase.from('complaints').select(fields, { count: 'exact' }).eq('citizen_id', userId).order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  const selectedStatus = statuses.find((value) => value === status)
  if (selectedStatus) query = query.eq('status', selectedStatus)
  if (search.trim()) {
    const term = search.trim()
    query = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term) ? query.eq('id', term) : query.ilike('description', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
  }
  const { data, error, count } = await query
  if (error) throw error
  return { complaints: complaintSchema.array().parse(data), count: count ?? 0 }
}
export async function getMySummary(userId: string) {
  const results = await Promise.all(statuses.map((status) => supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('citizen_id', userId).eq('status', status)))
  for (const result of results) if (result.error) throw result.error
  const counts = results.map((r) => r.count ?? 0)
  return { total: counts.reduce((a, b) => a + b, 0), submitted: counts[0], active: counts[1] + counts[2], resolved: counts[3], withdrawn: counts[4] }
}
export async function getComplaint(id: string) {
  const { data, error } = await supabase.from('complaints').select(fields).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const events = await supabase.from('complaint_events').select('id,complaint_id,complaint_version,event_type,remark,created_at').eq('complaint_id', id).order('complaint_version')
  if (events.error) throw events.error
  return { complaint: complaintSchema.parse(data), events: eventSchema.array().parse(events.data) }
}
