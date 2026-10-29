import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDatabase } from './harness'

// CR-006: every complaint reaches a responsible Officer (auto-assignment, notification, admin dispatch, analytics).
const citizen = randomUUID(), other = randomUUID(), roadA = randomUUID(), roadB = randomUUID(), waterOfficer = randomUUID(), admin = randomUUID(), inactiveAdmin = randomUUID()
let db: PGlite, road: { id: string; department_id: string }, water: { id: string; department_id: string }, transport: { id: string; department_id: string }
type Report = { id: string; status: string; version: number; assigned_officer_id: string | null; department_id: string; category_id: string }
const call = <T = Report>(name: string, args: unknown[], user: string | null) =>
  asUser(db, user, () => db.query<T>(`select * from public.${name}(${args.map((_, index) => `$${index + 1}`).join(',')})`, args))
const submit = (category: string, user = citizen) => call('submit_complaint', [category, 'Overflowing bins near a fictional market.', 'Sample Market', 6.03, 80.21, randomUUID()], user).then((result) => result.rows[0])
const dispatch = (args: unknown[], user = admin) => call('admin_dispatch_complaint', args, user)
const reason = 'Routed by the administrator for coverage.'

beforeAll(async () => {
  db = await createTestDatabase()
  const rows = (await db.query<{ id: string; department_id: string; name: string }>('select id,department_id,name from public.categories')).rows
  road = rows.find((row) => row.name === 'Road maintenance')!; water = rows.find((row) => row.name === 'Water supply')!; transport = rows.find((row) => row.name === 'Public transport')!
  for (const id of [citizen, other, roadA, roadB, waterOfficer, admin, inactiveAdmin]) await db.query('insert into auth.users(id) values($1)', [id])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=any($2::uuid[])", [road.department_id, [roadA, roadB]])
  await db.query("update public.profiles set role='officer',department_id=$1 where id=$2", [water.department_id, waterOfficer])
  await db.query("update public.profiles set role='administrator' where id=any($1::uuid[])", [[admin, inactiveAdmin]])
  await db.query('update public.profiles set is_active=false where id=$1', [inactiveAdmin])
})
afterAll(async () => { await db?.close() })

describe('CR-006 automatic, workload-balanced assignment on submission', () => {
  it('assigns the least-loaded active Officer of the routed department and notifies them', async () => {
    const first = await submit(road.id), second = await submit(road.id)
    expect(new Set([first.assigned_officer_id, second.assigned_officer_id])).toEqual(new Set([roadA, roadB]))
    const notified = await db.query<{ recipient_id: string; kind: string }>('select recipient_id,kind from public.notifications where complaint_id=$1 order by recipient_id', [first.id])
    expect(notified.rows.map((row) => row.recipient_id).sort()).toEqual([citizen, first.assigned_officer_id].sort())
    expect((await asUser(db, first.assigned_officer_id, () => db.query('select id from public.notifications where complaint_id=$1', [first.id]))).rows).toHaveLength(1)
    const event = await db.query<{ changes: { auto_assigned: boolean; assigned_officer_id: string } }>('select changes from public.complaint_events where complaint_id=$1', [first.id])
    expect(event.rows[0].changes).toMatchObject({ auto_assigned: true, assigned_officer_id: first.assigned_officer_id })
  })
  it('leaves complaints in an unstaffed department unassigned and never picks inactive Officers', async () => {
    await db.query('update public.profiles set is_active=false where id=$1', [waterOfficer])
    try {
      const report = await submit(water.id)
      expect(report.assigned_officer_id).toBeNull()
      expect((await db.query('select id from public.notifications where complaint_id=$1', [report.id])).rows).toHaveLength(1)
    } finally { await db.query('update public.profiles set is_active=true where id=$1', [waterOfficer]) }
  })
  it('keeps idempotent retries from reassigning', async () => {
    const key = randomUUID()
    const first = (await call('submit_complaint', [road.id, 'Cracked kerb near a fictional bus stop.', 'Sample Stop', 6, 80, key], citizen)).rows[0]
    const retry = (await call('submit_complaint', [road.id, 'Cracked kerb near a fictional bus stop.', 'Sample Stop', 6, 80, key], citizen)).rows[0]
    expect(retry).toMatchObject({ id: first.id, assigned_officer_id: first.assigned_officer_id, version: 1 })
  })
})

describe('CR-006 Officer assignment notifications', () => {
  it('notifies a newly assigned teammate but not an Officer who assigns themselves', async () => {
    const report = await submit(road.id)
    const self = report.assigned_officer_id!, teammate = self === roadA ? roadB : roadA
    await call('assign_complaint', [report.id, teammate, 1, ''], self)
    const rows = await db.query<{ recipient_id: string }>("select n.recipient_id from public.notifications n join public.complaint_events e on e.id=n.event_id where e.complaint_id=$1 and e.event_type='assigned'", [report.id])
    expect(rows.rows.map((row) => row.recipient_id).sort()).toEqual([citizen, teammate].sort())
    await call('assign_complaint', [report.id, self, 2, ''], self)
    const back = await db.query<{ recipient_id: string }>("select n.recipient_id from public.notifications n join public.complaint_events e on e.id=n.event_id where e.complaint_id=$1 and e.complaint_version=3", [report.id])
    expect(back.rows.map((row) => row.recipient_id)).toEqual([citizen])
  })
})

describe('CR-006 Administrator dispatch', () => {
  it('routes a stuck complaint to another department, assigns an Officer and records history and notifications', async () => {
    const stuck = await submit(transport.id)
    expect(stuck.assigned_officer_id).toBeNull()
    const routed = (await dispatch([stuck.id, water.department_id, water.id, waterOfficer, 1, `  ${reason}  `])).rows[0]
    expect(routed).toMatchObject({ department_id: water.department_id, category_id: water.id, assigned_officer_id: waterOfficer, version: 2 })
    const event = (await db.query<{ event_type: string; actor_id: string; remark: string; changes: { dispatched_by: string } }>('select event_type,actor_id,remark,changes from public.complaint_events where complaint_id=$1 and complaint_version=2', [stuck.id])).rows[0]
    expect(event).toMatchObject({ event_type: 'transferred', actor_id: admin, remark: reason, changes: { dispatched_by: 'administrator' } })
    const recipients = await db.query<{ recipient_id: string }>("select recipient_id from public.notifications n join public.complaint_events e on e.id=n.event_id where e.complaint_id=$1 and e.complaint_version=2", [stuck.id])
    expect(recipients.rows.map((row) => row.recipient_id).sort()).toEqual([citizen, waterOfficer].sort())
    expect((await asUser(db, waterOfficer, () => db.query('select id from public.complaints where id=$1', [stuck.id]))).rows).toHaveLength(1)
  })
  it('reassigns within the same department as an assignment event and treats an unchanged request as a no-op', async () => {
    const report = await submit(road.id)
    const target = report.assigned_officer_id === roadA ? roadB : roadA
    expect((await dispatch([report.id, road.department_id, road.id, target, 1, reason])).rows[0]).toMatchObject({ assigned_officer_id: target, version: 2 })
    expect((await db.query<{ event_type: string }>('select event_type from public.complaint_events where complaint_id=$1 and complaint_version=2', [report.id])).rows[0].event_type).toBe('assigned')
    expect((await dispatch([report.id, road.department_id, road.id, target, 2, reason])).rows[0].version).toBe(2)
  })
  it('validates reason, route, assignee, version and final states', async () => {
    const report = await submit(road.id)
    await expect(dispatch([report.id, road.department_id, road.id, null, 1, 'short'])).rejects.toThrow('reason_required')
    await expect(dispatch([report.id, water.department_id, road.id, null, 1, reason])).rejects.toThrow('category_unavailable')
    await expect(dispatch([report.id, water.department_id, water.id, roadA, 1, reason])).rejects.toThrow('invalid_assignee')
    await expect(dispatch([report.id, road.department_id, road.id, citizen, 1, reason])).rejects.toThrow('invalid_assignee')
    await expect(dispatch([report.id, road.department_id, road.id, null, 7, reason])).rejects.toMatchObject({ code: 'PT409', message: 'stale_version' })
    await expect(dispatch([report.id, road.department_id, road.id, null, null, reason])).rejects.toThrow('invalid_input')
    await call('withdraw_complaint', [report.id, 'The bins were emptied the same day.', 1], citizen)
    await expect(dispatch([report.id, water.department_id, water.id, waterOfficer, 2, reason])).rejects.toThrow('complaint_closed')
  })
  it('keeps work in progress in its department with an assignee', async () => {
    const report = await submit(road.id)
    const owner = report.assigned_officer_id!
    await call('review_complaint', [report.id, 1, ''], owner); await call('start_complaint', [report.id, 2, ''], owner)
    await expect(dispatch([report.id, water.department_id, water.id, waterOfficer, 3, reason])).rejects.toThrow('invalid_transition')
    await expect(dispatch([report.id, road.department_id, road.id, null, 3, reason])).rejects.toThrow('invalid_transition')
    const other = owner === roadA ? roadB : roadA
    expect((await dispatch([report.id, road.department_id, road.id, other, 3, reason])).rows[0]).toMatchObject({ status: 'in_progress', assigned_officer_id: other })
  })
  it.each([citizen, roadA, inactiveAdmin, null])('denies dispatch by non-Administrator or anonymous caller %s', async (user) => {
    const report = await submit(road.id)
    await expect(dispatch([report.id, water.department_id, water.id, null, 1, reason], user as string)).rejects.toThrow(user === null ? 'permission denied' : 'not_authorized')
  })
  it('rolls back the dispatch if a notification cannot be written', async () => {
    const report = await submit(transport.id)
    await db.exec("create function private.test_fail_dispatch() returns trigger language plpgsql as $$ begin raise exception 'fixture_notification_failure'; end $$; create trigger test_fail_dispatch before insert on public.notifications for each row execute function private.test_fail_dispatch();")
    try {
      await expect(dispatch([report.id, water.department_id, water.id, waterOfficer, 1, reason])).rejects.toThrow('fixture_notification_failure')
      expect((await db.query('select department_id,version from public.complaints where id=$1', [report.id])).rows[0]).toEqual({ department_id: transport.department_id, version: 1 })
    } finally { await db.exec('drop trigger test_fail_dispatch on public.notifications; drop function private.test_fail_dispatch();') }
  })
})

describe('CR-006 analytics and community impact', () => {
  it('gives Administrators coverage, workload, overdue and trend data', async () => {
    const stale = await submit(transport.id)
    await db.query("update public.complaints set created_at=now()-interval '30 days',priority='urgent' where id=$1", [stale.id])
    const data = (await asUser(db, admin, () => db.query<{ a: { status: Record<string, number>; overdue: number; departments: { name: string; officers: number; unassigned: number; overdue: number }[]; officers: { id: string; open: number }[]; trend: unknown[]; satisfaction: { count: number } } }>('select public.admin_analytics() as a'))).rows[0].a
    expect(data.status.submitted).toBeGreaterThan(0)
    expect(data.overdue).toBeGreaterThanOrEqual(1)
    const transportRow = data.departments.find((row) => row.name === 'Public transport')!
    expect(transportRow).toMatchObject({ officers: 0 })
    expect(transportRow.unassigned).toBeGreaterThanOrEqual(1)
    expect(transportRow.overdue).toBeGreaterThanOrEqual(1)
    expect(data.officers.map((row) => row.id).sort()).toEqual([roadA, roadB, waterOfficer].sort())
    expect(data.trend).toHaveLength(6)
    expect(data.satisfaction.count).toBe(0)
  })
  it.each([citizen, roadA, inactiveAdmin])('denies analytics to %s', async (user) => {
    await expect(asUser(db, user, () => db.query('select public.admin_analytics()'))).rejects.toThrow('not_authorized')
  })
  it('shares only aggregate community impact with active signed-in users', async () => {
    const impact = (await asUser(db, other, () => db.query<{ i: Record<string, unknown> }>('select public.community_impact() as i'))).rows[0].i
    expect(Object.keys(impact).sort()).toEqual(['avg_resolution_days', 'in_progress', 'resolved', 'resolved_last_30_days', 'satisfaction', 'total'])
    expect(Number(impact.total)).toBeGreaterThan(0)
    await expect(asUser(db, inactiveAdmin, () => db.query('select public.community_impact()'))).rejects.toThrow('not_authorized')
    await expect(asUser(db, null, () => db.query('select public.community_impact()'))).rejects.toThrow('permission denied')
  })
  it('keeps the private helpers unreachable from browser roles', async () => {
    await expect(asUser(db, admin, () => db.query('select private.pick_officer($1)', [road.department_id]))).rejects.toThrow('permission denied')
  })
})
