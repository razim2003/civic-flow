import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createTestDatabase } from './harness'

let db: PGlite, operation: string
const target = randomUUID(), another = randomUUID()
beforeAll(async () => {
  db = await createTestDatabase()
  await db.exec('alter table auth.users add column email_confirmed_at timestamptz;')
  for (const id of [target, another]) await db.query('insert into auth.users(id) values($1)', [id])
  operation = await readFile(new URL('../operations/bootstrap-administrator.sql', import.meta.url), 'utf8')
})
afterAll(async () => { await db?.close() })
async function bootstrap(id: string) {
  await db.query("select set_config('civicflow.bootstrap_user_id',$1,false)", [id])
  try { await db.exec(operation) }
  catch (error) { await db.exec('rollback'); throw error }
}
it('requires an explicitly identified, verified, active account and bootstraps once with an audit', async () => {
  await expect(bootstrap('')).rejects.toThrow('explicit_account_required')
  await expect(bootstrap(target)).rejects.toThrow('verified_account_required')
  await db.query('update auth.users set email_confirmed_at=now()')
  await db.query('update public.profiles set is_active=false where id=$1', [target])
  await expect(bootstrap(target)).rejects.toThrow('active_profile_required')
  await db.query('update public.profiles set is_active=true where id=$1', [target])
  await bootstrap(target)
  expect((await db.query('select role,department_id,is_active from public.profiles where id=$1', [target])).rows[0]).toEqual({ role: 'administrator', department_id: null, is_active: true })
  expect((await db.query('select action,changes from private.admin_audit_events where target_id=$1', [target])).rows[0]).toMatchObject({ action: 'user_updated', changes: { source: 'user_authorized_operator_bootstrap', before: { role: 'citizen' }, after: { role: 'administrator' } } })
  await bootstrap(target)
  expect((await db.query('select id from private.admin_audit_events where target_id=$1', [target])).rows).toHaveLength(1)
  await expect(bootstrap(another)).rejects.toThrow('first_administrator_only')
})
