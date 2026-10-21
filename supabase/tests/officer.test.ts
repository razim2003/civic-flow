import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDatabase } from './harness'

const citizen = randomUUID(), otherCitizen = randomUUID(), officer = randomUUID(), teammate = randomUUID(), foreignOfficer = randomUUID(), inactive = randomUUID(), admin = randomUUID()
let db: PGlite, category: string, department: string, foreignCategory: string, foreignDepartment: string
type Report = { id: string; status: string; version: number; assigned_officer_id: string | null; department_id: string; priority: string; resolved_by: string | null; resolution_text: string | null; resolved_at: Date | null }
const call = (name: string, args: unknown[], user: string | null = officer) => asUser(db, user, () => db.query<Report>(`select * from public.${name}(${args.map((_, index) => `$${index + 1}`).join(',')})`, args))
async function create(status = 'submitted', assigned: string | null = null) {
  const report = (await call('submit_complaint', [category, 'A damaged public road near a fictional school.', 'Sample Road', 7, 80, randomUUID()], citizen)).rows[0]
  if (status !== 'submitted' || assigned) await db.query('update public.complaints set status=$2,assigned_officer_id=$3 where id=$1', [report.id, status, assigned])
  return report.id
}
beforeAll(async () => {
  db = await createTestDatabase()
  const routes = await db.query<{ id: string; department_id: string; name: string }>("select id,department_id,name from public.categories where name in ('Road maintenance','Water supply')")
  const roads = routes.rows.find((row) => row.name === 'Road maintenance')!, water = routes.rows.find((row) => row.name === 'Water supply')!
  category = roads.id; department = roads.department_id; foreignCategory = water.id; foreignDepartment = water.department_id
  for (const id of [citizen, otherCitizen, officer, teammate, foreignOfficer, inactive, admin]) await db.query('insert into auth.users(id) values($1)', [id])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=any($2::uuid[])", [department, [officer, teammate, inactive]])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=$2", [foreignDepartment, foreignOfficer])
  await db.query('update public.profiles set is_active=false where id=$1', [inactive])
  await db.query("update public.profiles set role='administrator' where id=$1", [admin])
})
afterAll(async () => { await db?.close() })

describe('CF-08–12 Officer authorization and atomic lifecycle', () => {
  it('records review, assignment, priority, start, progress and resolution atomically', async () => {
    const id = await create()
    expect((await call('review_complaint', [id, 1, 'Checking the reported location.'])).rows[0]).toMatchObject({ status: 'under_review', version: 2 })
    expect((await call('assign_complaint', [id, officer, 2, 'Allocated to the road team.'])).rows[0]).toMatchObject({ assigned_officer_id: officer, version: 3 })
    expect((await call('set_complaint_priority', [id, 'high', 3, 'Near the school entrance.'])).rows[0]).toMatchObject({ priority: 'high', version: 4 })
    expect((await call('start_complaint', [id, 4, 'Repair team has started work.'])).rows[0]).toMatchObject({ status: 'in_progress', version: 5 })
    expect((await call('add_progress', [id, '  Surface preparation is complete.  ', 5])).rows[0].version).toBe(6)
    const resolved = (await call('resolve_complaint', [id, '  Road surface repaired and inspected.  ', 6])).rows[0]
    expect(resolved).toMatchObject({ status: 'resolved', resolution_text: 'Road surface repaired and inspected.', resolved_by: officer, version: 7 })
    expect(resolved.resolved_at).not.toBeNull()
    const events = await db.query<{ event_type: string; actor_id: string; kind: string; recipient_id: string }>('select e.event_type,e.actor_id,n.kind,n.recipient_id from public.complaint_events e join public.notifications n on n.event_id=e.id where e.complaint_id=$1 order by e.complaint_version', [id])
    expect(events.rows.map((row) => row.event_type)).toEqual(['submitted', 'reviewed', 'assigned', 'priority_changed', 'started', 'progress_added', 'resolved'])
    expect(events.rows.slice(1).every((row) => row.actor_id === officer && row.recipient_id === citizen)).toBe(true)
    expect(events.rows.at(-1)?.kind).toBe('resolution')
    expect((await asUser(db, citizen, () => db.query('select id from public.complaint_events where complaint_id=$1', [id]))).rows).toHaveLength(7)
    expect((await asUser(db, otherCitizen, () => db.query('select id from public.complaint_events where complaint_id=$1', [id]))).rows).toHaveLength(0)
  })
  it.each([citizen, otherCitizen, foreignOfficer, inactive, admin])('denies non-Officer, foreign-department or inactive workflow caller %s', async (user) => {
    const id = await create()
    for (const [rpc, args] of [
      ['review_complaint', [id, 1, '']], ['assign_complaint', [id, officer, 1, '']], ['set_complaint_priority', [id, 'high', 1, '']],
      ['start_complaint', [id, 1, '']], ['add_progress', [id, 'update', 1]], ['resolve_complaint', [id, 'A valid resolution text.', 1]],
      ['transfer_complaint', [id, foreignDepartment, foreignCategory, 1, 'The report belongs to water services.']],
    ] as const) await expect(call(rpc, [...args], user)).rejects.toThrow('not_authorized')
  })
  it('denies anonymous execution and direct table mutation', async () => {
    const id = await create()
    await expect(call('review_complaint', [id, 1, ''], null)).rejects.toThrow('permission denied')
    await expect(asUser(db, officer, () => db.query("update public.complaints set status='resolved' where id=$1", [id]))).rejects.toThrow('permission denied')
    await expect(asUser(db, officer, () => db.query('select private.lock_officer_complaint($1,1)', [id]))).rejects.toThrow('permission denied')
  })
  it('exposes only the active same-department assignment roster, not private profiles', async () => {
    const roster = await asUser(db, officer, () => db.query<{ team: { id: string; display_name: string }[] }>('select public.list_assignable_officers($1) as team', [department]))
    expect(roster.rows[0].team.map((row) => row.id).sort()).toEqual([officer, teammate].sort())
    expect(Object.keys(roster.rows[0].team[0]).sort()).toEqual(['display_name', 'id'])
    for (const user of [citizen, otherCitizen, foreignOfficer, inactive]) await expect(call('list_assignable_officers', [department], user)).rejects.toThrow('not_authorized')
    expect((await asUser(db, officer, () => db.query('select id from public.profiles where id=$1', [teammate]))).rows).toHaveLength(0)
    expect((await call('list_assignable_officers', [department], admin)).rows).toHaveLength(1)
  })
  it('rejects unassigned/foreign/inactive targets and rechecks the current assignee', async () => {
    const id = await create('under_review', officer)
    for (const target of [citizen, foreignOfficer, inactive, admin, null]) await expect(call('assign_complaint', [id, target, 1, ''])).rejects.toThrow('invalid_assignee')
    await expect(call('start_complaint', [id, 1, ''], teammate)).rejects.toThrow('not_assigned')
    await call('start_complaint', [id, 1, ''])
    await expect(call('assign_complaint', [id, teammate, 2, 'short'])).rejects.toThrow('reason_required')
    await call('assign_complaint', [id, teammate, 2, 'The second Officer will complete the repair.'])
    await expect(call('add_progress', [id, 'Updated', 3])).rejects.toThrow('not_assigned')
    await expect(call('resolve_complaint', [id, 'Repairs completed and checked.', 3])).rejects.toThrow('not_assigned')
    expect((await call('add_progress', [id, 'Updated', 3], teammate)).rows[0].version).toBe(4)
  })
  it('rejects skipped/repeated transitions, stale writes and duplicates without new history', async () => {
    const id = await create('submitted', officer)
    await expect(call('start_complaint', [id, 1, ''])).rejects.toThrow('invalid_transition')
    await expect(call('resolve_complaint', [id, 'Repair complete.', 1])).rejects.toThrow('invalid_transition')
    await call('review_complaint', [id, 1, ''])
    await expect(call('review_complaint', [id, 1, ''])).rejects.toMatchObject({ code: 'PT409', message: 'stale_version' })
    await expect(call('review_complaint', [id, 2, ''])).rejects.toThrow('invalid_transition')
    await expect(call('add_progress', [id, 'Updated', 2])).rejects.toThrow('invalid_transition')
    await call('assign_complaint', [id, officer, 2, '']) // no-op
    await call('set_complaint_priority', [id, 'normal', 2, '']) // no-op
    expect((await db.query('select id from public.complaint_events where complaint_id=$1', [id])).rows).toHaveLength(2)
  })
  it.each([null, 0, -1, 9007199254740992])('rejects invalid expected version %s', async (version) => {
    await expect(call('review_complaint', [await create(), version, ''])).rejects.toThrow('invalid_input')
  })
  it('enforces bounded remarks, required progress and resolution details', async () => {
    const id = await create('in_progress', officer)
    for (const value of [null, '', ' ', 'x'.repeat(2001)]) await expect(call('add_progress', [id, value, 1])).rejects.toThrow('progress_required')
    for (const value of [null, '', 'short', 'x'.repeat(5001)]) await expect(call('resolve_complaint', [id, value, 1])).rejects.toThrow('resolution_required')
    await expect(call('set_complaint_priority', [id, 'urgent', 1, 'x'.repeat(2001)])).rejects.toThrow('invalid_input')
    expect((await db.query('select version from public.complaints where id=$1', [id])).rows[0]).toEqual({ version: 1 })
  })
  it('transfers with a matching active route, clears assignment and removes old-department access', async () => {
    const id = await create('under_review', officer)
    await expect(call('transfer_complaint', [id, foreignDepartment, category, 1, 'Route the report to water services.'])).rejects.toThrow('category_unavailable')
    await expect(call('transfer_complaint', [id, foreignDepartment, foreignCategory, 1, 'short'])).rejects.toThrow('reason_required')
    expect((await call('transfer_complaint', [id, foreignDepartment, foreignCategory, 1, 'Route the report to water services.'])).rows[0]).toMatchObject({ department_id: foreignDepartment, assigned_officer_id: null, version: 2 })
    expect((await asUser(db, officer, () => db.query('select id from public.complaints where id=$1', [id]))).rows).toHaveLength(0)
    expect((await asUser(db, foreignOfficer, () => db.query('select id from public.complaints where id=$1', [id]))).rows).toHaveLength(1)
    await expect(call('assign_complaint', [id, officer, 2, ''])).rejects.toThrow('not_authorized')
    await expect(call('transfer_complaint', [await create('in_progress', officer), foreignDepartment, foreignCategory, 1, 'Transfer after work started.'])).rejects.toThrow('invalid_transition')
  })
  it('blocks every mutation after withdrawal or resolution', async () => {
    for (const status of ['withdrawn', 'resolved']) {
      const id = await create('in_progress', officer)
      if (status === 'withdrawn') await call('withdraw_complaint', [id, 'The issue was already addressed elsewhere.', 1], citizen)
      else await call('resolve_complaint', [id, 'The road has been repaired.', 1])
      for (const [rpc, args] of [['review_complaint', [id, 2, '']], ['assign_complaint', [id, officer, 2, '']], ['set_complaint_priority', [id, 'urgent', 2, '']], ['start_complaint', [id, 2, '']], ['add_progress', [id, 'Update', 2]], ['resolve_complaint', [id, 'Repaired again.', 2]], ['transfer_complaint', [id, foreignDepartment, foreignCategory, 2, 'Route to water services.']]] as const) await expect(call(rpc, [...args])).rejects.toThrow('complaint_closed')
    }
  })
  it('rolls back complaint changes and history if a notification write fails', async () => {
    const id = await create()
    await db.exec("create function private.test_fail_officer() returns trigger language plpgsql as $$ begin raise exception 'fixture_notification_failure'; end $$; create trigger test_fail_officer before insert on public.notifications for each row execute function private.test_fail_officer();")
    try {
      await expect(call('review_complaint', [id, 1, ''])).rejects.toThrow('fixture_notification_failure')
      expect((await db.query('select status,version from public.complaints where id=$1', [id])).rows[0]).toEqual({ status: 'submitted', version: 1 })
      expect((await db.query('select id from public.complaint_events where complaint_id=$1', [id])).rows).toHaveLength(1)
    } finally { await db.exec('drop trigger test_fail_officer on public.notifications; drop function private.test_fail_officer();') }
  })
})
