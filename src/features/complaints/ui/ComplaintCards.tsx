import { ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { displayDate, shortReference, statusLabels } from '../model/complaint'
import type { Category, Complaint } from '../model/complaint'
import { categoryLabel } from '../model/categories'

export function StatusBadge({ status }: { status: Complaint['status'] }) {
  return <span className={`complaint-status status-${status}`}><span />{statusLabels[status]}</span>
}
export function ComplaintCards({ complaints, categories, basePath = '/complaints', extra, returnTo }: { complaints: Complaint[]; categories: Category[]; basePath?: string; extra?: (complaint: Complaint) => ReactNode; returnTo?: string }) {
  return <div className="complaint-cards">{complaints.map((complaint) => <Link to={`${basePath}/${complaint.id}`} state={returnTo ? { returnTo } : undefined} className="complaint-card" key={complaint.id}>
    <div className="complaint-card-top"><span className="complaint-reference">{shortReference(complaint.id)}</span><StatusBadge status={complaint.status} /></div>
    <h3>{categoryLabel(categories.find((category) => category.id === complaint.category_id)?.name ?? 'Public service concern')}</h3><p className="complaint-excerpt">{complaint.description}</p>
    <div className="complaint-location"><MapPin size={14} aria-hidden="true" /><span>{complaint.location_text}</span></div>
    {extra?.(complaint)}
    <div className="complaint-card-bottom"><span>{displayDate(complaint.created_at)}</span><span>View complaint <ArrowUpRight size={15} aria-hidden="true" /></span></div>
  </Link>)}</div>
}
