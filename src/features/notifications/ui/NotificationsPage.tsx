import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { displayDate, shortReference } from '../../complaints'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { Notice } from '../../../shared/ui/Form'
import { useNotifications } from '../application/useNotifications'
import { NOTIFICATION_PAGE_SIZE } from '../model/notification'

export function NotificationsPage() {
  const [page, setPage] = useState(0)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const state = useNotifications(page, unreadOnly)
  const items = state.data?.items ?? []
  const count = state.data?.count ?? 0
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">STAY INFORMED</span><h1>Updates</h1><p>Every change to your complaints is recorded here. Open a complaint to see its full history.</p></div>
    <div className="button-row"><button className="button button-secondary" type="button" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw size={15} aria-hidden="true" />Refresh</button><button className="button button-primary" type="button" disabled={state.busy || state.loading} onClick={() => void state.markAll()}><CheckCheck size={15} aria-hidden="true" />Mark all as read</button></div></div>
    {state.error ? <Notice>{complaintMessage(state.error)}</Notice> : null}{state.actionError && <Notice>{state.actionError}</Notice>}
    <section className="panel"><label className="checkbox-label"><input type="checkbox" checked={unreadOnly} onChange={(event) => { setPage(0); setUnreadOnly(event.target.checked) }} />Show unread only</label>
      {state.loading && !state.data ? <p role="status" className="empty-state">Loading updates…</p> : items.length ? <ul className="notification-list">{items.map((item) => <li key={item.id} className={item.read_at ? '' : 'notification-unread'}>
        <span className="card-icon"><Bell size={17} aria-hidden="true" /></span>
        <div><strong>{item.title}</strong>{!item.read_at && <span className="badge">New</span>}<p className="muted">{shortReference(item.complaint_id)} · <time dateTime={item.created_at}>{displayDate(item.created_at)}</time></p>{item.detail && <p className="notification-detail">{item.detail}</p>}</div>
        <div className="button-row"><Link className="text-link" to={`/complaints/${item.complaint_id}`} onClick={() => { if (!item.read_at) void state.markOne(item.id) }}>View complaint</Link>{!item.read_at && <button className="button button-secondary" type="button" disabled={state.busy} onClick={() => void state.markOne(item.id)} aria-label={`Mark ${item.title} for ${shortReference(item.complaint_id)} as read`}>Mark as read</button>}</div>
      </li>)}</ul> : !state.error && <div className="empty-state"><Bell size={28} className="mx-auto mb-3" aria-hidden="true" />{unreadOnly ? 'You have no unread updates.' : 'Updates about your complaints will appear here.'}</div>}
      <div className="pagination"><span>{count} {count === 1 ? 'update' : 'updates'}</span><div className="button-row"><button className="button button-secondary" disabled={!page || state.loading} onClick={() => setPage(page - 1)}>Previous</button><button className="button button-secondary" disabled={(page + 1) * NOTIFICATION_PAGE_SIZE >= count || state.loading} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </section></>
}
