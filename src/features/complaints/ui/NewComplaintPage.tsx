import { lazy, Suspense, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleCheck, FileText, MapPin, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { EvidencePanel } from '../../evidence'
import { parseCoordinate, validPoint } from '../../../shared/location/coordinates'
import { Field, Notice, SubmitButton } from '../../../shared/ui/Form'
import { useSubmission } from '../application/useSubmission'
import { complaintMessage } from '../model/message'
import { shortReference } from '../model/complaint'
import { availableCategories, categoryLabel } from '../model/categories'

const LocationMap = lazy(() => import('../../../shared/location/LocationMap'))

export function NewComplaintPage() {
  const { profile } = useAuth()
  const form = useSubmission()
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [locationText, setLocationText] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  if (profile?.role !== 'citizen') return <Notice>Only Citizens can submit complaints.</Notice>
  if (form.savedId) return <><div className="page-heading"><span className="eyebrow">YOUR VOICE HAS BEEN HEARD</span><h1>Complaint submitted</h1><p>Your complaint has been saved. You can now add optional supporting files.</p></div><section className="panel submission-success"><CircleCheck size={38} aria-hidden="true" /><h2>{shortReference(form.savedId)}</h2><span className="complaint-status status-submitted">Submitted</span><p>The service team can now review your report. Follow its status in My Complaints.</p><p className="full-reference">Full reference: {form.savedId}</p><Link className="button button-primary" to={`/complaints/${form.savedId}`}>View complaint <ArrowRight size={16} aria-hidden="true" /></Link></section><EvidencePanel complaintId={form.savedId} canUpload /><Link to="/complaints" className="back-link"><ArrowLeft size={15} aria-hidden="true" />Back to My Complaints</Link></>
  const categories = availableCategories(form.lookups.data?.categories ?? [], form.lookups.data?.departments ?? [])
  const noCategories = !form.lookups.loading && !form.lookups.error && !categories.length
  return <><Link className="back-link page-back" to="/complaints"><ArrowLeft size={15} aria-hidden="true" />My complaints</Link><div className="page-heading"><span className="eyebrow">MAKE YOUR VOICE COUNT</span><h1>Make a complaint</h1><p>Tell us what happened and where. We’ll send your report to the relevant service team.</p></div>
    <div className="complaint-form-layout"><form noValidate className="complaint-form" onSubmit={(event) => { event.preventDefault(); void form.submit({ categoryId, description, locationText, latitude: parseCoordinate(latitude), longitude: parseCoordinate(longitude) }) }}>
      {form.error && <Notice>{form.error}</Notice>}{form.lookups.error ? <Notice>{complaintMessage(form.lookups.error)} <button type="button" className="inline-button" onClick={() => void form.lookups.reload()}>Retry categories</button></Notice> : null}
      {noCategories && <Notice>Service categories have not been configured yet. The service administrator needs to complete setup before you can submit a complaint.</Notice>}
      <fieldset disabled={form.busy}><section className="panel"><div className="section-heading"><span className="card-icon"><FileText size={19} aria-hidden="true" /></span><div><h2>About the issue</h2><p className="muted">Give the team enough detail to understand the problem.</p></div></div>
        <div className="field"><label htmlFor="categoryId">Service category <span aria-hidden="true">*</span></label><select id="categoryId" name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={form.lookups.loading} aria-invalid={!!form.errors.categoryId} aria-describedby={form.errors.categoryId ? 'category-error' : undefined}><option value="">{form.lookups.loading ? 'Loading categories…' : 'Select a service category'}</option>{categories.map((category) => <option value={category.id} key={category.id}>{categoryLabel(category.name)}</option>)}</select>{form.errors.categoryId && <p className="field-error" id="category-error">{form.errors.categoryId}</p>}</div>
        <div className="field"><label htmlFor="description">Describe the issue <span aria-hidden="true">*</span></label><textarea id="description" name="description" rows={6} value={description} maxLength={5000} placeholder="What happened? When did you notice it? How is it affecting the area?" onChange={(event) => setDescription(event.target.value)} aria-invalid={!!form.errors.description} aria-describedby={form.errors.description ? 'description-error' : 'description-hint'} />{form.errors.description && <p className="field-error" id="description-error">{form.errors.description}</p>}<p className="field-hint" id="description-hint">10–5,000 characters · {description.length.toLocaleString()} / 5,000</p></div>
      </section>
      <section className="panel"><div className="section-heading"><span className="card-icon"><MapPin size={19} aria-hidden="true" /></span><div><h2>Where is the issue?</h2><p className="muted">Click the map or enter coordinates. You can drag the pin to adjust it.</p></div></div><Field label="Location description *" name="locationText" placeholder="Street, nearest landmark, area or town" maxLength={300} value={locationText} onChange={(event) => setLocationText(event.target.value)} error={form.errors.locationText} />
        <Suspense fallback={<div className="map-loading" role="status">Loading map… You can also enter coordinates below.</div>}><LocationMap point={validPoint(latitude, longitude)} onChange={form.busy ? undefined : ([lat, lng]) => { setLatitude(lat.toFixed(6)); setLongitude(lng.toFixed(6)) }} /></Suspense>
        <div className="coordinate-fields"><Field label="Latitude *" name="latitude" type="number" step="any" min={-90} max={90} placeholder="e.g. 6.927079" value={latitude} onChange={(event) => setLatitude(event.target.value)} error={form.errors.latitude} /><Field label="Longitude *" name="longitude" type="number" step="any" min={-180} max={180} placeholder="e.g. 79.861244" value={longitude} onChange={(event) => setLongitude(event.target.value)} error={form.errors.longitude} /></div>
      </section><div className="submission-footer"><span><ShieldCheck size={15} aria-hidden="true" />Your complaint is private.</span><SubmitButton busy={form.busy} disabled={form.lookups.loading || !!form.lookups.error || noCategories}>Submit complaint <ArrowRight size={16} aria-hidden="true" /></SubmitButton></div></fieldset>
    </form><aside className="complaint-guidance"><section className="panel"><h2>A few helpful tips</h2><ul><li>Choose the category that best matches the issue.</li><li>Include a clear description and a recognizable location.</li><li>After submitting, you can attach up to five photos or PDFs.</li><li>Avoid sharing unnecessary personal information.</li></ul><div className="guidance-note"><ShieldCheck size={17} aria-hidden="true" /><p>This service handles public service complaints. It is not an emergency response channel.</p></div></section></aside></div>
  </>
}
