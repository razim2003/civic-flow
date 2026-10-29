import { z } from 'zod'

const count = z.coerce.number().int().nonnegative()
/** Shape returned by public.admin_analytics(). Unknown keys are ignored. */
export const analyticsSchema = z.object({
  generated_at: z.string(),
  status: z.record(z.string(), count),
  priority: z.record(z.string(), count),
  overdue: count,
  categories: z.array(z.object({ id: z.uuid(), name: z.string(), is_active: z.boolean(), total: count, open: count, resolved: count })),
  departments: z.array(z.object({ id: z.uuid(), name: z.string(), is_active: z.boolean(), officers: count, open: count, unassigned: count, overdue: count })),
  officers: z.array(z.object({ id: z.uuid(), display_name: z.string(), department_id: z.uuid().nullable(), open: count, resolved: count })),
  resolution: z.object({ count, avg_hours: z.coerce.number().nullable(), within_target: count }),
  satisfaction: z.object({ count, average: z.coerce.number().nullable(), distribution: z.record(z.string(), count) }),
  trend: z.array(z.object({ month: z.string(), submitted: count, resolved: count })),
})
export type Analytics = z.infer<typeof analyticsSchema>

export function summarize(data: Analytics) {
  const total = Object.values(data.status).reduce((sum, value) => sum + value, 0)
  const open = (data.status.submitted ?? 0) + (data.status.under_review ?? 0) + (data.status.in_progress ?? 0)
  const withinTarget = data.resolution.count ? Math.round((data.resolution.within_target / data.resolution.count) * 100) : null
  const avgDays = data.resolution.avg_hours === null ? null : Math.round((data.resolution.avg_hours / 24) * 10) / 10
  const unstaffed = data.departments.filter((department) => department.is_active && department.officers === 0)
  return { total, open, withinTarget, avgDays, unstaffed }
}

function csvCell(value: string | number | null) {
  const text = value === null ? '' : String(value)
  // Neutralise spreadsheet formula injection and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}
export function toCsv(data: Analytics) {
  const rows: (string | number | null)[][] = [['section', 'name', 'metric', 'value']]
  for (const [status, value] of Object.entries(data.status)) rows.push(['status', status, 'complaints', value])
  for (const category of data.categories) for (const metric of ['total', 'open', 'resolved'] as const) rows.push(['category', category.name, metric, category[metric]])
  for (const department of data.departments) for (const metric of ['officers', 'open', 'unassigned', 'overdue'] as const) rows.push(['department', department.name, metric, department[metric]])
  for (const officer of data.officers) for (const metric of ['open', 'resolved'] as const) rows.push(['officer', officer.display_name, metric, officer[metric]])
  for (const month of data.trend) { rows.push(['trend', month.month, 'submitted', month.submitted]); rows.push(['trend', month.month, 'resolved', month.resolved]) }
  rows.push(['resolution', 'all', 'average_hours', data.resolution.avg_hours], ['resolution', 'all', 'within_target', data.resolution.within_target], ['satisfaction', 'all', 'average', data.satisfaction.average])
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
export function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value - 1, 1)).toLocaleDateString('en-LK', { month: 'short', timeZone: 'UTC' })
}
