import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDatabase } from './harness'

const citizen = randomUUID(), other = randomUUID(), officer = randomUUID(), otherOfficer = randomUUID(), admin = randomUUID(), inactive = randomUUID()
let db: PGlite, category: string, department: string
type Complaint = { id: string; citizen_id: string; category_id: string; department_id: string; status: string; priority: string; version: number; description: string }
type Evidence = { id: string; object_path: string; state: string; original_filename: string }
const submit = (user = citizen, request = randomUUID(), description = 'Broken street surface beside the school', cat = category, latitude: number | string = 6.927, longitude: number | string = 79.861) => asUser(db, user, () => db.query<Complaint>('select * from public.submit_complaint($1,$2,$3,$4,$5,$6)', [cat, description, 'School Road', latitude, longitude, request]))
const reserve = (complaint: string, user = citizen, request = randomUUID(), size = 9, type = 'application/pdf') => asUser(db, user, () => db.query<Evidence>('select * from public.reserve_evidence($1,$2,$3,$4,$5)', [complaint, 'sample.pdf', type, size, request]))
const finalize = (id: string, user = citizen) => asUser(db, user, () => db.query<Evidence>('select * from public.finalize_evidence($1)', [id]))
async function upload(evidence: Evidence, user = citizen, size = 9, mime = 'application/pdf') {
  return asUser(db, user, () => db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)', ['complaint-evidence', evidence.object_path, user, { size, mimetype: mime }]))
}
beforeAll(async () => {
  db = await createTestDatabase()
  const route = await db.query<{ id: string; department_id: string }>("select id,department_id from public.categories where name='Road maintenance'")
  category = route.rows[0].id; department = route.rows[0].department_id
  for (const id of [citizen, other, officer, otherOfficer, admin, inactive]) await db.query('insert into auth.users(id) values($1)', [id])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=$2", [department, officer])
  await db.query("update public.profiles set role='officer',department_id=(select department_id from public.categories where name='Water supply') where id=$1", [otherOfficer])
  await db.query("update public.profiles set role='administrator' where id=$1", [admin])
  await db.query('update public.profiles set is_active=false where id=$1', [inactive])
})
afterAll(async () => { await db?.close() })

describe('CF-04/05/06 complaint submission and CF-07/18 access', () => {
  it('routes a trimmed Citizen report and atomically creates initial history and update', async () => {
    const complaint = (await submit(citizen, randomUUID(), '  Damaged road with several deep potholes  ')).rows[0]
    expect(complaint).toMatchObject({ citizen_id: citizen, department_id: department, category_id: category, status: 'submitted', priority: 'normal', version: 1, description: 'Damaged road with several deep potholes' })
    const result = await db.query('select e.complaint_version,e.event_type,n.kind,n.recipient_id from public.complaint_events e join public.notifications n on n.event_id=e.id where e.complaint_id=$1', [complaint.id])
    expect(result.rows).toEqual([{ complaint_version: 1, event_type: 'submitted', kind: 'submission', recipient_id: citizen }])
  })
  it('returns the same record on retry and rejects the same key with changed input', async () => {
    const key = randomUUID(), first = (await submit(citizen, key)).rows[0]
    expect((await submit(citizen, key)).rows[0].id).toBe(first.id)
    await expect(submit(citizen, key, 'Different issue under the same request')).rejects.toThrow('request_reused')
    expect((await db.query('select id from public.complaint_events where complaint_id=$1', [first.id])).rows).toHaveLength(1)
    expect((await submit(other, key)).rows[0].citizen_id).toBe(other)
  })
  it.each([officer, otherOfficer, admin, inactive])('rejects submission by non-Citizen or inactive caller %s', async (user) => {
    await expect(submit(user)).rejects.toThrow('not_authorized')
  })
  it('denies anonymous execution rather than trusting client identity', async () => {
    await expect(asUser(db, null, () => db.query('select * from public.submit_complaint($1,$2,$3,0,0,$4)', [category, 'Anonymous report', 'Road', randomUUID()]))).rejects.toThrow('permission denied')
  })
  it.each(['short', ' '.repeat(20), 'a'.repeat(5001)])('enforces description bounds on the server', async (description) => {
    await expect(submit(citizen, randomUUID(), description)).rejects.toThrow('invalid_input')
  })
  it.each([[91, 80], [7, -181], ['NaN', 80], [7, 'Infinity']])('rejects invalid/nonfinite coordinate pair %s,%s', async (lat, lng) => {
    await expect(submit(citizen, randomUUID(), 'A valid detailed report', category, lat, lng)).rejects.toThrow('invalid_input')
  })
  it('accepts zero coordinates without treating them as absent', async () => { expect((await submit(citizen, randomUUID(), 'A valid detailed report', category, 0, 0)).rows).toHaveLength(1) })
  it('rejects inactive categories/departments but retains referenced lookup visibility', async () => {
    const complaint = (await submit()).rows[0]
    await db.query('update public.categories set is_active=false where id=$1', [category])
    await expect(submit()).rejects.toThrow('category_unavailable')
    expect((await asUser(db, citizen, () => db.query('select id from public.categories where id=$1', [category]))).rows).toHaveLength(1)
    expect((await asUser(db, otherOfficer, () => db.query('select id from public.categories where id=$1', [category]))).rows).toHaveLength(0)
    await db.query('update public.categories set is_active=true where id=$1', [category])
    await db.query('update public.departments set is_active=false where id=$1', [department])
    await expect(submit()).rejects.toThrow('category_unavailable')
    expect((await asUser(db, citizen, () => db.query('select id from public.complaints where id=$1', [complaint.id]))).rows).toHaveLength(1)
    await db.query('update public.departments set is_active=true where id=$1', [department])
  })
  it('rolls back complaint and event if the durable update fails', async () => {
    const request = randomUUID()
    await db.exec("create function private.test_fail_notification() returns trigger language plpgsql as $$ begin raise exception 'fixture_notification_failure'; end; $$; create trigger test_fail before insert on public.notifications for each row execute function private.test_fail_notification();")
    try {
      await expect(submit(citizen, request)).rejects.toThrow('fixture_notification_failure')
      expect((await db.query('select id from public.complaints where submission_request_id=$1', [request])).rows).toEqual([])
      expect((await db.query('select id from public.complaint_events e where not exists(select 1 from public.complaints c where c.id=e.complaint_id)')).rows).toEqual([])
    } finally { await db.exec('drop trigger test_fail on public.notifications; drop function private.test_fail_notification();') }
  })
  it('isolates Citizens and departments and applies parent permissions to history', async () => {
    const complaint = (await submit()).rows[0]
    for (const [user, allowed] of [[citizen, true], [other, false], [officer, true], [otherOfficer, false], [admin, true], [inactive, false]] as const) {
      const result = await asUser(db, user, () => db.query('select id from public.complaints where id=$1', [complaint.id]))
      const events = await asUser(db, user, () => db.query('select id from public.complaint_events where complaint_id=$1', [complaint.id]))
      expect(result.rows).toHaveLength(allowed ? 1 : 0); expect(events.rows).toHaveLength(allowed ? 1 : 0)
    }
    await expect(asUser(db, citizen, () => db.query("update public.complaints set status='resolved' where id=$1", [complaint.id]))).rejects.toThrow('permission denied')
    await expect(asUser(db, officer, () => db.query('delete from public.complaint_events where complaint_id=$1', [complaint.id]))).rejects.toThrow('permission denied')
  })
})

describe('CF-16 private evidence reservation/upload/finalization', () => {
  it('creates private bucket limits and server-generated owned paths', async () => {
    expect((await db.query('select public,file_size_limit,allowed_mime_types from storage.buckets')).rows).toEqual([{ public: false, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'application/pdf'] }])
    const complaint = (await submit()).rows[0], key = randomUUID()
    const evidence = (await reserve(complaint.id, citizen, key)).rows[0]
    expect(evidence.object_path).toBe(`${citizen}/${complaint.id}/${evidence.id}.pdf`)
    expect((await reserve(complaint.id, citizen, key)).rows[0].id).toBe(evidence.id)
    await expect(reserve(complaint.id, citizen, key, 10)).rejects.toThrow('request_reused')
  })
  it('denies foreign owner, Officer, Administrator and inactive reservations', async () => {
    const complaint = (await submit()).rows[0]
    for (const user of [other, officer, admin, inactive]) await expect(reserve(complaint.id, user)).rejects.toThrow('not_authorized')
  })
  it.each([[0, 'application/pdf'], [5242881, 'application/pdf'], [9, 'text/html']])('enforces declared size %s and MIME %s on server', async (size, type) => {
    const complaint = (await submit()).rows[0]
    await expect(reserve(complaint.id, citizen, randomUUID(), Number(size), String(type))).rejects.toThrow('invalid_evidence')
  })
  it('denies Storage writes to foreign, unreserved and spoofed-owner paths', async () => {
    const complaint = (await submit()).rows[0], evidence = (await reserve(complaint.id)).rows[0]
    await expect(upload(evidence, other)).rejects.toThrow('row-level security')
    await expect(upload({ ...evidence, object_path: `${citizen}/${complaint.id}/not-reserved.pdf` })).rejects.toThrow('row-level security')
    await expect(asUser(db, citizen, () => db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)', ['complaint-evidence', evidence.object_path, other]))).rejects.toThrow('row-level security')
    await expect(finalize(evidence.id)).rejects.toThrow('upload_missing')
    await expect(finalize(evidence.id, other)).rejects.toThrow('not_authorized')
  })
  it('verifies stored metadata then appends one immutable event and update exactly once', async () => {
    const complaint = (await submit()).rows[0], evidence = (await reserve(complaint.id)).rows[0]
    await upload(evidence, citizen, 8)
    await expect(finalize(evidence.id)).rejects.toThrow('invalid_evidence')
    expect((await db.query('select state from public.complaint_evidence where id=$1', [evidence.id])).rows[0]).toEqual({ state: 'pending' })
    await db.query('update storage.objects set metadata=$1 where name=$2', [{ size: 9, mimetype: 'image/jpeg' }, evidence.object_path])
    await expect(finalize(evidence.id)).rejects.toThrow('invalid_evidence')
    await db.query('update storage.objects set metadata=$1 where name=$2', [{ size: 9, mimetype: 'application/pdf' }, evidence.object_path])
    expect((await finalize(evidence.id)).rows[0].state).toBe('attached')
    expect((await finalize(evidence.id)).rows[0].state).toBe('attached')
    expect((await db.query('select version from public.complaints where id=$1', [complaint.id])).rows[0]).toEqual({ version: 2 })
    expect((await db.query('select id from public.complaint_events where complaint_id=$1', [complaint.id])).rows).toHaveLength(2)
    expect((await db.query('select id from public.notifications where complaint_id=$1', [complaint.id])).rows).toHaveLength(2)
    for (const [user, allowed] of [[citizen, true], [other, false], [officer, true], [otherOfficer, false], [admin, true], [inactive, false]] as const) {
      expect((await asUser(db, user, () => db.query('select id from storage.objects where name=$1', [evidence.object_path]))).rows).toHaveLength(allowed ? 1 : 0)
      expect((await asUser(db, user, () => db.query('select id from public.complaint_evidence where id=$1', [evidence.id]))).rows).toHaveLength(allowed ? 1 : 0)
    }
    expect((await asUser(db, citizen, () => db.query("update storage.objects set metadata='{}' where name=$1 returning id", [evidence.object_path]))).rows).toEqual([])
    expect((await asUser(db, citizen, () => db.query('delete from storage.objects where name=$1 returning id', [evidence.object_path]))).rows).toEqual([])
    await expect(upload(evidence)).rejects.toThrow('row-level security')
  })
  it('counts pending reservations toward the five-file limit and releases expired slots', async () => {
    const complaint = (await submit()).rows[0]
    const evidence = (await reserve(complaint.id)).rows[0]
    for (let i = 0; i < 4; i++) await reserve(complaint.id)
    await expect(reserve(complaint.id)).rejects.toThrow('evidence_limit')
    await db.query("update public.complaint_evidence set expires_at=now()-interval '1 minute' where id=$1", [evidence.id])
    await expect(upload(evidence)).rejects.toThrow('row-level security')
    await expect(finalize(evidence.id)).rejects.toThrow('reservation_expired')
    expect((await reserve(complaint.id)).rows).toHaveLength(1)
  })
  it('stops reservations, uploads and finalization when review has begun', async () => {
    const complaint = (await submit()).rows[0], evidence = (await reserve(complaint.id)).rows[0]
    await db.query("update public.complaints set status='under_review' where id=$1", [complaint.id])
    await expect(reserve(complaint.id)).rejects.toThrow('evidence_closed')
    await expect(upload(evidence)).rejects.toThrow('row-level security')
    await expect(finalize(evidence.id)).rejects.toThrow('evidence_closed')
  })
  it('rolls back attachment state and complaint version if its update fails', async () => {
    const complaint = (await submit()).rows[0], evidence = (await reserve(complaint.id)).rows[0]
    await upload(evidence)
    await db.exec("create function private.test_fail_evidence() returns trigger language plpgsql as $$ begin raise exception 'fixture_failure'; end; $$; create trigger test_fail before insert on public.notifications for each row execute function private.test_fail_evidence();")
    try {
      await expect(finalize(evidence.id)).rejects.toThrow('fixture_failure')
      expect((await db.query('select state from public.complaint_evidence where id=$1', [evidence.id])).rows[0]).toEqual({ state: 'pending' })
      expect((await db.query('select version from public.complaints where id=$1', [complaint.id])).rows[0]).toEqual({ version: 1 })
    } finally { await db.exec('drop trigger test_fail on public.notifications; drop function private.test_fail_evidence();') }
  })
})
