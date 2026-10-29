import { ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { riseItem, Stagger } from '../../../shared/ui/motion'
import { SlaBadge } from '../../../shared/ui/SlaBadge'
import { displayDate, shortReference, statusLabels } from '../model/complaint'
import type { Category, Complaint } from '../model/complaint'
import { categoryLabel } from '../model/categories'

const MotionLink = motion.create(Link)

export function StatusBadge({ status }: { status: Complaint['status'] }) {
  return <span className={`complaint-status status-${status}`}><span />{statusLabels[status]}</span>
}

/** Complaints rendered as service tickets; the perforation separates the report from its journey. */
export function ComplaintCards({ complaints, categories, basePath = '/complaints', extra, returnTo }: { complaints: Complaint[]; categories: Category[]; basePath?: string; extra?: (complaint: Complaint) => ReactNode; returnTo?: string }) {
  return <Stagger className="complaint-cards">{complaints.map((complaint) => <MotionLink variants={riseItem} to={`${basePath}/${complaint.id}`} state={returnTo ? { returnTo } : undefined} className="complaint-card" key={complaint.id}>
    <div className="complaint-card-top"><span className="complaint-reference">{shortReference(complaint.id)}</span><StatusBadge status={complaint.status} /></div>
    <h3>{categoryLabel(categories.find((category) => category.id === complaint.category_id)?.name ?? 'Public service concern')}</h3><p className="complaint-excerpt">{complaint.description}</p>
    <div className="complaint-location"><MapPin size={14} aria-hidden="true" /><span>{complaint.location_text}</span></div>
    {extra?.(complaint)}
    <div className="complaint-card-bottom"><span>{displayDate(complaint.created_at)}</span><SlaBadge createdAt={complaint.created_at} priority={complaint.priority} status={complaint.status} /><span>View <ArrowUpRight size={15} aria-hidden="true" /></span></div>
  </MotionLink>)}</Stagger>
}
