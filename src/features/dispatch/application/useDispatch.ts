import { useCallback, useMemo, useRef, useState } from 'react'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { useResource } from '../../../shared/lib/useResource'
import { dispatchComplaint, loadDispatchBoard } from '../data/dispatch-api'
import { attentionFlags, dispatchInputSchema, dispatchMessage } from '../model/dispatch'
import type { DispatchInput } from '../model/dispatch'

export function useDispatchBoard() {
  const loader = useCallback(() => loadDispatchBoard(), [])
  const state = useResource(loader)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  const [success, setSuccess] = useState('')
  const inFlight = useRef(false)

  const board = useMemo(() => {
    if (!state.data) return null
    const staffed = new Set(state.data.officers.flatMap((officer) => (officer.department_id ? [officer.department_id] : [])))
    const rows = state.data.complaints.map((complaint) => ({ complaint, flags: attentionFlags(complaint, staffed) }))
    const coverage = state.data.departments.filter((department) => department.is_active).map((department) => {
      const open = rows.filter((row) => row.complaint.department_id === department.id)
      return { department, officers: state.data!.officers.filter((officer) => officer.department_id === department.id).length, open: open.length, unassigned: open.filter((row) => !row.complaint.assigned_officer_id).length, overdue: open.filter((row) => row.flags.includes('overdue')).length }
    })
    return { ...state.data, rows, coverage }
  }, [state.data])

  async function dispatch(id: string, version: number, input: DispatchInput) {
    if (inFlight.current) return false
    setError(null); setSuccess('')
    const parsed = dispatchInputSchema.safeParse(input)
    if (!parsed.success) { setError({ id, message: parsed.error.issues[0].message }); return false }
    inFlight.current = true; setBusyId(id)
    try {
      await dispatchComplaint(id, version, parsed.data)
      await state.reload()
      setSuccess('Complaint dispatched. The citizen and any assigned Officer have been notified.')
      return true
    } catch (caught) { setError({ id, message: dispatchMessage(caught) || complaintMessage(caught) }); return false }
    finally { inFlight.current = false; setBusyId('') }
  }
  return { ...state, board, busyId, error, success, dispatch, clear: () => { setError(null); setSuccess('') } }
}
