import { useCallback } from 'react'
import { useResource } from '../../../shared/lib/useResource'
import { getMonitoringSummary } from '../data/monitoring-api'

export function useMonitoring() {
  const loader = useCallback(() => getMonitoringSummary(), [])
  return useResource(loader)
}
