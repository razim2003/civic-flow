export type MonitoringSummary = { total: number; open: number; byStatus: Record<string, number>; feedbackCount: number; averageRating: number | null }

/** Open means not yet in a final state (Resolved or Withdrawn). */
export function summarizeMonitoring(counts: readonly (readonly [string, number])[], ratings: number[]): MonitoringSummary {
  const byStatus = Object.fromEntries(counts)
  const total = counts.reduce((sum, [, count]) => sum + count, 0)
  const open = counts.filter(([status]) => status !== 'resolved' && status !== 'withdrawn').reduce((sum, [, count]) => sum + count, 0)
  const averageRating = ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null
  return { total, open, byStatus, feedbackCount: ratings.length, averageRating }
}
