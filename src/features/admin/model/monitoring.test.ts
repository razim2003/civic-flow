// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { summarizeMonitoring } from './monitoring'

describe('CF-21 basic monitoring summary', () => {
  it('counts open complaints excluding final states and averages ratings to one decimal', () => {
    const summary = summarizeMonitoring([['submitted', 2], ['under_review', 1], ['in_progress', 3], ['resolved', 4], ['withdrawn', 1]], [5, 4, 4])
    expect(summary).toMatchObject({ total: 11, open: 6, feedbackCount: 3, averageRating: 4.3 })
    expect(summary.byStatus.resolved).toBe(4)
  })
  it('reports no average when there is no feedback', () => {
    expect(summarizeMonitoring([['submitted', 0]], []).averageRating).toBeNull()
  })
})
