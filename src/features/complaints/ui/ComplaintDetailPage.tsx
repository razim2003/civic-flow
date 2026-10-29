import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { Complaint } from '../model/complaint'
import { ArrowLeft, CalendarDays, Check, MapPin, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../../auth'
import { EvidencePanel } from '../../evidence'
import { FeedbackPanel } from '../../feedback'
import { Notice } from '../../../shared/ui/Form'
import { useComplaintDetail } from '../application/useComplaints'
import { complaintMessage } from '../model/message'
import { displayDate, eventLabels, shortReference, progressStatuses, statusLabels, canWithdraw } from '../model/complaint'
import { StatusBadge } from './ComplaintCards'
import { categoryLabel } from '../model/categories'
import { WithdrawalPanel } from './WithdrawalPanel'

const LocationMap = lazy(() => import('../../../shared/location/LocationMap'))
type DetailOptions = { backTo?: string; backLabel?: string; renderActions?: (complaint: Complaint, onChanged: () => Promise<void>, refreshing: boolean) => ReactNode }
function Detail({ id, backTo = '/complaints', backLabel = 'My complaints', renderActions }: { id: string } & DetailOptions) {
  const { profile } = useAuth()
  const state = useComplaintDetail(id)
  if (state.loading && !state.data) return <p role="status">Loading complaint…</p>
  if (state.error) return <><Notice>{complaintMessage(state.error)}</Notice><button className="button button-secondary" onClick={() => void state.reload()}>Try again</button></>
  if (!state.data) return <section className="panel"><h1>Complaint unavailable</h1><p>This complaint does not exist or is not available to your account.</p><Link className="text-link" to={backTo}>Back to {backLabel}</Link></section>
  const { complaint, events, categories, departments } = state.data
  const stage = complaint.status === 'withdrawn' ? -1 : progressStatuses.indexOf(complaint.status)
  return <><Link className="back-link page-back" to={backTo}><ArrowLeft size={15} aria-hidden="true" />{backLabel}</Link><div className="page-heading heading-with-action"><div><span className="eyebrow">{shortReference(complaint.id)}</span><h1>{categoryLabel(categories.find((category) => category.id === complaint.category_id)?.name ?? 'Public service complaint')}</h1><p className="detail-date"><CalendarDays size={14} aria-hidden="true" />Submitted {displayDate(complaint.created_at)}<span>·</span>{departments.find((department) => department.id === complaint.department_id)?.name ?? 'Public service team'}</p></div><button className="button button-secondary" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
    <section className="panel status-panel"><div className="section-title-row"><h2>Complaint progress</h2><StatusBadge status={complaint.status} /></div>{complaint.status === 'withdrawn' ? <p className="muted">This complaint was withdrawn by its owner. Further processing has stopped.</p> : <ol className="progress-steps">{progressStatuses.map((status, index) => <li key={status} className={index <= stage ? 'step-reached' : ''} aria-current={status === complaint.status ? 'step' : undefined}><span>{index < stage ? <Check size={14} aria-hidden="true" /> : index + 1}</span><strong>{statusLabels[status]}</strong></li>)}</ol>}</section>
    <div className="complaint-detail-grid"><div><section className="panel"><h2>{profile?.id === complaint.citizen_id ? 'Your complaint' : 'Complaint details'}</h2><p className="complaint-description">{complaint.description}</p><p className="full-reference">Full reference: {complaint.id}</p></section>
      <section className="panel"><div className="section-heading"><MapPin size={20} aria-hidden="true" /><div><h2>Reported location</h2><p className="muted">{complaint.location_text}</p></div></div><Suspense fallback={<p className="muted">Loading location map…</p>}><LocationMap point={[complaint.latitude, complaint.longitude]} /></Suspense><p className="field-hint">{complaint.latitude.toFixed(6)}, {complaint.longitude.toFixed(6)}</p></section>
      {complaint.status === 'withdrawn' && <section className="panel withdrawn-details"><h2>Withdrawal details</h2><p className="complaint-description">{complaint.withdrawal_reason}</p>{complaint.withdrawn_at && <p className="muted">Withdrawn on {displayDate(complaint.withdrawn_at)}</p>}<p className="muted">The complaint and supporting evidence are retained in your history.</p></section>}
      {profile?.role === 'citizen' && profile.id === complaint.citizen_id && canWithdraw(complaint.status) && <WithdrawalPanel key={`withdrawal-${complaint.id}`} id={complaint.id} version={complaint.version} refreshing={state.loading} onWithdrawn={state.reload} />}
      {complaint.status === 'resolved' && <section className="panel resolution-panel"><h2>Resolution</h2><p className="complaint-description">{complaint.resolution_text}</p>{complaint.resolved_at && <p className="muted">Resolved on {displayDate(complaint.resolved_at)}</p>}</section>}
      {complaint.status === 'resolved' && <FeedbackPanel key={`feedback-${complaint.id}`} complaintId={complaint.id} canSubmit={profile?.role === 'citizen' && profile.id === complaint.citizen_id} />}
      {renderActions?.(complaint, state.reload, state.loading)}
      <EvidencePanel key={`evidence-${id}`} complaintId={id} canUpload={profile?.role === 'citizen' && profile.id === complaint.citizen_id && complaint.status === 'submitted'} onUploaded={() => void state.reload()} />
    </div><section className="panel timeline-panel"><h2>Complaint history</h2><p className="muted">Recorded updates from your complaint’s journey.</p><ol className="complaint-timeline">{events.map((event) => <li key={event.id}><span className="timeline-dot" /><div><strong>{eventLabels[event.event_type] ?? 'Complaint updated'}</strong><time dateTime={event.created_at}>{displayDate(event.created_at)}</time>{event.remark && <p>{event.remark}</p>}</div></li>)}</ol>{!events.length && <p className="muted">No updates have been recorded yet.</p>}</section></div>
  </>
}
export function ComplaintDetailPage(options: DetailOptions = {}) {
  const { id } = useParams()
  return id && z.uuid().safeParse(id).success ? <Detail id={id} {...options} /> : <Notice>This complaint reference is invalid. <Link to={options.backTo ?? '/complaints'}>View {options.backLabel ?? 'My complaints'}</Link></Notice>
}
