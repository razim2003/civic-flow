import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createTestDatabase } from './harness'

const account = '20000000-0000-4000-8000-000000000001'
const existingAdmin = '20000000-0000-4000-8000-000000000002'
const inactive = '20000000-0000-4000-8000-000000000003'
const anonymous = '20000000-0000-4000-8000-000000000004'
const blankName = '20000000-0000-4000-8000-000000000005'
let db: PGlite
let backfill: string

beforeAll(async () => {
  db = await createTestDatabase()
  backfill = await readFile(new URL('../migrations/20261019000300_backfill_existing_profiles.sql', import.meta.url), 'utf8')
  // Model identities that existed before the initial signup trigger was installed.
  await db.exec('alter table auth.users disable trigger on_auth_user_created')
  await db.query('insert into auth.users(id,raw_user_meta_data,is_anonymous) values($1,$2,false),($3,$4,true),($5,$6,false)', [
    account, { display_name: '  Existing Citizen  ', role: 'administrator', is_active: false },
    anonymous, { display_name: 'Anonymous' }, blankName, { display_name: '   ' },
  ])
  await db.exec('alter table auth.users enable trigger on_auth_user_created')
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4)', [existingAdmin, { display_name: 'Existing Admin' }, inactive, { display_name: 'Inactive Citizen' }])
  await db.query("update public.profiles set role='administrator' where id=$1", [existingAdmin])
  await db.query('update public.profiles set is_active=false where id=$1', [inactive])
  await db.exec(backfill)
})
afterAll(async () => { await db?.close() })

describe('existing-account profile repair', () => {
  it('creates a Citizen profile while ignoring privileged Auth metadata', async () => {
    const result = await db.query('select display_name,role,is_active,department_id from public.profiles where id=$1', [account])
    expect(result.rows[0]).toEqual({ display_name: 'Existing Citizen', role: 'citizen', is_active: true, department_id: null })
  })
  it('lets the existing account load its own profile through RLS', async () => {
    const result = await asUser(db, account, () => db.query<{ id: string }>('select id from public.profiles'))
    expect(result.rows).toEqual([{ id: account }])
  })
  it('preserves existing Administrator and inactive profiles', async () => {
    const admin = await db.query<{ role: string }>('select role from public.profiles where id=$1', [existingAdmin])
    const disabled = await db.query<{ is_active: boolean }>('select is_active from public.profiles where id=$1', [inactive])
    expect(admin.rows[0].role).toBe('administrator')
    expect(disabled.rows[0].is_active).toBe(false)
  })
  it('does not create an active application profile for anonymous identities', async () => {
    const result = await db.query('select id from public.profiles where id=$1', [anonymous])
    expect(result.rows).toHaveLength(0)
  })
  it('supplies a safe display-name fallback', async () => {
    const result = await db.query<{ display_name: string }>('select display_name from public.profiles where id=$1', [blankName])
    expect(result.rows[0].display_name).toBe('Citizen')
  })
  it('can be replayed without modifying existing profiles or Auth identities', async () => {
    const profiles = await db.query('select * from public.profiles order by id')
    const identities = await db.query('select * from auth.users order by id')
    await db.exec(backfill)
    expect((await db.query('select * from public.profiles order by id')).rows).toEqual(profiles.rows)
    expect((await db.query('select * from auth.users order by id')).rows).toEqual(identities.rows)
  })
})
