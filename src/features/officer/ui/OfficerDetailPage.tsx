import { ComplaintDetailPage } from '../../complaints'
import { OfficerActions } from './OfficerActions'
import { useLocation } from 'react-router-dom'
import { queueReturnPath } from '../model/officer'

export function OfficerDetailPage() {
  const location = useLocation()
  const backTo = queueReturnPath(location.state)
  return <ComplaintDetailPage backTo={backTo} backLabel={backTo.startsWith('/officer/assigned') ? 'Assigned to me' : 'Department complaints'} renderActions={(complaint, onChanged, refreshing) => <OfficerActions key={`actions-${complaint.id}`} complaint={complaint} onChanged={onChanged} refreshing={refreshing} />} />
}
