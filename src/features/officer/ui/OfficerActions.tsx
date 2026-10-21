import { useState } from 'react'
import { useAuth } from '../../auth'
import type { Complaint } from '../../complaints'
import { Notice, SubmitButton } from '../../../shared/ui/Form'
import { useOfficerActions } from '../application/useOfficer'
import { openStatuses, priorities, queueMessage } from '../model/officer'
import type { Priority, WorkflowIntent } from '../model/officer'
import { WorkflowActivationNotice } from './WorkflowActivationNotice'

type Kind = WorkflowIntent['kind']
const labels: Record<Kind, string> = { review: 'Begin review', assign: 'Assign / reassign Officer', priority: 'Set priority', start: 'Start work', progress: 'Add progress update', resolve: 'Resolve complaint', transfer: 'Transfer to another service' }
function Actions({ complaint, onChanged, refreshing }: { complaint: Complaint; onChanged: () => Promise<void>; refreshing: boolean }) {
  const { profile } = useAuth()
  const state = useOfficerActions(complaint, onChanged)
  const [kind, setKind] = useState<Kind>('review'), [remark, setRemark] = useState(''), [assignee, setAssignee] = useState<string | null>(null), [priority, setPriority] = useState<Priority | null>(null), [categoryId, setCategoryId] = useState(''), [confirmed, setConfirmed] = useState(false)
  if (state.lookups.loading && !state.lookups.data) return <section className="panel"><h2>Process complaint</h2><p role="status" className="muted">Loading your department team…</p></section>
  if (state.lookups.error) return <section className="panel"><h2>Process complaint</h2><Notice>{queueMessage(state.lookups.error)} <button className="inline-button" onClick={() => void state.lookups.reload()}>Retry team</button></Notice></section>
  if (!state.lookups.data?.workflowReady) return <section className="panel"><h2>Process complaint</h2><WorkflowActivationNotice onRetry={() => void state.lookups.reload()} busy={state.lookups.loading} /></section>
  const selectedAssignee = assignee ?? complaint.assigned_officer_id ?? '', selectedPriority = priority ?? complaint.priority
  const assignedToMe = complaint.assigned_officer_id === profile?.id
  const actions: Kind[] = ['assign', 'priority']
  if (complaint.status === 'submitted') actions.unshift('review')
  if (complaint.status === 'under_review' && assignedToMe) actions.unshift('start')
  if (complaint.status === 'in_progress' && assignedToMe) actions.unshift('progress', 'resolve')
  if (complaint.status === 'submitted' || complaint.status === 'under_review') actions.push('transfer')
  const selected = actions.includes(kind) ? kind : actions[0]
  const activeDepartments = new Set(state.lookups.data?.departments.filter((department) => department.is_active).map((department) => department.id))
  const destinations = state.lookups.data?.categories.filter((category) => category.is_active && activeDepartments.has(category.department_id) && (category.department_id !== complaint.department_id || category.id !== complaint.category_id)) ?? []
  const guidance = complaint.status === 'submitted' ? 'Begin review, check the location and evidence, then assign an Officer.'
    : complaint.status === 'under_review' ? complaint.assigned_officer_id ? assignedToMe ? 'You are assigned to this complaint. Start work when you are ready to act.' : 'An Officer is assigned. Only that Officer can start work.' : 'Assign an Officer before work can start.'
      : assignedToMe ? 'Keep the Citizen informed with progress updates. Resolve only when the work is complete.' : 'Work is underway. The assigned Officer records progress and resolution.'
  return <section className="panel officer-actions"><h2>Process complaint</h2><p className="muted">Assigned to {state.lookups.data?.officers.find((officer) => officer.id === complaint.assigned_officer_id)?.display_name ?? (complaint.assigned_officer_id ? 'an unavailable Officer' : 'no Officer yet')} · {complaint.priority} priority</p>
    <p className="officer-guidance">{guidance}</p>
    {state.error && <Notice>{state.error}</Notice>}{state.success && <Notice success>{state.success}</Notice>}
    <form noValidate onSubmit={(event) => {
      event.preventDefault(); if (refreshing || (selected === 'resolve' && !confirmed)) return
      const category = destinations.find((value) => value.id === categoryId)
      const intent: WorkflowIntent = selected === 'assign' ? { kind: selected, officerId: selectedAssignee, reason: remark }
        : selected === 'priority' ? { kind: selected, priority: selectedPriority, reason: remark }
          : selected === 'transfer' ? { kind: selected, categoryId, departmentId: category?.department_id ?? '', reason: remark }
            : selected === 'resolve' ? { kind: selected, resolution: remark } : { kind: selected, remark }
      void state.run(intent).then((saved) => { if (saved) { setRemark(''); setConfirmed(false); setAssignee(null); setPriority(null) } })
    }}><fieldset disabled={state.busy || refreshing || state.lookups.loading}>
      <div className="field"><label htmlFor="officer-action">Action</label><select id="officer-action" value={selected} onChange={(event) => { const action = actions.find((value) => value === event.target.value); if (action) { setKind(action); setRemark(''); setConfirmed(false) } }}>{actions.map((action) => <option value={action} key={action}>{labels[action]}</option>)}</select></div>
      {selected === 'assign' && <div className="field"><label htmlFor="assigned-officer">Assign to Officer</label><select id="assigned-officer" value={selectedAssignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Choose an Officer</option>{state.lookups.data?.officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.display_name}{officer.id === profile?.id ? ' (you)' : ''}</option>)}</select><p className="field-hint">Only active Officers in this department can be assigned.</p></div>}
      {selected === 'priority' && <div className="field"><label htmlFor="new-priority">New priority</label><select id="new-priority" value={selectedPriority} onChange={(event) => { const value = priorities.find((value) => value === event.target.value); if (value) setPriority(value) }}>{priorities.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>}
      {selected === 'transfer' && <div className="field"><label htmlFor="destination-category">Destination service category</label><select id="destination-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Choose a destination</option>{destinations.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><p className="field-hint">The destination department will receive this complaint. Its old assignment will be cleared.</p></div>}
      <div className="field"><label htmlFor="officer-remark">{selected === 'resolve' ? 'Resolution details' : selected === 'progress' ? 'Progress update' : selected === 'transfer' || (selected === 'assign' && complaint.status === 'in_progress') ? 'Reason for change' : 'Remark (optional)'}</label><textarea id="officer-remark" rows={4} maxLength={selected === 'resolve' ? 5000 : 2000} value={remark} onChange={(event) => setRemark(event.target.value)} /><p className="field-hint">{selected === 'resolve' ? '10–5,000 characters. Describe what was done and the result.' : selected === 'transfer' || (selected === 'assign' && complaint.status === 'in_progress') ? 'Explain the reason in 10–2,000 characters.' : selected === 'progress' ? '1-2,000 characters. Record the work completed and what happens next.' : 'Updates are visible to the Citizen. Use plain text and avoid unnecessary personal details.'}</p></div>
      {selected === 'resolve' && <label className="checkbox-label withdrawal-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I confirm the issue is resolved. This will close the complaint.</label>}
      <SubmitButton busy={state.busy} disabled={(selected === 'resolve' && !confirmed) || (selected === 'assign' && !state.lookups.data.officers.length) || (selected === 'transfer' && !destinations.length)}>{labels[selected]}</SubmitButton>
    </fieldset></form>
    {!assignedToMe && <p className="field-hint">Only the assigned Officer can start work, add progress or resolve the complaint.</p>}
  </section>
}
export function OfficerActions(props: { complaint: Complaint; onChanged: () => Promise<void>; refreshing: boolean }) {
  const { profile } = useAuth()
  if (profile?.role !== 'officer' || profile.department_id !== props.complaint.department_id) return null
  if (!openStatuses.some((status) => status === props.complaint.status)) return <section className="panel"><h2>Complaint closed</h2><p className="muted">Resolved and Withdrawn complaints remain available for reference. Further processing is disabled.</p></section>
  return <Actions {...props} />
}
