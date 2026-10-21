import { Notice } from '../../../shared/ui/Form'

export function WorkflowActivationNotice({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  return <Notice>Complaint processing is awaiting activation. You can view department reports and attachments. Ask your project Administrator to finish setup. <button type="button" className="inline-button" disabled={busy} onClick={onRetry}>Check again</button></Notice>
}
