import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import type { Complaint } from '../../complaints'
import { useAuth } from '../../auth'
import { useResource } from '../../../shared/lib/useResource'
import { executeWorkflow, loadOfficerLookups, loadOfficerSummary, loadQueue } from '../data/officer-api'
import type { QueueFilters, WorkflowIntent } from '../model/officer'
import { validateIntent, workflowMessage } from '../model/officer'

export function useOfficerQueue(filters: QueueFilters) {
  const { profile } = useAuth()
  const departmentId = profile?.department_id ?? '', actorId = profile?.id ?? ''
  const { page, search, status, categoryId, priority, assignment } = filters
  return useResource(useCallback(async () => {
    const [queue, lookups] = await Promise.all([loadQueue(departmentId, actorId, { page, search, status, categoryId, priority, assignment }), loadOfficerLookups(departmentId)])
    return { ...queue, ...lookups }
  }, [departmentId, actorId, page, search, status, categoryId, priority, assignment]))
}
export function useOfficerOverview() {
  const { profile } = useAuth()
  const departmentId = profile?.department_id ?? '', actorId = profile?.id ?? ''
  return useResource(useCallback(async () => {
    const [summary, queue, lookups] = await Promise.all([loadOfficerSummary(departmentId, actorId), loadQueue(departmentId, actorId, { page: 0, search: '', status: 'open', categoryId: '', priority: '', assignment: 'all' }), loadOfficerLookups(departmentId)])
    return { summary, ...queue, ...lookups }
  }, [departmentId, actorId]))
}
export function useOfficerActions(complaint: Complaint, onChanged: () => Promise<void>) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const departmentId = profile?.department_id ?? ''
  const lookups = useResource(useCallback(() => loadOfficerLookups(departmentId), [departmentId]))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const inFlight = useRef(false)
  async function run(intent: WorkflowIntent) {
    if (inFlight.current) return false
    if (!lookups.data?.workflowReady) { setError('Processing is not available yet. Check the team setup and try again.'); return false }
    try { validateIntent(intent, complaint.status, complaint.assigned_officer_id) }
    catch (error) { setError(error instanceof z.ZodError ? error.issues[0].message : 'Check the entered details.'); return false }
    inFlight.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const updated = await executeWorkflow(complaint.id, complaint.version, intent)
      if (updated.department_id !== departmentId) { navigate('/officer/complaints', { replace: true, state: { notice: 'Complaint transferred. The destination department can now process it.' } }); return true }
      await onChanged(); setSuccess(updated.version === complaint.version ? 'No change was needed. This complaint is already up to date.' : 'Complaint updated. The change is recorded in its history.'); return true
    } catch (error) { setError(workflowMessage(error)); return false }
    finally { inFlight.current = false; setBusy(false) }
  }
  return { lookups, busy, error, success, run }
}
