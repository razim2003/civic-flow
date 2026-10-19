import { useState } from 'react'
import { ClipboardList, Plus, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useComplaintList } from '../application/useComplaints'
import { PAGE_SIZE, statuses, statusLabels } from '../model/complaint'
import { complaintMessage } from '../model/message'
import { Field, Notice } from '../../../shared/ui/Form'
import { ComplaintCards } from './ComplaintCards'

export function MyComplaintsPage() {
  const { profile } = useAuth()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const state = useComplaintList(page, search, status)
  if (profile?.role !== 'citizen') return <Notice>Citizen access is required for this page.</Notice>
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">STAY IN THE LOOP</span><h1>My complaints</h1><p>View the concerns you have reported and follow their progress.</p></div><Link className="button button-primary" to="/complaints/new"><Plus size={16} aria-hidden="true" />New complaint</Link></div>
    <section className="panel complaint-filters"><form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); setPage(0); setSearch(String(values.get('search') ?? '')) }}><Field label="Search complaints" type="search" name="search" placeholder="Description or full complaint ID" maxLength={200} /><button type="submit" className="button button-secondary">Search</button></form><div><label htmlFor="status-filter">Status</label><select id="status-filter" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value) }}><option value="">All statuses</option>{statuses.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></div><button className="button button-secondary" type="button" onClick={() => void state.reload()} disabled={state.loading}><RefreshCw size={15} aria-hidden="true" />Refresh</button></section>
    {state.error ? <Notice>{complaintMessage(state.error)}</Notice> : null}
    {state.loading ? <p role="status" className="empty-state">Loading your complaints…</p> : state.data?.complaints.length ? <ComplaintCards complaints={state.data.complaints} categories={state.data.categories} /> : !state.error && <section className="panel complaint-empty"><span className="card-icon"><ClipboardList size={24} aria-hidden="true" /></span><h2>{search || status ? 'No matching complaints' : 'No complaints yet'}</h2><p>{search || status ? 'Try another search or status filter.' : 'Tell us about a public service issue in your community.'}</p><Link className="text-link" to="/complaints/new">Make a complaint</Link></section>}
    {state.data && <div className="pagination"><span aria-live="polite">{state.data.count} {state.data.count === 1 ? 'complaint' : 'complaints'} · Page {page + 1}</span><div className="button-row"><button className="button button-secondary" disabled={!page || state.loading} onClick={() => setPage(page - 1)}>Previous</button><button className="button button-secondary" disabled={state.loading || (page + 1) * PAGE_SIZE >= state.data.count} onClick={() => setPage(page + 1)}>Next</button></div></div>}
  </>
}
