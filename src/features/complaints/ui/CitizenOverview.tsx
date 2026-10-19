import { ArrowRight, CheckCheck, ClipboardList, Clock3, Plus, Send, ShieldCheck, Archive } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useCitizenOverview } from '../application/useComplaints'
import { complaintMessage } from '../model/message'
import { Notice } from '../../../shared/ui/Form'
import { ComplaintCards } from './ComplaintCards'

export function CitizenOverview() {
  const { profile } = useAuth()
  const state = useCitizenOverview()
  const summary = state.data?.summary
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">YOUR COMMUNITY, YOUR VOICE</span><h1>Hello, {profile?.display_name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>Report a concern and follow the progress of your public service complaints.</p></div><Link className="button button-primary" to="/complaints/new"><Plus size={17} aria-hidden="true" />New complaint</Link></div>
    <section className="welcome-panel citizen-welcome"><div><span className="pill"><ShieldCheck size={14} aria-hidden="true" /> A better community starts with you</span><h2>See something that needs attention?</h2><p>From a damaged road to an overflowing bin, let the right service team know. Add a location, share the details, and follow your complaint in one place.</p><Link className="button button-light" to="/complaints/new">Make a complaint <ArrowRight size={16} aria-hidden="true" /></Link></div><ClipboardList className="welcome-icon" size={120} strokeWidth={1} aria-hidden="true" /></section>
    {state.error ? <Notice>{complaintMessage(state.error)} <button className="inline-button" onClick={() => void state.reload()}>Try again</button></Notice> : null}
    <div className="complaint-stats">{[
      { label: 'All complaints', value: summary?.total, icon: ClipboardList },
      { label: 'Submitted', value: summary?.submitted, icon: Send },
      { label: 'Being handled', value: summary?.active, icon: Clock3 },
      { label: 'Resolved', value: summary?.resolved, icon: CheckCheck },
      { label: 'Withdrawn', value: summary?.withdrawn, icon: Archive },
    ].map(({ label, value, icon: Icon }) => <section className="stat-card" key={label}><span className="stat-icon"><Icon size={18} aria-hidden="true" /></span><span>{label}</span><strong>{state.loading ? '…' : value ?? '—'}</strong></section>)}</div>
    <div className="section-title-row"><div><h2>Recent complaints</h2><p className="muted">Your latest reports and their current status.</p></div><Link className="text-link" to="/complaints">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
    {state.loading && !state.data ? <p role="status" className="muted">Loading your complaints…</p> : state.data?.recent.length ? <ComplaintCards complaints={state.data.recent} categories={state.data.categories} /> : !state.error && <section className="panel complaint-empty"><span className="card-icon"><ClipboardList size={23} aria-hidden="true" /></span><h2>No complaints yet</h2><p>Your reports will appear here, with updates from the service team.</p><Link className="button button-primary" to="/complaints/new"><Plus size={16} aria-hidden="true" />Make your first complaint</Link></section>}
  </>
}
