// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { analyticsSchema, summarize, toCsv } from './analytics'

const sample = analyticsSchema.parse({
  generated_at: '2026-10-29T10:00:00Z', status: { submitted: 3, in_progress: 1, resolved: 4, withdrawn: 1 }, priority: { normal: 4 }, overdue: 2,
  categories: [{ id: randomUUID(), name: '=HYPERLINK("x")', is_active: true, total: 5, open: 2, resolved: 3 }],
  departments: [{ id: randomUUID(), name: 'Water supply', is_active: true, officers: 0, open: 2, unassigned: 2, overdue: 1 }],
  officers: [], resolution: { count: 4, avg_hours: 60, within_target: 3 }, satisfaction: { count: 2, average: '4.50', distribution: { 5: 1, 4: 1 } },
  trend: [{ month: '2026-10', submitted: 8, resolved: 4 }],
})

describe('CR-006 analytics', () => {
  it('summarises totals, open work, target rate and unstaffed departments', () => {
    expect(summarize(sample)).toMatchObject({ total: 9, open: 4, withinTarget: 75, avgDays: 2.5 })
    expect(summarize(sample).unstaffed.map((department) => department.name)).toEqual(['Water supply'])
    expect(sample.satisfaction.average).toBe(4.5)
  })
  it('exports quoted CSV and neutralises spreadsheet formulas', () => {
    const csv = toCsv(sample)
    expect(csv.split('\r\n')[0]).toBe('"section","name","metric","value"')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).not.toMatch(/(^|,)"=/m)
  })
})
