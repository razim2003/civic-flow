import { userMessage } from './message'

export function complaintMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (['42P01', 'PGRST205', 'PGRST202'].includes(code)) return 'The complaint service is not available yet. Please contact the service administrator. Your entered details have been kept.'
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  if (message.includes('category_unavailable')) return 'This service category is no longer available. Refresh the categories and choose another.'
  if (message.includes('request_reused')) return 'This request was already saved with different details. Check My Complaints before starting another submission.'
  if (message.includes('evidence_limit')) return 'A complaint can have up to five files, including pending uploads.'
  if (message.includes('reservation_expired')) return 'This upload reservation expired. Select the file again to start a new upload.'
  if (message.includes('evidence_closed')) return 'Evidence can only be added while your complaint is Submitted.'
  if (message.includes('invalid_evidence')) return 'The file could not be verified. Use a JPEG, PNG or PDF no larger than 5 MiB.'
  if (message.includes('upload_missing')) return 'Your complaint is saved, but the file has not uploaded. Retry the file upload.'
  if (message.includes('invalid_withdrawal')) return 'Explain your withdrawal reason in 10 to 2,000 characters.'
  if (message.includes('withdrawal_closed')) return 'This complaint is already resolved or withdrawn and cannot be withdrawn again. Refresh to see its current status.'
  if (message.includes('stale_version')) return 'This complaint changed while you were viewing it. Refresh, review the latest update and try again.'
  return userMessage(error)
}
