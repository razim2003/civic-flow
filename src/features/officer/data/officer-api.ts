import { supabase } from '../../../shared/lib/supabase/client'
import { categorySchema, complaintSchema, departmentSchema, statuses } from '../../complaints'
import { openStatuses, priorities, rosterSchema, workflowUnavailable } from '../model/officer'
import type { QueueFilters, WorkflowIntent } from '../model/officer'

const fields = 'id,citizen_id,category_id,department_id,assigned_officer_id,description,location_text,latitude,longitude,status,priority,resolution_text,resolved_at,withdrawal_reason,withdrawn_at,withdrawn_by,version,created_at,updated_at'
export const QUEUE_PAGE_SIZE = 10
export async function loadOfficerLookups(departmentId: string) {
  const [categories, departments, roster] = await Promise.all([
    supabase.from('categories').select('id,name,description,department_id,is_active').order('name'),
    supabase.from('departments').select('id,name,is_active').order('name'),
    supabase.rpc('list_assignable_officers', { p_department_id: departmentId }),
  ])
  if (categories.error) throw categories.error
  if (departments.error) throw departments.error
  if (roster.error && !workflowUnavailable(roster.error)) throw roster.error
  return { categories: categorySchema.array().parse(categories.data), departments: departmentSchema.array().parse(departments.data), officers: roster.error ? [] : rosterSchema.parse(roster.data), workflowReady: !roster.error }
}
export async function loadQueue(departmentId: string, actorId: string, filters: QueueFilters) {
  let query = supabase.from('complaints').select(fields, { count: 'exact' }).eq('department_id', departmentId).order('created_at', { ascending: false }).order('id')
    .range(filters.page * QUEUE_PAGE_SIZE, (filters.page + 1) * QUEUE_PAGE_SIZE - 1)
  if (filters.assignment === 'mine') query = query.eq('assigned_officer_id', actorId)
  if (filters.assignment === 'unassigned') query = query.is('assigned_officer_id', null)
  if (filters.status === 'open') query = query.in('status', [...openStatuses])
  else { const status = statuses.find((value) => value === filters.status); if (status) query = query.eq('status', status) }
  const priority = priorities.find((value) => value === filters.priority)
  if (priority) query = query.eq('priority', priority)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  const search = filters.search.trim().slice(0, 200)
  if (search) query = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search) ? query.eq('id', search) : query.ilike('description', `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
  const { data, error, count } = await query
  if (error) throw error
  return { complaints: complaintSchema.array().parse(data), count: count ?? 0 }
}
export async function loadOfficerSummary(departmentId: string, actorId: string) {
  const results = await Promise.all([
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('department_id', departmentId).in('status', [...openStatuses]),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('department_id', departmentId).eq('status', 'submitted'),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('department_id', departmentId).eq('status', 'in_progress'),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('department_id', departmentId).eq('assigned_officer_id', actorId).in('status', [...openStatuses]),
  ])
  for (const result of results) if (result.error) throw result.error
  return { open: results[0].count ?? 0, submitted: results[1].count ?? 0, inProgress: results[2].count ?? 0, mine: results[3].count ?? 0 }
}
export async function executeWorkflow(id: string, version: number, intent: WorkflowIntent) {
  const base = { p_id: id, p_expected_version: version }
  const query = intent.kind === 'review' ? supabase.rpc('review_complaint', { ...base, p_remark: intent.remark })
    : intent.kind === 'assign' ? supabase.rpc('assign_complaint', { ...base, p_officer_id: intent.officerId, p_reason: intent.reason })
      : intent.kind === 'priority' ? supabase.rpc('set_complaint_priority', { ...base, p_priority: intent.priority, p_reason: intent.reason })
        : intent.kind === 'start' ? supabase.rpc('start_complaint', { ...base, p_remark: intent.remark })
          : intent.kind === 'progress' ? supabase.rpc('add_progress', { ...base, p_remark: intent.remark })
            : intent.kind === 'resolve' ? supabase.rpc('resolve_complaint', { ...base, p_resolution_text: intent.resolution })
              : supabase.rpc('transfer_complaint', { ...base, p_department_id: intent.departmentId, p_category_id: intent.categoryId, p_reason: intent.reason })
  const { data, error } = await query.single()
  if (error) throw error
  return complaintSchema.parse(data)
}
