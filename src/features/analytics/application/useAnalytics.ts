import { useCallback } from 'react'
import { useResource } from '../../../shared/lib/useResource'
import { getAnalytics } from '../data/analytics-api'
import { toCsv } from '../model/analytics'
import type { Analytics } from '../model/analytics'

export function useAnalytics() {
  const loader = useCallback(() => getAnalytics(), [])
  return useResource(loader)
}

const byteOrderMark = String.fromCharCode(0xfeff) // lets spreadsheet apps detect UTF-8

/** Hands the viewer a CSV of the current figures (no data leaves the browser). */
export function downloadCsv(data: Analytics) {
  const url = URL.createObjectURL(new Blob([byteOrderMark, toCsv(data)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = `civicflow-analytics-${data.generated_at.slice(0, 10)}.csv`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
