import { RefreshCw } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ComplaintCards, statuses, statusLabels } from '../../complaints'
import { useAuth } from '../../auth'
import { Field, Notice } from '../../../shared/ui/Form'
import { useOfficerQueue } from '../application/useOfficer'
import { priorities, queueMessage, readQueueFilters } from '../model/officer'
import { WorkflowActivationNotice } from './WorkflowActivationNotice'

export function OfficerQueue({ mine = false }: { mine?: boolean }) {
  const { profile } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = readQueueFilters(params, mine)
  const { page, search, status, categoryId, priority, assignment } = filters
  const state = useOfficerQueue(filters)
  const notice: unknown = location.state?.notice
  function update(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (key !== 'page') next.delete('page')
      if (!value || (key === 'page' && value === '0')) next.delete(key)
      else next.set(key, value)
      return next
    })
  }
  return <><div className="page-heading"><span className="eyebrow">{mine ? 'YOUR WORK, IN ONE PLACE' : 'DEPARTMENT WORKSPACE'}</span><h1>{mine ? 'Assigned to me' : 'Department complaints'}</h1><p>{mine ? 'Complaints assigned to you in your current department.' : 'Review and coordinate public service concerns in your department.'}</p></div>
    {typeof notice === 'string' && <Notice success>{notice}</Notice>}
    {state.data && !state.data.workflowReady && <WorkflowActivationNotice onRetry={() => void state.reload()} busy={state.loading} />}
    <section className="panel officer-filters"><form onSubmit={(event) => { event.preventDefault(); update('search', String(new FormData(event.currentTarget).get('search') ?? '').trim()) }} onReset={() => setParams({})}><Field key={params.toString()} defaultValue={search} label="Search complaints" name="search" type="search" maxLength={200} placeholder="Description or full complaint ID" /><button className="button button-secondary" type="submit" disabled={state.loading}>Search</button><button className="button button-secondary" type="reset" disabled={state.loading}>Clear filters</button></form>
      <div className="officer-filter-grid"><div className="field"><label htmlFor="queue-status">Status</label><select id="queue-status" value={status} disabled={state.loading} onChange={(event) => update('status', event.target.value)}><option value="open">Open complaints</option><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></div>
        <div className="field"><label htmlFor="queue-category">Category</label><select id="queue-category" value={categoryId} disabled={state.loading} onChange={(event) => update('category', event.target.value)}><option value="">All categories</option>{state.data?.categories.filter((category) => category.department_id === profile?.department_id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
        <div className="field"><label htmlFor="queue-priority">Priority</label><select id="queue-priority" value={priority} disabled={state.loading} onChange={(event) => update('priority', event.target.value)}><option value="">All priorities</option>{priorities.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>
        {!mine && <div className="field"><label htmlFor="queue-assignment">Assignment</label><select id="queue-assignment" value={assignment} disabled={state.loading} onChange={(event) => update('assignment', event.target.value)}><option value="all">All Officers</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select></div>}
        <button className="button button-secondary" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
    </section>
    {state.error ? <Notice>{queueMessage(state.error)}</Notice> : null}
    {state.loading ? <p role="status" className="muted">Loading complaints…</p> : state.data?.complaints.length ? <ComplaintCards complaints={state.data.complaints} categories={state.data.categories} basePath="/officer/complaints" returnTo={location.pathname + location.search} extra={(complaint) => <p className="officer-card-meta"><span className={`priority-label priority-${complaint.priority}`}>{complaint.priority} priority</span><span>{state.data?.officers.find((officer) => officer.id === complaint.assigned_officer_id)?.display_name ?? (complaint.assigned_officer_id ? 'Officer unavailable' : 'Unassigned')}</span></p>} /> : !state.error && <section className="panel complaint-empty"><h2>No matching complaints</h2><p>{page > 0 ? 'There are no reports on this page. Return to the first page or adjust your filters.' : 'No reports match this department and filter combination. Try All statuses to include closed reports.'}</p>{page > 0 && <button className="button button-secondary" onClick={() => update('page', '0')}>Return to first page</button>}</section>}
    {state.data && <div className="pagination"><span>{state.data.count} complaints · Page {page + 1}</span><div className="button-row"><button className="button button-secondary" disabled={page === 0 || state.loading} onClick={() => update('page', String(page - 1))}>Previous</button><button className="button button-secondary" disabled={state.loading || (page + 1) * 10 >= state.data.count} onClick={() => update('page', String(page + 1))}>Next</button></div></div>}
  </>
}
