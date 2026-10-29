import { lazy, Suspense, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { categoryLabel, shortReference } from '../../complaints'
import { useAuth } from '../../auth'
import { Notice } from '../../../shared/ui/Form'
import type { MapPoint } from '../../../shared/location/ComplaintsMap'
import { slaState } from '../../../shared/sla'
import { useOfficerMap } from '../application/useOfficer'
import { priorities, queueMessage } from '../model/officer'

const ComplaintsMap = lazy(() => import('../../../shared/location/ComplaintsMap'))
const priorityColor: Record<string, string> = { urgent: '#df5a2b', high: '#e8a92f', normal: '#2c5786', low: '#7d8a83' }

export function OfficerMapPage() {
  const { profile } = useAuth()
  const state = useOfficerMap()
  const [mineOnly, setMineOnly] = useState(false)
  const points = useMemo<MapPoint[]>(() => (state.data?.complaints ?? [])
    .filter((complaint) => !mineOnly || complaint.assigned_officer_id === profile?.id)
    .map((complaint) => {
      const sla = slaState(complaint.created_at, complaint.priority, complaint.status)
      return {
        id: complaint.id, latitude: complaint.latitude, longitude: complaint.longitude,
        title: `${shortReference(complaint.id)} · ${categoryLabel(state.data?.categories.find((category) => category.id === complaint.category_id)?.name ?? 'Complaint')}`,
        subtitle: `${complaint.location_text} · ${complaint.priority} priority${sla.kind === 'overdue' ? ' · past target' : ''}`,
        color: priorityColor[complaint.priority], href: `/officer/complaints/${complaint.id}`,
      }
    }), [state.data, mineOnly, profile?.id])
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">FIELD VIEW</span><h1>Department map</h1><p>Open complaints in your department, coloured by priority. Plan site visits and spot clusters of related problems.</p></div>
    <button className="button button-secondary" type="button" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
    {state.error ? <Notice>{queueMessage(state.error)}</Notice> : null}
    <div className="filter-chips" role="group" aria-label="Map filter"><button type="button" className="chip" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>All open<span className="chip-count">{state.data?.complaints.length ?? 0}</span></button><button type="button" className="chip" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>Assigned to me<span className="chip-count">{state.data?.complaints.filter((complaint) => complaint.assigned_officer_id === profile?.id).length ?? 0}</span></button></div>
    {state.loading && !state.data ? <div className="skeleton map-board" /> : <Suspense fallback={<div className="skeleton map-board" />}><ComplaintsMap points={points} /></Suspense>}
    <div className="map-legend">{priorities.map((priority) => <span key={priority}><i style={{ background: priorityColor[priority] }} />{priority[0].toUpperCase() + priority.slice(1)}</span>)}</div>
    {!!state.data && !points.length && <p className="muted">No open complaints to show.</p>}
    {!!state.data && state.data.total > state.data.complaints.length && <p className="muted">Showing the {state.data.complaints.length} newest of {state.data.total} open complaints.</p>}
  </>
}
