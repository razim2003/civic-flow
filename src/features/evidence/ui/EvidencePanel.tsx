import { Download, FileText, Paperclip, Upload } from 'lucide-react'
import { Notice } from '../../../shared/ui/Form'
import { useEvidence } from '../application/useEvidence'
import { fileSize } from '../model/evidence'
import { complaintMessage } from '../../../shared/errors/complaintMessage'

export function EvidencePanel({ complaintId, canUpload = false, onUploaded }: { complaintId: string; canUpload?: boolean; onUploaded?: () => void }) {
  const state = useEvidence(complaintId, onUploaded)
  return <section className="panel evidence-panel"><div className="section-heading"><span className="card-icon"><Paperclip size={19} aria-hidden="true" /></span><div><h2>Supporting evidence</h2><p className="muted">Files are private and available only to people authorized to view this complaint.</p></div></div>
    {state.error && <Notice>{state.error}</Notice>}{state.resource.error ? <Notice>{complaintMessage(state.resource.error)}</Notice> : null}
    {state.resource.loading ? <p role="status" className="muted">Loading attachments…</p> : !state.resource.data?.length && <p className="muted">No supporting files attached.</p>}
    <ul className="attachment-list">{state.resource.data?.map((file) => <li key={file.id}><FileText size={18} aria-hidden="true" /><div><strong>{file.original_filename}</strong><span>{fileSize(file.declared_size_bytes)}</span></div><button type="button" className="button button-secondary" disabled={!!state.downloading} aria-label={`Download ${file.original_filename}`} onClick={() => void state.download(file)}><Download size={15} aria-hidden="true" />Download</button></li>)}</ul>
    {canUpload && <><label className="upload-zone"><Upload size={23} aria-hidden="true" /><strong>Choose supporting files</strong><span>JPEG, PNG or PDF · Up to 5 MiB each · Maximum 5 files</span><input type="file" multiple accept="image/jpeg,image/png,application/pdf" aria-label="Supporting files" disabled={state.selecting || state.resource.loading} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void state.add(files) }} /></label><p className="field-hint">Add evidence while your complaint is Submitted. Avoid including unnecessary personal information.</p></>}
    <ul className="attachment-list">{state.items.filter((item) => item.state !== 'done').map((item) => <li key={item.key}><FileText size={18} aria-hidden="true" /><div><strong>{item.file.name}</strong><span>{fileSize(item.file.size)} · {item.state === 'uploading' ? 'Uploading…' : item.state === 'error' ? 'Upload failed. Your complaint is saved.' : 'Ready to upload'}</span>{item.error && <p className="field-error" role="alert">{item.error}</p>}</div><button className="button button-secondary" disabled={item.state === 'uploading' || !canUpload} type="button" onClick={() => void state.upload(item)}>{item.state === 'error' ? 'Retry upload' : 'Upload file'}</button><button type="button" className="inline-button" disabled={item.state === 'uploading'} aria-label={`Remove ${item.file.name} from upload queue`} onClick={() => state.remove(item.key)}>Remove</button></li>)}</ul>
  </section>
}
