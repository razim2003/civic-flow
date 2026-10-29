import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDatabase } from './harness'

const citizen = randomUUID(), other = randomUUID(), officer = randomUUID(), otherOfficer = randomUUID(), admin = randomUUID(), inactive = randomUUID()
const reason = 'The service team fixed the issue before further action was needed.'
let db: PGlite, category: string, department: string
type Complaint = { id: string; status: string; version: number; withdrawal_reason: string | null; withdrawn_at: Date | null; withdrawn_by: string | null; assigned_officer_id: string | null }
const withdraw = (id: string, user: string | null = citizen, explanation: string | null = reason, version: number | null = 1) => asUser(db, user, () => db.query<Complaint>('select * from public.withdraw_complaint($1,$2,$3)', [id, explanation, version]))
async function create(status = 'submitted') {
  const result = await asUser(db, citizen, () => db.query<Complaint>('select * from public.submit_complaint($1,$2,$3,7,80,$4)', [category, 'A damaged public road near the school.', 'School Road', randomUUID()]))
  const complaint = result.rows[0]
  if (status === 'resolved') await db.query("update public.complaints set status='resolved',assigned_officer_id=$2,resolved_by=$2,resolved_at=now(),resolution_text='Road surface has been repaired.' where id=$1", [complaint.id, officer])
  else if (status !== 'submitted') await db.query('update public.complaints set status=$2,assigned_officer_id=$3 where id=$1', [complaint.id, status, officer])
  return complaint.id
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

describe('CF-22 owner withdrawal with retained audit history', () => {
  it.each(['submitted', 'under_review', 'in_progress'])('withdraws %s, records reason/actor/time, releases assignment and notifies atomically', async (status) => {
    const id = await create(status)
    const result = (await withdraw(id, citizen, `  ${reason}  `)).rows[0]
    expect(result).toMatchObject({ status: 'withdrawn', version: 2, withdrawal_reason: reason, withdrawn_by: citizen, assigned_officer_id: null })
    expect(result.withdrawn_at).not.toBeNull()
    const events = await db.query('select e.event_type,e.remark,e.actor_id,e.changes,n.kind from public.complaint_events e join public.notifications n on n.event_id=e.id where e.complaint_id=$1 and e.complaint_version=2', [id])
    expect(events.rows[0]).toMatchObject({ event_type: 'withdrawn', remark: reason, actor_id: citizen, kind: 'progress', changes: { before: { status }, after: { status: 'withdrawn', assigned_officer_id: null } } })
    expect((await asUser(db, citizen, () => db.query('select id from public.complaint_events where complaint_id=$1', [id]))).rows).toHaveLength(2)
  })
  it.each([other, officer, otherOfficer, admin, inactive])('denies withdrawal by foreign/non-Citizen/inactive caller %s', async (user) => {
    await expect(withdraw(await create(), user)).rejects.toThrow('not_authorized')
  })
  it('denies anonymous execution and avoids revealing unknown versus foreign references', async () => {
    await expect(withdraw(await create(), null)).rejects.toThrow('permission denied')
    await expect(withdraw(randomUUID())).rejects.toThrow('not_authorized')
  })
  it.each([null, '', 'short', ' '.repeat(30), 'x'.repeat(2001)])('requires a bounded meaningful reason', async (explanation) => {
    await expect(withdraw(await create(), citizen, explanation)).rejects.toThrow('invalid_withdrawal')
  })
  it.each([null, 0, -1, 9007199254740992])('rejects invalid expected version %s', async (version) => {
    await expect(withdraw(await create(), citizen, reason, version)).rejects.toThrow('invalid_withdrawal')
  })
  it('rejects stale writes and resolved complaints without changing their records', async () => {
    const id = await create()
    await db.query('update public.complaints set version=2 where id=$1', [id])
    await expect(withdraw(id)).rejects.toMatchObject({ code: 'PT409', message: 'stale_version' })
    expect((await db.query('select status,withdrawal_reason,version from public.complaints where id=$1', [id])).rows[0]).toEqual({ status: 'submitted', withdrawal_reason: null, version: 2 })
    const resolved = await create('resolved')
    await expect(withdraw(resolved)).rejects.toThrow('withdrawal_closed')
    expect((await db.query('select status,resolution_text from public.complaints where id=$1', [resolved])).rows[0]).toEqual({ status: 'resolved', resolution_text: 'Road surface has been repaired.' })
  })
  it('safely resumes a lost response and never duplicates history or changes a withdrawal reason', async () => {
    const id = await create(), first = (await withdraw(id)).rows[0]
    expect((await withdraw(id)).rows[0]).toEqual(first)
    expect((await db.query('select id from public.complaint_events where complaint_id=$1', [id])).rows).toHaveLength(2)
    expect((await db.query('select id from public.notifications where complaint_id=$1 and recipient_id=$2', [id, citizen])).rows).toHaveLength(2)
    await expect(withdraw(id, citizen, 'A different withdrawal reason')).rejects.toThrow('withdrawal_closed')
    await expect(withdraw(id, citizen, reason, 2)).rejects.toThrow('withdrawal_closed')
  })
  it('retains existing evidence/download access while blocking new uploads and finalization', async () => {
    const id = await create()
    const reserve = async () => (await asUser(db, citizen, () => db.query<{ id: string; object_path: string }>('select * from public.reserve_evidence($1,$2,$3,9,$4)', [id, 'sample.pdf', 'application/pdf', randomUUID()]))).rows[0]
    const attached = await reserve(), pending = await reserve()
    await asUser(db, citizen, () => db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)', ['complaint-evidence', attached.object_path, citizen, { size: 9, mimetype: 'application/pdf' }]))
    await asUser(db, citizen, () => db.query('select * from public.finalize_evidence($1)', [attached.id]))
    await withdraw(id, citizen, reason, 2)
    expect((await asUser(db, citizen, () => db.query('select id from storage.objects where name=$1', [attached.object_path]))).rows).toHaveLength(1)
    expect((await asUser(db, other, () => db.query('select id from storage.objects where name=$1', [attached.object_path]))).rows).toHaveLength(0)
    await expect(reserve()).rejects.toThrow('evidence_closed')
    await expect(asUser(db, citizen, () => db.query('select * from public.finalize_evidence($1)', [pending.id]))).rejects.toThrow('evidence_closed')
    await expect(asUser(db, citizen, () => db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)', ['complaint-evidence', pending.object_path, citizen, { size: 9, mimetype: 'application/pdf' }]))).rejects.toThrow('row-level security')
    expect((await db.query('select id from public.complaint_evidence where complaint_id=$1', [id])).rows).toHaveLength(2)
  })
  it('denies direct mutation and enforces withdrawal field constraints', async () => {
    const id = await create()
    await expect(asUser(db, citizen, () => db.query("update public.complaints set status='withdrawn' where id=$1", [id]))).rejects.toThrow('permission denied')
    await expect(db.query("update public.complaints set status='withdrawn' where id=$1", [id])).rejects.toThrow('complaints_withdrawal_fields')
    await expect(db.query('update public.complaints set withdrawal_reason=$2 where id=$1', [id, reason])).rejects.toThrow('complaints_withdrawal_fields')
  })
  it('rolls back all withdrawal effects if the notification cannot be written', async () => {
    const id = await create()
    await db.exec("create function private.test_fail_withdrawal() returns trigger language plpgsql as $$ begin raise exception 'fixture_notification_failure'; end; $$; create trigger test_fail before insert on public.notifications for each row execute function private.test_fail_withdrawal();")
    try {
      await expect(withdraw(id)).rejects.toThrow('fixture_notification_failure')
      expect((await db.query('select status,withdrawal_reason,withdrawn_by,withdrawn_at,version from public.complaints where id=$1', [id])).rows[0]).toEqual({ status: 'submitted', withdrawal_reason: null, withdrawn_by: null, withdrawn_at: null, version: 1 })
      expect((await db.query('select id from public.complaint_events where complaint_id=$1', [id])).rows).toHaveLength(1)
    } finally { await db.exec('drop trigger test_fail on public.notifications; drop function private.test_fail_withdrawal();') }
  })
})
