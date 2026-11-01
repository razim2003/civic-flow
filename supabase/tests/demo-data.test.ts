import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDatabase } from './harness'

// Fictional Sri Lankan demonstration data (supabase/demo). The seed must use the real
// workflow RPCs, keep history consistent and be removable without touching real rows.
const seedSql = await readFile(new URL('../demo/sri-lanka-demo.sql', import.meta.url), 'utf8')
const removeSql = await readFile(new URL('../demo/remove-sri-lanka-demo.sql', import.meta.url), 'utf8')
const demoLike = "'5e1a0000-0000-4000-8000-000000000%'"
const road = 'f1000000-0000-4000-8000-000000000001', water = 'f1000000-0000-4000-8000-000000000003', other = 'f1000000-0000-4000-8000-000000000006'

// The fixture auth.users table only has the columns the migrations need; add the
// subset of real Supabase Auth columns that the seed writes.
async function demoDatabase() {
  const db = await createTestDatabase()
  await db.exec(`alter table auth.users
    add column instance_id uuid, add column aud text, add column role text, add column email text,
    add column encrypted_password text, add column email_confirmed_at timestamptz, add column raw_app_meta_data jsonb,
    add column created_at timestamptz, add column updated_at timestamptz, add column confirmation_token text,
    add column recovery_token text, add column email_change_token_new text, add column email_change text`)
  return db
}
const count = async (db: PGlite, sql: string, args: unknown[] = []) => Number((await db.query<{ n: number }>(`select count(*)::int n from (${sql}) q`, args)).rows[0].n)

describe('Sri Lankan demo data on an empty database', () => {
  let db: PGlite
  const admin = randomUUID()
  beforeAll(async () => {
    db = await demoDatabase()
    await db.query('insert into auth.users(id) values($1)', [admin])
    await db.query("update public.profiles set role='administrator' where id=$1", [admin])
    await db.exec(seedSql)
  })
  afterAll(async () => { await db?.close() })

  it('creates fictional login-less people and staffs every department except Other public services', async () => {
    const people = await db.query<{ role: string; department_id: string | null; email: string; encrypted_password: string; display_name: string }>(
      `select p.role,p.department_id,u.email,u.encrypted_password,p.display_name from public.profiles p join auth.users u on u.id=p.id where p.id::text like ${demoLike}`)
    expect(people.rows.filter((row) => row.role === 'citizen')).toHaveLength(10)
    expect(people.rows.filter((row) => row.role === 'officer')).toHaveLength(6)
    expect(people.rows.every((row) => row.email.endsWith('@demo.civicflow.test') && row.encrypted_password === '')).toBe(true)
    expect(new Set(people.rows.filter((row) => row.role === 'officer').map((row) => row.department_id)).has(other)).toBe(false)
    expect(people.rows.map((row) => row.display_name)).toContain('Kavitha Sivakumar')
  })

  it('creates 36 complaints across the full lifecycle through the workflow RPCs', async () => {
    const statuses = await db.query<{ status: string; n: number }>(`select status::text,count(*)::int n from public.complaints group by status order by status`)
    expect(Object.fromEntries(statuses.rows.map((row) => [row.status, row.n]))).toEqual({ in_progress: 4, resolved: 21, submitted: 5, under_review: 3, withdrawn: 3 })
    expect(await count(db, "select 1 from public.complaint_events where event_type='transferred'")).toBe(1)
    expect(await count(db, "select 1 from public.complaint_events where event_type='submitted' and (changes->>'auto_assigned')::boolean")).toBe(33)
    expect(await count(db, 'select 1 from public.complaint_feedback')).toBe(19)
    // Coverage gap kept on purpose for the Dispatch centre.
    expect(await count(db, 'select 1 from public.complaints where department_id=$1 and assigned_officer_id is null and status=$2', [other, 'submitted'])).toBe(3)
  })

  it('keeps every history consistent after moving it back in time', async () => {
    expect(await count(db, `select c.id from public.complaints c join public.complaint_events e on e.complaint_id=c.id
      group by c.id,c.version having count(*)<>c.version or min(e.complaint_version)<>1 or max(e.complaint_version)<>c.version`)).toBe(0)
    expect(await count(db, `select 1 from public.complaint_events a join public.complaint_events b
      on b.complaint_id=a.complaint_id and b.complaint_version=a.complaint_version+1 where b.created_at<a.created_at`)).toBe(0)
    expect(await count(db, `select 1 from public.complaints c join public.complaint_events e on e.complaint_id=c.id and e.complaint_version=1 where e.created_at<>c.created_at`)).toBe(0)
    expect(await count(db, `select 1 from public.complaints c join public.complaint_events e on e.complaint_id=c.id and e.complaint_version=c.version
      where (c.status='resolved' and e.created_at<>c.resolved_at) or (c.status='withdrawn' and e.created_at<>c.withdrawn_at)`)).toBe(0)
    expect(await count(db, 'select 1 from public.notifications n join public.complaint_events e on e.id=n.event_id where n.created_at<>e.created_at')).toBe(0)
    expect(await count(db, `select 1 from public.complaint_events e join public.complaints c on c.id=e.complaint_id
      where not exists(select 1 from public.notifications n where n.event_id=e.id and n.recipient_id=c.citizen_id)`)).toBe(0)
    expect(await count(db, `select 1 from public.complaints where created_at < now()-interval '180 days' or created_at > now()
      or resolved_at > now() or latitude not between 5.9 and 9.9 or longitude not between 79.5 and 81.9`)).toBe(0)
    expect(await count(db, `select 1 from public.complaint_feedback f join public.complaints c on c.id=f.complaint_id where f.created_at<c.resolved_at or f.created_at>now()`)).toBe(0)
  })

  it('gives analytics six months of trend, late work and overdue open complaints', async () => {
    const result = await asUser(db, admin, () => db.query<{ a: { trend: { submitted: number }[]; overdue: number; resolution: { count: number; within_target: number }; satisfaction: { count: number } } }>('select public.admin_analytics() a'))
    const analytics = result.rows[0].a
    expect(analytics.trend).toHaveLength(6)
    // The newest demo complaint is 12 hours old, so the current month can still be
    // empty early on its first day; the five completed months always have data.
    expect(analytics.trend.slice(0, 5).every((month) => month.submitted > 0)).toBe(true)
    expect(analytics.overdue).toBeGreaterThan(0)
    expect(analytics.resolution.count).toBe(21)
    expect(analytics.resolution.within_target).toBeLessThan(21)
    expect(analytics.satisfaction.count).toBe(19)
  })

  it('leaves seeded open complaints workable with the normal Officer workflow', async () => {
    const open = (await db.query<{ id: string; version: number; assigned_officer_id: string }>(
      "select id,version,assigned_officer_id from public.complaints where department_id=$1 and status='submitted'", [road])).rows[0]
    const reviewed = await asUser(db, open.assigned_officer_id, () => db.query<{ status: string }>('select * from public.review_complaint($1,$2,$3)', [open.id, open.version, 'Reviewed during the demo.']))
    expect(reviewed.rows[0].status).toBe('under_review')
  })
})

describe('Sri Lankan demo data next to existing accounts', () => {
  let db: PGlite
  const roadOfficer = randomUUID(), citizen = randomUUID()
  let realComplaint: string
  beforeAll(async () => {
    db = await demoDatabase()
    for (const id of [roadOfficer, citizen]) await db.query('insert into auth.users(id) values($1)', [id])
    await db.query("update public.profiles set role='officer',department_id=$1 where id=$2", [road, roadOfficer])
    const category = (await db.query<{ id: string }>('select id from public.categories where department_id=$1', [road])).rows[0].id
    realComplaint = (await asUser(db, citizen, () => db.query<{ id: string }>('select id from public.submit_complaint($1,$2,$3,$4,$5,$6)',
      [category, 'Existing fictional complaint kept by the cleanup.', 'Sample Road', 6.9, 79.9, randomUUID()]))).rows[0].id
    await db.exec(seedSql)
  })
  afterAll(async () => { await db?.close() })

  it('uses the existing Officer instead of creating a demo Officer for a staffed department', async () => {
    expect(await count(db, "select 1 from public.profiles where id='5e1a0000-0000-4000-8000-000000000201'")).toBe(0)
    expect(await count(db, `select 1 from public.complaints where department_id=$1 and citizen_id::text like ${demoLike} and assigned_officer_id is distinct from $2 and status not in ('withdrawn')`, [road, roadOfficer])).toBe(0)
    const transfer = await db.query<{ actor_id: string }>("select actor_id from public.complaint_events where event_type='transferred'")
    expect(transfer.rows[0].actor_id).toBe(roadOfficer)
  })

  it('is idempotent', async () => {
    const before = await count(db, 'select 1 from public.complaint_events')
    await db.exec(seedSql)
    expect(await count(db, 'select 1 from public.complaint_events')).toBe(before)
  })

  it('refuses to remove demo people that real work depends on', async () => {
    const waterCategory = (await db.query<{ id: string }>('select id from public.categories where department_id=$1', [water])).rows[0].id
    const real = (await asUser(db, citizen, () => db.query<{ id: string; assigned_officer_id: string }>('select * from public.submit_complaint($1,$2,$3,$4,$5,$6)',
      [waterCategory, 'Real fictional complaint auto-assigned to a demo Officer.', 'Sample Lane', 7, 80, randomUUID()]))).rows[0]
    expect(real.assigned_officer_id).toMatch(/^5e1a0000-/)
    await expect(db.exec(removeSql)).rejects.toThrow(/demo_data_in_use/)
    expect(await count(db, `select 1 from public.profiles where id::text like ${demoLike}`)).toBe(15)
    // Hand the real complaint back to an unassigned state so the cleanup can proceed.
    await db.query('delete from public.notifications where complaint_id=$1', [real.id])
    await db.query('delete from public.complaint_events where complaint_id=$1', [real.id])
    await db.query('delete from public.complaints where id=$1', [real.id])
  })

  it('removes only demo data and keeps existing accounts and complaints', async () => {
    await db.exec(removeSql)
    expect(await count(db, `select 1 from public.profiles where id::text like ${demoLike}`)).toBe(0)
    expect(await count(db, `select 1 from auth.users where id::text like ${demoLike}`)).toBe(0)
    expect(await count(db, 'select 1 from public.complaints')).toBe(1)
    expect(await count(db, 'select 1 from public.complaints where id=$1', [realComplaint])).toBe(1)
    expect(await count(db, 'select 1 from public.notifications where recipient_id=$1', [roadOfficer])).toBe(1)
    expect(await count(db, 'select 1 from public.profiles where id=any($1::uuid[])', [[roadOfficer, citizen]])).toBe(2)
  })
})
