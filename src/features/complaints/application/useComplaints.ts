import { useCallback } from 'react'
import { useAuth } from '../../auth'
import { useResource } from '../../../shared/lib/useResource'
import { getComplaint, getLookups, getMyComplaints, getMySummary } from '../data/complaints-api'

export function useComplaintList(page: number, search = '', status = '') {
  const { profile } = useAuth()
  const userId = profile?.id ?? ''
  const loader = useCallback(async () => {
    const [list, lookups] = await Promise.all([getMyComplaints(userId, page, search, status), getLookups()])
    return { ...list, ...lookups }
  }, [userId, page, search, status])
  return useResource(loader)
}
export function useCitizenOverview() {
  const { profile } = useAuth()
  const userId = profile?.id ?? ''
  const loader = useCallback(async () => {
    const [summary, recent, lookups] = await Promise.all([getMySummary(userId), getMyComplaints(userId, 0), getLookups()])
    return { summary, recent: recent.complaints.slice(0, 5), ...lookups }
  }, [userId])
  return useResource(loader)
}
export function useComplaintDetail(id: string) {
  const loader = useCallback(async () => {
    const detail = await getComplaint(id)
    if (!detail) return null
    return { ...detail, ...await getLookups() }
  }, [id])
  return useResource(loader)
}
