import { Archive, ArrowRight, CheckCheck, ClipboardList, Clock3, Plus, Send, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useCitizenOverview } from '../application/useComplaints'
import { complaintMessage } from '../model/message'
import type { Impact } from '../model/complaint'
import { Notice } from '../../../shared/ui/Form'
import { CountUp, Reveal, Stagger } from '../../../shared/ui/motion'
import { StatCard } from '../../../shared/ui/StatCard'
import { ComplaintCards } from './ComplaintCards'

function ImpactStrip({ impact }: { impact: Impact }) {
  return <Reveal><dl className="impact-strip" aria-label="Community impact across CivicFlow">
    <div><strong>Community impact</strong><span>Across everyone using CivicFlow</span></div>
    <div><dt>Issues reported</dt><dd><CountUp value={impact.total} /></dd></div>
    <div><dt>Resolved</dt><dd><CountUp value={impact.resolved} /></dd></div>
    <div><dt>Resolved in 30 days</dt><dd><CountUp value={impact.resolved_last_30_days} /></dd></div>
    <div><dt>Avg. days to fix</dt><dd>{impact.avg_resolution_days === null ? '—' : <CountUp value={impact.avg_resolution_days} decimals={1} />}</dd></div>
  </dl></Reveal>
}

export function CitizenOverview() {
  const { profile } = useAuth()
  const state = useCitizenOverview()
  const summary = state.data?.summary
  const loading = state.loading && !state.data
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">YOUR COMMUNITY, YOUR VOICE</span><h1>Hello, {profile?.display_name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>Report a concern and follow it all the way to resolution.</p></div><Link className="button button-primary" to="/complaints/new"><Plus size={17} aria-hidden="true" />New complaint</Link></div>
    <section className="welcome-panel citizen-welcome"><div><span className="pill"><Sparkles size={14} aria-hidden="true" /> Routed to the right team, automatically</span><h2>See something that needs fixing?</h2><p>A damaged road, an overflowing bin, a broken water line — pin it on the map, describe it, and an Officer from the responsible department is assigned straight away.</p><Link className="button button-light" to="/complaints/new">Make a complaint <ArrowRight size={16} aria-hidden="true" /></Link></div><ClipboardList className="welcome-icon" size={120} strokeWidth={1} aria-hidden="true" /></section>
    {state.error ? <Notice>{complaintMessage(state.error)} <button className="inline-button" onClick={() => void state.reload()}>Try again</button></Notice> : null}
    <Stagger className="complaint-stats">
      <StatCard label="All complaints" value={summary?.total} icon={ClipboardList} loading={loading} />
      <StatCard label="Submitted" value={summary?.submitted} icon={Send} tone="sun" loading={loading} />
      <StatCard label="Being handled" value={summary?.active} icon={Clock3} tone="review" loading={loading} />
      <StatCard label="Resolved" value={summary?.resolved} icon={CheckCheck} tone="ok" loading={loading} />
      <StatCard label="Withdrawn" value={summary?.withdrawn} icon={Archive} tone="withdrawn" loading={loading} />
    </Stagger>
    {state.data?.impact && <ImpactStrip impact={state.data.impact} />}
    <div className="section-title-row"><div><h2>Recent complaints</h2><p className="muted">Your latest reports and where they are now.</p></div><Link className="text-link" to="/complaints">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
    {loading ? <div className="complaint-cards">{[0, 1].map((index) => <div key={index} className="skeleton" style={{ height: 200 }} />)}</div> : state.data?.recent.length ? <ComplaintCards complaints={state.data.recent} categories={state.data.categories} /> : !state.error && <section className="panel complaint-empty"><span className="card-icon"><ClipboardList size={23} aria-hidden="true" /></span><h2>No complaints yet</h2><p>Your reports will appear here, with updates from the service team.</p><Link className="button button-primary" to="/complaints/new"><Plus size={16} aria-hidden="true" />Make your first complaint</Link></section>}
  </>
}
