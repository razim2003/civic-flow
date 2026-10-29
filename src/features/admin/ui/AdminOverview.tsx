import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Building2, ClipboardList, Clock3, Send, ShieldCheck, Star, Tags, Users } from 'lucide-react'
import { statuses, statusLabels } from '../../complaints'
import { useAuth } from '../../auth'
import { userMessage } from '../../../shared/errors/message'
import { Notice } from '../../../shared/ui/Form'
import { CountUp, Stagger } from '../../../shared/ui/motion'
import { StatCard } from '../../../shared/ui/StatCard'
import { useMonitoring } from '../application/useMonitoring'

export function AdminOverview() {
  const { profile } = useAuth()
  const state = useMonitoring()
  const summary = state.data
  const loading = state.loading && !summary
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">A BETTER COMMUNITY STARTS HERE</span><h1>Hello, {profile?.display_name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>Keep every complaint moving: staff departments, route stuck work and watch service performance.</p></div><button className="button button-secondary" type="button" disabled={state.loading} onClick={() => void state.reload()}>Refresh</button></div>
    <section className="welcome-panel"><div><span className="pill"><ShieldCheck size={14} aria-hidden="true" /> Administrator</span><h2>No complaint left without an owner.</h2><p>The Dispatch centre shows complaints sitting in departments with no Officers, unassigned work and anything past its service target.</p><div className="button-row"><Link className="button button-light" to="/admin/dispatch"><Send size={16} aria-hidden="true" />Dispatch centre</Link><Link className="button button-light" to="/admin/analytics"><BarChart3 size={16} aria-hidden="true" />Analytics</Link></div></div><Building2 className="welcome-icon" size={126} strokeWidth={1} aria-hidden="true" /></section>
    {state.error ? <Notice>{userMessage(state.error)}</Notice> : null}
    <h2 className="sr-only">Complaint monitoring</h2>
    <Stagger className="complaint-stats officer-stats">
      <StatCard label="All complaints" value={summary?.total} icon={ClipboardList} loading={loading} />
      <StatCard label="Open" value={summary?.open} icon={Clock3} tone="signal" loading={loading} />
      <StatCard label="Feedback received" value={summary?.feedbackCount} icon={Users} tone="review" loading={loading} />
      <StatCard label="Average rating" value={summary?.averageRating ?? undefined} decimals={1} icon={Star} tone="sun" loading={loading} />
    </Stagger>
    <div className="overview-grid"><section className="panel"><span className="card-icon"><ClipboardList size={20} aria-hidden="true" /></span><h2>Complaints by status</h2>{statuses.map((status) => <div className="detail-row" key={status}><span>{statusLabels[status]}</span><strong>{loading ? '…' : <CountUp value={summary?.byStatus[status] ?? 0} />}</strong></div>)}</section>
      <section className="panel"><span className="card-icon"><Tags size={20} aria-hidden="true" /></span><h2>Administration</h2><p className="muted">Administrators route and staff work; Officers process complaints in their department queues. Monitoring here is read-only.</p>
        {[['/admin/dispatch', 'Dispatch centre'], ['/admin/analytics', 'Service analytics'], ['/admin/users', 'User management'], ['/admin/categories', 'Service categories']].map(([to, label]) => <div key={to}><Link className="text-link" to={to}>{label} <ArrowRight size={15} aria-hidden="true" /></Link></div>)}
      </section></div>
  </>
}
