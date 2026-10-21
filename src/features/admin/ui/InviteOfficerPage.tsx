import { ArrowLeft, MailPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Field, Notice, SubmitButton } from '../../../shared/ui/Form'
import { useInvitation } from '../application/useInvitation'

export function InviteOfficerPage() {
  const form = useInvitation()
  return <><Link to="/admin/users" className="back-link page-back"><ArrowLeft size={15} aria-hidden="true" />User management</Link><div className="page-heading"><span className="eyebrow">ADMINISTRATOR · TEAM ACCESS</span><h1>Create Officer account</h1><p>Invite an Officer and assign their department. They will set their own password.</p></div>
    <section className="panel profile-panel"><span className="card-icon"><MailPlus size={21} aria-hidden="true" /></span><h2>Officer invitation</h2><p className="muted">Public registration creates Citizens only. Officer access is managed here by an Administrator.</p>
      {form.error && <Notice>{form.error}</Notice>}{form.success && <Notice success>{form.success}</Notice>}
      {form.departments.error ? <Notice>Departments could not load. <button type="button" className="inline-button" onClick={() => void form.departments.reload()}>Try again</button></Notice> : null}
      {!form.success && <form noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={form.busy}>
        <Field label="Officer full name" name="displayName" autoComplete="off" maxLength={100} />
        <Field label="Officer email address" name="email" type="email" autoComplete="off" maxLength={254} />
        <div className="field"><label htmlFor="officer-department">Department</label><select id="officer-department" name="departmentId" disabled={form.departments.loading}><option value="">Choose a department</option>{form.departments.data?.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></div>
        <p className="field-hint invitation-hint">This sends a registration invitation to the email address above. If the request is interrupted, check User management before sending another invitation.</p>
        <SubmitButton busy={form.busy} disabled={form.departments.loading || !form.departments.data?.length}>Send Officer invitation</SubmitButton>
      </fieldset></form>}
      {form.success && <Link to="/admin/users" className="text-link">Return to User management</Link>}
    </section></>
}
