import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createTestDatabase } from './harness'

const ids = {
  citizen: '00000000-0000-4000-8000-000000000001',
  other: '00000000-0000-4000-8000-000000000002',
  admin: '00000000-0000-4000-8000-000000000003',
  officer: '00000000-0000-4000-8000-000000000004',
  otherOfficer: '00000000-0000-4000-8000-000000000005',
  inactive: '00000000-0000-4000-8000-000000000006',
}
const department = '10000000-0000-4000-8000-000000000001'
const otherDepartment = '10000000-0000-4000-8000-000000000002'
let db: PGlite

beforeAll(async () => {
  db = await createTestDatabase()
  await db.query('insert into public.departments(id,name) values($1,$2),($3,$4)', [department, 'Roads', otherDepartment, 'Water'])
  for (const [name, id] of Object.entries(ids)) {
    // All accounts enter via the real signup trigger, including forged role metadata.
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { display_name: name, role: 'administrator', is_active: false, department_id: department }])
  }
  await db.query("update public.profiles set role='administrator' where id=$1", [ids.admin])
  await db.query("update public.profiles set role='officer', department_id=$2 where id=$1", [ids.officer, department])
  await db.query("update public.profiles set role='officer', department_id=$2 where id=$1", [ids.otherOfficer, otherDepartment])
  await db.query('update public.profiles set is_active=false where id=$1', [ids.inactive])
})
afterAll(async () => { await db?.close() })

describe('migrations, grants and RLS running inside PostgreSQL', () => {
  it('ignores all privileged signup metadata', async () => {
    const result = await db.query('select role,is_active,department_id from public.profiles where id=$1', [ids.citizen])
    expect(result.rows[0]).toMatchObject({ role: 'citizen', is_active: true, department_id: null })
  })
  it('enables RLS on all application tables', async () => {
    const result = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'")
    expect(result.rows).toHaveLength(9)
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true)
  })
  it('denies anonymous table reads and profile mutations', async () => {
    await expect(asUser(db, null, () => db.query('select * from public.profiles'))).rejects.toThrow('permission denied')
    await expect(asUser(db, null, () => db.query("select * from public.update_my_profile('Attacker')"))).rejects.toThrow('permission denied')
  })
  it.each([ids.citizen, ids.other, ids.officer, ids.otherOfficer])('shows only the active caller profile to %s', async (id) => {
    const result = await asUser(db, id, () => db.query<{ id: string }>('select id from public.profiles'))
    expect(result.rows.map((row) => row.id)).toEqual([id])
  })
  it('allows an administrator to read application profiles, including inactive users', async () => {
    const result = await asUser(db, ids.admin, () => db.query('select id from public.profiles'))
    expect(result.rows).toHaveLength(6)
  })
  it('denies direct privilege escalation, deletion and private audit reads', async () => {
    await expect(asUser(db, ids.citizen, () => db.query("update public.profiles set role='administrator' where id=$1", [ids.citizen]))).rejects.toThrow('permission denied')
    await expect(asUser(db, ids.admin, () => db.query('delete from public.profiles where id=$1', [ids.other]))).rejects.toThrow('permission denied')
    await expect(asUser(db, ids.admin, () => db.query('select * from private.admin_audit_events'))).rejects.toThrow('permission denied')
  })
  it('permits a bounded display-name change without changing role', async () => {
    const result = await asUser(db, ids.citizen, () => db.query<{ display_name: string; role: string }>('select * from public.update_my_profile($1)', ['Updated Citizen']))
    expect(result.rows[0]).toMatchObject({ display_name: 'Updated Citizen', role: 'citizen' })
    await expect(asUser(db, ids.citizen, () => db.query('select * from public.update_my_profile($1)', [' ']))).rejects.toThrow('invalid_input')
  })
  it('denies inactive users even with an existing user claim', async () => {
    const result = await asUser(db, ids.inactive, () => db.query('select * from public.profiles'))
    expect(result.rows).toHaveLength(0)
    await expect(asUser(db, ids.inactive, () => db.query("select * from public.update_my_profile('Still here')"))).rejects.toThrow('not_authorized')
  })
  it('rejects non-admin RPC calls even when crafted outside the UI', async () => {
    await expect(asUser(db, ids.officer, () => db.query('select * from public.admin_update_user($1,$2,$3,$4,$5)', [ids.citizen, 'administrator', null, true, 'Escalated']))).rejects.toThrow('not_authorized')
  })
  it('requires an active department when promoting an Officer and records an audit event', async () => {
    await expect(asUser(db, ids.admin, () => db.query('select * from public.admin_update_user($1,$2,$3,$4,$5)', [ids.other, 'officer', null, true, 'Other Citizen']))).rejects.toThrow('invalid_input')
    await asUser(db, ids.admin, () => db.query('select * from public.admin_update_user($1,$2,$3,$4,$5)', [ids.other, 'officer', department, true, 'New Officer']))
    const audit = await db.query<{ actor_id: string; target_id: string }>('select actor_id,target_id from private.admin_audit_events')
    expect(audit.rows).toEqual([{ actor_id: ids.admin, target_id: ids.other }])
  })
  it('preserves the last active administrator and rolls back failed admin changes', async () => {
    const before = await db.query('select * from private.admin_audit_events')
    await expect(asUser(db, ids.admin, () => db.query('select * from public.admin_update_user($1,$2,$3,$4,$5)', [ids.admin, 'citizen', null, true, 'Demoted']))).rejects.toThrow('last_administrator')
    await expect(asUser(db, ids.admin, () => db.query('select * from public.admin_update_user($1,$2,$3,$4,$5)', [ids.admin, 'administrator', null, false, 'Disabled']))).rejects.toThrow('last_administrator')
    const after = await db.query('select * from private.admin_audit_events')
    expect(after.rows).toEqual(before.rows)
    expect((await db.query<{ role: string }>('select role from public.profiles where id=$1', [ids.admin])).rows[0].role).toBe('administrator')
  })
  it('deactivation immediately revokes reads and writes for the old claim', async () => {
    await asUser(db, ids.admin, () => db.query('select * from public.admin_update_user($1,$2,$3,$4,$5)', [ids.other, 'officer', department, false, 'Disabled Officer']))
    expect((await asUser(db, ids.other, () => db.query('select * from public.departments'))).rows).toHaveLength(0)
    await expect(asUser(db, ids.other, () => db.query("select * from public.update_my_profile('Old JWT')"))).rejects.toThrow('not_authorized')
  })
  it.each(['complaints','complaint_events','complaint_evidence','complaint_feedback','notifications'])('keeps future feature table %s inaccessible until its policies ship', async (table) => {
    await expect(asUser(db, ids.admin, () => db.query(`select * from public.${table}`))).rejects.toThrow('permission denied')
  })
})
