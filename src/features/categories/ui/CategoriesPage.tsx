import { useState } from 'react'
import { Plus, RefreshCw, Tags } from 'lucide-react'
import { Field, Notice, SubmitButton } from '../../../shared/ui/Form'
import { userMessage } from '../../../shared/errors/message'
import { useCategoryAdmin } from '../application/useCategoryAdmin'
import type { AdminCategory } from '../model/category'

type Editing = AdminCategory | 'new' | null

export function CategoriesPage() {
  const state = useCategoryAdmin()
  const [editing, setEditing] = useState<Editing>(null)
  const categories = state.data?.categories ?? []
  const departments = state.data?.departments ?? []
  const current = editing && editing !== 'new' ? editing : null
  const departmentName = (id: string) => departments.find((department) => department.id === id)?.name ?? 'Unknown department'
  const choosable = departments.filter((department) => department.is_active || department.id === current?.department_id)
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">ADMINISTRATION</span><h1>Service categories</h1><p>Choose which services Citizens can report and which department receives each complaint.</p></div><button className="button button-primary" type="button" disabled={state.saving} onClick={() => { state.clearMessages(); setEditing('new') }}><Plus size={16} aria-hidden="true" />New category</button></div>
    {state.error ? <Notice>{userMessage(state.error)}</Notice> : null}{state.success && <Notice success>{state.success}</Notice>}
    {editing && <section className="panel edit-form"><h2>{current ? `Edit “${current.name}”` : 'New category'}</h2><p className="muted">Deactivating a category hides it from new complaints; existing complaints keep it. A category that already has complaints keeps its department.</p>
      <form noValidate key={current?.id ?? 'new'} onSubmit={(event) => {
        event.preventDefault(); const values = new FormData(event.currentTarget)
        void state.save({ id: current?.id ?? null, name: String(values.get('name') ?? ''), description: String(values.get('description') ?? ''), departmentId: String(values.get('departmentId') ?? ''), active: values.has('active') }).then((saved) => { if (saved) setEditing(null) })
      }}>
        {state.saveError && <Notice>{state.saveError}</Notice>}
        <Field label="Category name" name="name" defaultValue={current?.name ?? ''} maxLength={100} required />
        <div className="field"><label htmlFor="category-description">Description (optional)</label><textarea id="category-description" name="description" rows={2} maxLength={500} defaultValue={current?.description ?? ''} /></div>
        <label htmlFor="category-department">Receiving department</label><select id="category-department" name="departmentId" defaultValue={current?.department_id ?? ''} required><option value="">Select a department</option>{choosable.map((department) => <option key={department.id} value={department.id}>{department.name}{department.is_active ? '' : ' (inactive)'}</option>)}</select>
        <label className="checkbox-label"><input type="checkbox" name="active" defaultChecked={current?.is_active ?? true} />Available for new complaints</label>
        <div className="button-row"><SubmitButton busy={state.saving}>{current ? 'Save category' : 'Create category'}</SubmitButton><button type="button" className="button button-secondary" disabled={state.saving} onClick={() => { state.clearMessages(); setEditing(null) }}>Cancel</button></div>
      </form></section>}
    <section className="panel"><div className="table-toolbar"><p className="muted">{categories.filter((category) => category.is_active).length} active of {categories.length} categories</p><button type="button" className="button button-secondary" onClick={() => void state.reload()} disabled={state.loading}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
      {state.loading && !state.data ? <p role="status" className="empty-state">Loading categories…</p> : categories.length ? <div className="table-wrap"><table className="stack-table"><caption className="sr-only">Service categories and their receiving departments</caption><thead><tr><th>Category</th><th>Department</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong>{category.description && <small>{category.description}</small>}</td><td data-label="Department">{departmentName(category.department_id)}</td><td data-label="Status"><span className={`badge ${category.is_active ? '' : 'badge-inactive'}`}>{category.is_active ? 'Active' : 'Inactive'}</span></td><td><button className="button button-secondary" type="button" disabled={state.saving} onClick={() => { state.clearMessages(); setEditing(category) }} aria-label={`Edit ${category.name}`}>Edit</button></td></tr>)}</tbody></table></div> : !state.error && <div className="empty-state"><Tags size={28} className="mx-auto mb-3" aria-hidden="true" />No categories are configured yet. Create the first category.</div>}
    </section></>
}
