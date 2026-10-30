import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Users } from 'lucide-react'
import { roleLabels, roles } from '../../auth'
import type { Profile, Role } from '../../auth'
import { useUsers } from '../application/useUsers'
import { Field, Notice, SubmitButton } from '../../../shared/ui/Form'

export function UsersPage() {
  const data = useUsers()
  const [editing, setEditing] = useState<Profile | null>(null)
  const [role, setRole] = useState<Role>('citizen')
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">ADMINISTRATION</span><h1>User management</h1><p>Help your team work together with the right account access.</p></div><Link className="button button-primary" to="/admin/officers/new">Create Officer account</Link></div>
    {data.error && <Notice>{data.error}</Notice>}{data.success && <Notice success>{data.success}</Notice>}
    {editing && <section className="panel edit-form"><h2>Edit user access</h2><p className="muted">Changes take effect immediately. At least one active administrator must remain.</p><form onSubmit={(event) => {
      event.preventDefault(); const values = new FormData(event.currentTarget)
      void data.save({ id: editing.id, name: String(values.get('displayName') ?? ''), role, departmentId: role === 'officer' ? String(values.get('departmentId') ?? '') : null, active: values.has('active') }).then((saved) => { if (saved) setEditing(null) })
    }}><Field label="Full name" name="displayName" defaultValue={editing.display_name} maxLength={100} /><label htmlFor="role">Account role</label><select id="role" name="role" value={role} onChange={(event) => { const parsed = roles.find((role) => role === event.target.value); if (parsed) setRole(parsed) }}>{roles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select>
      {role === 'officer' && <><label htmlFor="departmentId">Department</label><select name="departmentId" id="departmentId" defaultValue={editing.department_id ?? ''} required><option value="">Select a department</option>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{!data.departments.length && <p className="muted">No active departments are available. Contact the project administrator to configure departments.</p>}</>}
      <label className="checkbox-label"><input type="checkbox" name="active" defaultChecked={editing.is_active} />Account active</label><div className="button-row"><SubmitButton busy={data.saving}>Save access</SubmitButton><button type="button" className="button button-secondary" onClick={() => setEditing(null)} disabled={data.saving}>Cancel</button></div></form></section>}
    <section className="panel"><div className="table-toolbar"><Field label="Search users" name="search" type="search" placeholder="Search by name" value={data.search} onChange={(event) => data.setSearch(event.target.value)} /><button type="button" className="button button-secondary" onClick={() => void data.load()} disabled={data.loading}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
      {data.loading ? <p role="status" className="empty-state">Loading users…</p> : data.users.length ? <div className="table-wrap"><table className="stack-table"><caption className="sr-only">Existing application users and their access</caption><thead><tr><th>Name</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><strong>{user.display_name}</strong><small>{user.id}</small></td><td data-label="Role">{roleLabels[user.role]}</td><td data-label="Status"><span className={`badge ${user.is_active ? '' : 'badge-inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td><td><button className="button button-secondary" disabled={data.saving} onClick={() => { setEditing(user); setRole(user.role) }} aria-label={`Edit access for ${user.display_name}`}>Edit access</button></td></tr>)}</tbody></table></div> : !data.error && <div className="empty-state"><Users size={28} className="mx-auto mb-3" aria-hidden="true" />No users match your search.</div>}
      <div className="pagination"><span>{data.count} {data.count === 1 ? 'user' : 'users'}</span><div className="button-row"><button className="button button-secondary" disabled={!data.page || data.loading} onClick={() => data.setPage(data.page - 1)}>Previous</button><button className="button button-secondary" disabled={(data.page + 1) * 20 >= data.count || data.loading} onClick={() => data.setPage(data.page + 1)}>Next</button></div></div>
    </section></>
}
