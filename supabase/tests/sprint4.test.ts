import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDatabase } from './harness'

const citizen = randomUUID(), otherCitizen = randomUUID(), officer = randomUUID(), foreignOfficer = randomUUID(), admin = randomUUID(), inactiveCitizen = randomUUID(), inactiveAdmin = randomUUID()
let db: PGlite, category: string, department: string, foreignDepartment: string
const call = <T = Record<string, unknown>>(name: string, args: unknown[], user: string | null) =>
  asUser(db, user, () => db.query<T>(`select * from public.${name}(${args.map((_, index) => `$${index + 1}`).join(',')})`, args))

async function resolvedComplaint(owner = citizen) {
  const id = (await call<{ id: string }>('submit_complaint', [category, 'Broken streetlight beside a fictional bus stop.', 'Sample Junction', 6.1, 80.2, randomUUID()], owner)).rows[0].id
  await call('review_complaint', [id, 1, ''], officer)
  await call('assign_complaint', [id, officer, 2, ''], officer)
  await call('start_complaint', [id, 3, ''], officer)
  await call('resolve_complaint', [id, 'The streetlight was replaced and tested.', 4], officer)
  return id
}

beforeAll(async () => {
  db = await createTestDatabase()
  const routes = await db.query<{ id: string; department_id: string; name: string }>("select id,department_id,name from public.categories where name in ('Road maintenance','Water supply')")
  const roads = routes.rows.find((row) => row.name === 'Road maintenance')!
  category = roads.id; department = roads.department_id
  foreignDepartment = routes.rows.find((row) => row.name === 'Water supply')!.department_id
  for (const id of [citizen, otherCitizen, officer, foreignOfficer, admin, inactiveCitizen, inactiveAdmin]) await db.query('insert into auth.users(id) values($1)', [id])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=$2", [department, officer])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=$2", [foreignDepartment, foreignOfficer])
  await db.query("update public.profiles set role='administrator' where id=any($1::uuid[])", [[admin, inactiveAdmin]])
  await db.query('update public.profiles set is_active=false where id=any($1::uuid[])', [[inactiveCitizen, inactiveAdmin]])
})
afterAll(async () => { await db?.close() })

describe('CF-19 post-resolution Citizen feedback', () => {
  it('stores one trimmed rating/comment for the owner of a resolved complaint', async () => {
    const id = await resolvedComplaint()
    const saved = (await call('submit_feedback', [id, 5, '  Fixed quickly, thank you.  '], citizen)).rows[0]
    expect(saved).toMatchObject({ complaint_id: id, citizen_id: citizen, rating: 5, comment: 'Fixed quickly, thank you.' })
    expect((await call('submit_feedback', [id, 5, 'Fixed quickly, thank you.'], citizen)).rows[0]).toMatchObject({ rating: 5 }) // identical retry
    await expect(call('submit_feedback', [id, 2, 'Changed my mind.'], citizen)).rejects.toMatchObject({ code: '23505', message: 'feedback_exists' })
    expect((await db.query('select count(*)::int as n from public.complaint_feedback where complaint_id=$1', [id])).rows[0]).toEqual({ n: 1 })
  })
  it('stores an empty comment as null and accepts every rating from 1 to 5', async () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      const id = await resolvedComplaint()
      expect((await call('submit_feedback', [id, rating, '   '], citizen)).rows[0]).toMatchObject({ rating, comment: null })
    }
  })
  it('rejects out-of-range ratings and oversized comments', async () => {
    const id = await resolvedComplaint()
    for (const [rating, comment] of [[0, ''], [6, ''], [null, ''], [3, 'x'.repeat(2001)]] as const) {
      await expect(call('submit_feedback', [id, rating, comment], citizen)).rejects.toThrow('invalid_feedback')
    }
  })
  it('rejects feedback before resolution and after withdrawal', async () => {
    const open = (await call<{ id: string }>('submit_complaint', [category, 'Overflowing drain on a fictional lane.', 'Sample Lane', 6, 80, randomUUID()], citizen)).rows[0].id
    await expect(call('submit_feedback', [open, 4, ''], citizen)).rejects.toThrow('feedback_closed')
    await call('withdraw_complaint', [open, 'The drain was cleared by neighbours.', 1], citizen)
    await expect(call('submit_feedback', [open, 4, ''], citizen)).rejects.toThrow('feedback_closed')
  })
  it.each([otherCitizen, officer, admin, inactiveCitizen])('denies feedback by non-owner, staff or inactive caller %s', async (user) => {
    const id = await resolvedComplaint()
    await expect(call('submit_feedback', [id, 4, ''], user)).rejects.toThrow('not_authorized')
  })
  it('denies anonymous execution and direct writes; reads follow complaint access', async () => {
    const id = await resolvedComplaint()
    await call('submit_feedback', [id, 4, 'Good work.'], citizen)
    await expect(call('submit_feedback', [id, 4, ''], null)).rejects.toThrow('permission denied')
    await expect(asUser(db, citizen, () => db.query('update public.complaint_feedback set rating=1 where complaint_id=$1', [id]))).rejects.toThrow('permission denied')
    await expect(asUser(db, citizen, () => db.query('delete from public.complaint_feedback where complaint_id=$1', [id]))).rejects.toThrow('permission denied')
    await expect(asUser(db, otherCitizen, () => db.query('insert into public.complaint_feedback(complaint_id,citizen_id,rating) values($1,$2,5)', [id, otherCitizen]))).rejects.toThrow('permission denied')
    const read = (user: string) => asUser(db, user, () => db.query('select rating from public.complaint_feedback where complaint_id=$1', [id]))
    expect((await read(citizen)).rows).toHaveLength(1)
    expect((await read(officer)).rows).toHaveLength(1)
    expect((await read(admin)).rows).toHaveLength(1)
    expect((await read(otherCitizen)).rows).toHaveLength(0)
    expect((await read(foreignOfficer)).rows).toHaveLength(0)
  })
})

describe('CF-13 notification inbox and read state', () => {
  it('shows recipients only their own notifications and marks selected ones read', async () => {
    const id = await resolvedComplaint()
    const mine = await asUser(db, citizen, () => db.query<{ id: string; kind: string; read_at: Date | null }>('select id,kind,read_at from public.notifications where complaint_id=$1 order by created_at', [id]))
    expect(mine.rows.map((row) => row.kind)).toEqual(['submission', 'progress', 'progress', 'progress', 'resolution'])
    expect(mine.rows.every((row) => row.read_at === null)).toBe(true)
    for (const user of [otherCitizen, officer, admin]) expect((await asUser(db, user, () => db.query('select id from public.notifications where complaint_id=$1', [id]))).rows).toHaveLength(0)
    const marked = await call<{ id: string; read_at: Date | null }>('mark_notifications_read', [[mine.rows[0].id], false], citizen)
    expect(marked.rows).toHaveLength(1)
    expect(marked.rows[0].read_at).not.toBeNull()
    expect((await call('mark_notifications_read', [[mine.rows[0].id], false], citizen)).rows).toHaveLength(0) // already read
  })
  it('cannot mark another user’s notification read', async () => {
    const id = await resolvedComplaint()
    const target = (await db.query<{ id: string }>('select id from public.notifications where complaint_id=$1 limit 1', [id])).rows[0].id
    expect((await call('mark_notifications_read', [[target], false], otherCitizen)).rows).toHaveLength(0)
    expect((await call('mark_notifications_read', [null, true], otherCitizen)).rows.some((row) => row.id === target)).toBe(false)
    expect((await db.query('select read_at from public.notifications where id=$1', [target])).rows[0]).toEqual({ read_at: null })
  })
  it('marks all of the caller’s unread notifications read at once', async () => {
    await resolvedComplaint(otherCitizen)
    const marked = await call('mark_notifications_read', [null, true], otherCitizen)
    expect(marked.rows.length).toBeGreaterThan(0)
    expect((await asUser(db, otherCitizen, () => db.query('select id from public.notifications where read_at is null'))).rows).toHaveLength(0)
  })
  it('validates bounds and denies anonymous, inactive callers and direct updates', async () => {
    for (const args of [[null, false], [[], false], [Array.from({ length: 101 }, () => randomUUID()), false], [null, null]]) {
      await expect(call('mark_notifications_read', args, citizen)).rejects.toThrow('invalid_input')
    }
    await expect(call('mark_notifications_read', [null, true], inactiveCitizen)).rejects.toThrow('not_authorized')
    await expect(call('mark_notifications_read', [null, true], null)).rejects.toThrow('permission denied')
    await expect(asUser(db, citizen, () => db.query('update public.notifications set read_at=now()'))).rejects.toThrow('permission denied')
    await expect(asUser(db, citizen, () => db.query('delete from public.notifications'))).rejects.toThrow('permission denied')
  })
  it('hides an inactive recipient’s notifications', async () => {
    await db.query('insert into public.notifications(recipient_id,complaint_id,event_id,kind) select $1,complaint_id,id,$2 from public.complaint_events limit 1', [inactiveCitizen, 'progress'])
    expect((await asUser(db, inactiveCitizen, () => db.query('select id from public.notifications'))).rows).toHaveLength(0)
  })
})

describe('CF-20 audited Administrator category management', () => {
  type Category = { id: string; name: string; description: string | null; department_id: string; is_active: boolean }
  const upsert = (args: unknown[], user = admin) => call<Category>('admin_upsert_category', args, user)
  const audits = (target: string) => db.query<{ action: string; changes: { before?: Category; after: Category } }>('select action,changes from private.admin_audit_events where target_id=$1 order by created_at', [target])

  it('creates, renames, deactivates and audits a category; no-ops write no audit', async () => {
    const created = (await upsert([null, '  Street lighting  ', '  Lamps and poles ', department, true])).rows[0]
    expect(created).toMatchObject({ name: 'Street lighting', description: 'Lamps and poles', department_id: department, is_active: true })
    expect((await upsert([created.id, 'Street lighting', 'Lamps and poles', department, true])).rows[0].id).toBe(created.id) // no-op
    const updated = (await upsert([created.id, 'Public lighting', '', department, false])).rows[0]
    expect(updated).toMatchObject({ name: 'Public lighting', description: null, is_active: false })
    const log = await audits(created.id)
    expect(log.rows.map((row) => row.action)).toEqual(['category_created', 'category_updated'])
    expect(log.rows[1].changes.before).toMatchObject({ name: 'Street lighting', is_active: true })
    expect(log.rows[1].changes.after).toMatchObject({ name: 'Public lighting', is_active: false })
  })
  it('hides inactive categories from Citizens and blocks new submissions to them', async () => {
    const inactive = (await upsert([null, 'Park benches', '', department, false])).rows[0]
    expect((await asUser(db, citizen, () => db.query('select id from public.categories where id=$1', [inactive.id]))).rows).toHaveLength(0)
    await expect(call('submit_complaint', [inactive.id, 'A broken bench in a fictional park.', 'Sample Park', 6, 80, randomUUID()], citizen)).rejects.toThrow('category_unavailable')
  })
  it('rejects duplicate names (case-insensitive), invalid bounds and unavailable departments', async () => {
    await expect(upsert([null, 'road MAINTENANCE', '', department, true])).rejects.toMatchObject({ code: '23505', message: 'category_name_taken' })
    for (const args of [[null, '', '', department, true], [null, 'x'.repeat(101), '', department, true], [null, 'Valid name', 'x'.repeat(501), department, true], [null, 'Valid name', '', null, true], [null, 'Valid name', '', department, null], [randomUUID(), 'Valid name', '', department, true]]) {
      await expect(upsert(args)).rejects.toThrow('invalid_input')
    }
    await expect(upsert([null, 'Ghost route', '', randomUUID(), true])).rejects.toThrow('department_unavailable')
    await db.query('update public.departments set is_active=false where id=$1', [foreignDepartment])
    try {
      await expect(upsert([null, 'Inactive route', '', foreignDepartment, true])).rejects.toThrow('department_unavailable')
      expect((await upsert([null, 'Inactive route', '', foreignDepartment, false])).rows[0].is_active).toBe(false)
    } finally { await db.query('update public.departments set is_active=true where id=$1', [foreignDepartment]) }
  })
  it('keeps a referenced category’s routing department immutable', async () => {
    const route = (await upsert([null, 'Footpaths', '', department, true])).rows[0]
    await call('submit_complaint', [route.id, 'Cracked footpath near a fictional school.', 'Sample Street', 6, 80, randomUUID()], citizen)
    await expect(upsert([route.id, 'Footpaths', '', foreignDepartment, true])).rejects.toThrow('category_in_use')
    expect((await upsert([route.id, 'Footpaths and kerbs', '', department, true])).rows[0].name).toBe('Footpaths and kerbs')
  })
  it.each([citizen, officer, inactiveAdmin, null])('denies non-Administrator or anonymous caller %s', async (user) => {
    const attempt = upsert([null, `Denied ${randomUUID().slice(0, 8)}`, '', department, true], user as string)
    await expect(attempt).rejects.toThrow(user === null ? 'permission denied' : 'not_authorized')
  })
  it('denies direct category writes and audit-table reads by every browser role', async () => {
    for (const user of [admin, citizen]) {
      await expect(asUser(db, user, () => db.query("update public.categories set is_active=false where id=$1", [category]))).rejects.toThrow('permission denied')
      await expect(asUser(db, user, () => db.query('select * from private.admin_audit_events'))).rejects.toThrow('permission denied')
    }
  })
})
