import { ArrowRight, BriefcaseBusiness, ClipboardList, Clock3, Inbox, Map, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { ComplaintCards } from '../../complaints'
import { Notice } from '../../../shared/ui/Form'
import { Stagger } from '../../../shared/ui/motion'
import { StatCard } from '../../../shared/ui/StatCard'
import { useOfficerOverview } from '../application/useOfficer'
import { queueMessage } from '../model/officer'
import { WorkflowActivationNotice } from './WorkflowActivationNotice'

export function OfficerOverview() {
  const { profile } = useAuth()
  const state = useOfficerOverview()
  const department = state.data?.departments.find((department) => department.id === profile?.department_id)
  const loading = state.loading && !state.data
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">PUBLIC SERVICE, WITH PURPOSE</span><h1>Hello, {profile?.display_name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>{department?.name ?? 'Your department'} · Review concerns, coordinate your team and keep citizens informed.</p></div><div className="button-row"><button className="button button-secondary" disabled={state.loading} onClick={() => void state.reload()}>Refresh overview</button><Link className="button button-primary" to="/officer/assigned"><BriefcaseBusiness size={17} aria-hidden="true" />Assigned to me</Link></div></div>
    <section className="welcome-panel"><div><span className="pill"><UserCheck size={14} aria-hidden="true" />Officer workspace</span><h2>Turn community concerns into progress.</h2><p>New complaints in your department are assigned automatically to the Officer with the lightest load. Review them, keep citizens updated, and resolve within the service target.</p><div className="button-row"><Link className="button button-light" to="/officer/complaints">Open department queue <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-light" to="/officer/map"><Map size={16} aria-hidden="true" />Department map</Link></div></div><ClipboardList className="welcome-icon" size={112} strokeWidth={1} aria-hidden="true" /></section>
    {state.error ? <Notice>{queueMessage(state.error)} <button className="inline-button" onClick={() => void state.reload()}>Try again</button></Notice> : null}
    {state.data && !state.data.workflowReady && <WorkflowActivationNotice onRetry={() => void state.reload()} busy={state.loading} />}
    <Stagger className="complaint-stats officer-stats">
      <StatCard label="Open in department" value={state.data?.summary.open} icon={ClipboardList} loading={loading} />
      <StatCard label="Awaiting review" value={state.data?.summary.submitted} icon={Inbox} tone="sun" loading={loading} />
      <StatCard label="In progress" value={state.data?.summary.inProgress} icon={Clock3} tone="signal" loading={loading} />
      <StatCard label="Assigned to me" value={state.data?.summary.mine} icon={UserCheck} tone="review" loading={loading} />
    </Stagger>
    <div className="section-title-row"><div><h2>Latest open complaints</h2><p className="muted">Current reports in your department.</p></div><Link className="text-link" to="/officer/complaints?status=all">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
    {state.loading ? <p role="status" className="muted">Loading department complaints…</p> : state.data?.complaints.length ? <ComplaintCards complaints={state.data.complaints.slice(0, 4)} categories={state.data.categories} basePath="/officer/complaints" /> : !state.error && <section className="panel complaint-empty"><h2>No open complaints</h2><p>Your department’s new reports will appear here.</p><Link className="text-link" to="/officer/complaints?status=all">View closed and open complaints</Link></section>}
  </>
}
