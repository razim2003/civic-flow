import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ClipboardList, Clock3, ShieldCheck, Star, Tags, Users } from 'lucide-react'
import { statuses, statusLabels } from '../../complaints'
import { useAuth } from '../../auth'
import { userMessage } from '../../../shared/errors/message'
import { Notice } from '../../../shared/ui/Form'
import { useMonitoring } from '../application/useMonitoring'

export function AdminOverview() {
  const { profile } = useAuth()
  const state = useMonitoring()
  const summary = state.data
  const value = (number: number | null | undefined) => state.loading ? '…' : number ?? '—'
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">A BETTER COMMUNITY STARTS HERE</span><h1>Hello, {profile?.display_name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>Manage access, service categories and monitor complaint handling.</p></div><button className="button button-secondary" type="button" disabled={state.loading} onClick={() => void state.reload()}>Refresh</button></div>
    <section className="welcome-panel"><div><span className="pill"><ShieldCheck size={14} aria-hidden="true" /> You’re connected</span><h2>A stronger team. A better service.</h2><p>Invite Officers, maintain the services Citizens can report, and keep an eye on progress.</p><div className="button-row"><Link className="button button-light" to="/admin/users">Manage users<ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-light" to="/admin/categories">Service categories<ArrowRight size={16} aria-hidden="true" /></Link></div></div><Building2 className="welcome-icon" size={126} strokeWidth={1} aria-hidden="true" /></section>
    {state.error ? <Notice>{userMessage(state.error)}</Notice> : null}
    <h2 className="sr-only">Complaint monitoring</h2>
    <div className="complaint-stats">{[
      { label: 'All complaints', number: summary?.total, icon: ClipboardList },
      { label: 'Open', number: summary?.open, icon: Clock3 },
      { label: 'Feedback received', number: summary?.feedbackCount, icon: Users },
      { label: 'Average rating', number: summary?.averageRating, icon: Star },
    ].map(({ label, number, icon: Icon }) => <section className="stat-card" key={label}><span className="stat-icon"><Icon size={18} aria-hidden="true" /></span><span>{label}</span><strong>{value(number)}</strong></section>)}</div>
    <div className="overview-grid"><section className="panel"><span className="card-icon"><ClipboardList size={20} aria-hidden="true" /></span><h2>Complaints by status</h2>{statuses.map((status) => <div className="detail-row" key={status}><span>{statusLabels[status]}</span><strong>{value(summary?.byStatus[status])}</strong></div>)}</section>
      <section className="panel"><span className="card-icon"><Tags size={20} aria-hidden="true" /></span><h2>Administration</h2><p className="muted">Monitoring is read-only. Administrators do not process complaints; Officers handle them in their department queues.</p><Link className="text-link" to="/admin/users">User management <ArrowRight size={15} aria-hidden="true" /></Link><br /><Link className="text-link" to="/admin/categories">Service categories <ArrowRight size={15} aria-hidden="true" /></Link></section></div>
  </>
}
