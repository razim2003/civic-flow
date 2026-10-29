import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertTriangle, ArrowUpRight, RefreshCw, Send, UserPlus, Users } from 'lucide-react'
import { categoryLabel, displayDate, shortReference, StatusBadge } from '../../complaints'
import type { Complaint } from '../../complaints'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { Notice, SubmitButton } from '../../../shared/ui/Form'
import { riseItem, Stagger } from '../../../shared/ui/motion'
import { SlaBadge } from '../../../shared/ui/SlaBadge'
import { useDispatchBoard } from '../application/useDispatch'
import { flagLabels } from '../model/dispatch'
import type { AttentionFlag } from '../model/dispatch'

type View = 'attention' | 'unassigned' | 'overdue' | 'all'
const views: { id: View; label: string; match: (flags: AttentionFlag[]) => boolean }[] = [
  { id: 'attention', label: 'Needs attention', match: (flags) => flags.length > 0 },
  { id: 'unassigned', label: 'Unassigned', match: (flags) => flags.includes('unassigned') },
  { id: 'overdue', label: 'Past target', match: (flags) => flags.includes('overdue') },
  { id: 'all', label: 'All open', match: () => true },
]

export function DispatchPage() {
  const state = useDispatchBoard()
  const [view, setView] = useState<View>('attention')
  const [openId, setOpenId] = useState('')
  const board = state.board
  const rows = board?.rows.filter((row) => views.find((item) => item.id === view)!.match(row.flags)) ?? []
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">ADMINISTRATION</span><h1>Dispatch centre</h1><p>Every complaint needs a responsible Officer. Route complaints out of departments without staff, assign owners and catch anything past its service target.</p></div>
    <button className="button button-secondary" type="button" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
    {state.error ? <Notice>{complaintMessage(state.error)}</Notice> : null}{state.success && <Notice success>{state.success}</Notice>}
    {board && <>
      <div className="section-title-row" style={{ marginTop: 0 }}><div><h2>Department coverage</h2><p className="muted">Complaints are routed by category. A department with no active Officers can't process anything.</p></div><Link className="text-link" to="/admin/officers/new"><UserPlus size={15} aria-hidden="true" />Invite an Officer</Link></div>
      <Stagger className="coverage-grid">{board.coverage.map((item) => <motion.section variants={riseItem} key={item.department.id} className={`coverage-card ${item.officers === 0 ? 'coverage-gap' : ''}`} aria-label={`${item.department.name} coverage`}>
        <h3>{item.department.name}</h3>
        <dl><div><dt>Officers</dt><dd>{item.officers}</dd></div><div><dt>Open</dt><dd>{item.open}</dd></div><div><dt>Unassigned</dt><dd>{item.unassigned}</dd></div></dl>
        {item.officers === 0 && <span className="coverage-flag"><AlertTriangle size={13} aria-hidden="true" />No Officers{item.open ? ` · ${item.open} waiting` : ''}</span>}
      </motion.section>)}</Stagger>
      <div className="filter-chips" role="group" aria-label="Filter complaints">{views.map((item) => <button key={item.id} type="button" className="chip" aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}<span className="chip-count">{board.rows.filter((row) => item.match(row.flags)).length}</span></button>)}</div>
      {rows.length ? <Stagger className="dispatch-list">{rows.map(({ complaint, flags }) => <motion.article variants={riseItem} key={complaint.id} className="dispatch-row" aria-label={`Complaint ${shortReference(complaint.id)}`}>
        <div>
          <div className="dispatch-meta"><span className="complaint-reference">{shortReference(complaint.id)}</span><StatusBadge status={complaint.status} /><span className={`priority-label priority-${complaint.priority}`}>{complaint.priority}</span><SlaBadge createdAt={complaint.created_at} priority={complaint.priority} status={complaint.status} /></div>
          <h3>{categoryLabel(board.categories.find((category) => category.id === complaint.category_id)?.name ?? 'Public service complaint')} · {board.departments.find((department) => department.id === complaint.department_id)?.name ?? 'Unknown department'}</h3>
          <p>{complaint.description}</p>
          <div className="dispatch-meta" style={{ marginTop: 8 }}><Users size={13} aria-hidden="true" />{board.officers.find((officer) => officer.id === complaint.assigned_officer_id)?.display_name ?? 'Unassigned'}<span>· Submitted {displayDate(complaint.created_at)}</span>{flags.map((flag) => <span key={flag} className="badge badge-signal">{flagLabels[flag]}</span>)}</div>
        </div>
        <div className="button-row"><Link className="button button-secondary button-small" to={`/admin/complaints/${complaint.id}`}>View<ArrowUpRight size={14} aria-hidden="true" /></Link><button type="button" className="button button-primary button-small" aria-expanded={openId === complaint.id} onClick={() => { state.clear(); setOpenId(openId === complaint.id ? '' : complaint.id) }}><Send size={14} aria-hidden="true" />Dispatch</button></div>
        {openId === complaint.id && <DispatchForm complaint={complaint} board={board} busy={state.busyId === complaint.id} error={state.error?.id === complaint.id ? state.error.message : ''} onSubmit={async (input) => { if (await state.dispatch(complaint.id, complaint.version, input)) setOpenId('') }} onCancel={() => setOpenId('')} />}
      </motion.article>)}</Stagger> : <section className="panel complaint-empty"><h2>{view === 'attention' ? 'Every open complaint has an owner' : 'Nothing here'}</h2><p>{view === 'attention' ? 'No complaint is unassigned, stuck in an unstaffed department or past its service target.' : 'No open complaints match this view.'}</p></section>}
      {board.total > board.complaints.length && <p className="muted">Showing the oldest {board.complaints.length} of {board.total} open complaints.</p>}
    </>}
    {state.loading && !board && <div className="coverage-grid">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 120 }} />)}</div>}
  </>
}

type Board = NonNullable<ReturnType<typeof useDispatchBoard>['board']>
function DispatchForm({ complaint, board, busy, error, onSubmit, onCancel }: { complaint: Complaint; board: Board; busy: boolean; error: string; onSubmit: (input: { departmentId: string; categoryId: string; officerId: string | null; reason: string }) => Promise<void>; onCancel: () => void }) {
  const [departmentId, setDepartmentId] = useState(complaint.department_id)
  const [categoryId, setCategoryId] = useState(complaint.category_id)
  const [officerId, setOfficerId] = useState(complaint.assigned_officer_id ?? '')
  const [reason, setReason] = useState('')
  const categories = board.categories.filter((category) => category.is_active && category.department_id === departmentId)
  const officers = board.officers.filter((officer) => officer.department_id === departmentId)
  const prefix = `dispatch-${complaint.id}`
  return <motion.form className="dispatch-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} noValidate onSubmit={(event) => { event.preventDefault(); void onSubmit({ departmentId, categoryId, officerId: officerId || null, reason }) }}>
    {error && <div className="wide"><Notice>{error}</Notice></div>}
    <div className="field"><label htmlFor={`${prefix}-department`}>Department</label><select id={`${prefix}-department`} value={departmentId} disabled={busy} onChange={(event) => { const next = event.target.value; setDepartmentId(next); setCategoryId(board.categories.find((category) => category.is_active && category.department_id === next)?.id ?? ''); setOfficerId('') }}>{board.departments.filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name} ({board.officers.filter((officer) => officer.department_id === department.id).length} Officers)</option>)}</select></div>
    <div className="field"><label htmlFor={`${prefix}-category`}>Category</label><select id={`${prefix}-category`} value={categoryId} disabled={busy} onChange={(event) => setCategoryId(event.target.value)}>{!categories.length && <option value="">No active category</option>}{categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category.name)}</option>)}</select></div>
    <div className="field"><label htmlFor={`${prefix}-officer`}>Assign Officer</label><select id={`${prefix}-officer`} value={officerId} disabled={busy} onChange={(event) => setOfficerId(event.target.value)}><option value="">{officers.length ? 'Leave unassigned' : 'No Officers in this department'}</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.display_name}</option>)}</select></div>
    <div className="field wide"><label htmlFor={`${prefix}-reason`}>Reason (shared with the citizen)</label><textarea id={`${prefix}-reason`} rows={2} maxLength={2000} value={reason} disabled={busy} placeholder="For example: Routed to Water supply, which handles drainage near mains." onChange={(event) => setReason(event.target.value)} /></div>
    <div className="wide button-row"><SubmitButton busy={busy}>Confirm dispatch</SubmitButton><button type="button" className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </motion.form>
}
