import { useAuth, roleLabels } from '../../auth'
import { useProfileForm } from '../application/useProfileForm'
import { Field, Notice, SubmitButton } from '../../../shared/ui/Form'
import { ShieldCheck } from 'lucide-react'

export function ProfilePage() {
  const { profile } = useAuth()
  const form = useProfileForm()
  if (!profile) return null
  return <><div className="page-heading"><span className="eyebrow">YOUR ACCOUNT</span><h1>Profile settings</h1><p>Keep your name up to date so your team can recognize you.</p></div>
    <section className="panel profile-panel"><h2>Personal information</h2><p className="muted">Your account role is managed by your organization.</p>{form.error && <Notice>{form.error}</Notice>}
      <form onSubmit={(event) => { event.preventDefault(); void form.save(String(new FormData(event.currentTarget).get('displayName') ?? '')) }}><Field label="Full name" name="displayName" autoComplete="name" defaultValue={profile.display_name} maxLength={100} /><div className="profile-role"><ShieldCheck size={18} aria-hidden="true" /><div><span className="muted">Account role</span><strong>{roleLabels[profile.role]}</strong></div><span className="badge">Active</span></div><SubmitButton busy={form.busy}>Save changes</SubmitButton></form>
    </section></>
}
