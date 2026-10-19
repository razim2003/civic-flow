import { PGlite } from '@electric-sql/pglite'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** Disposable PostgreSQL engine. Auth schema/UID is a fixture, not Supabase Auth. */
export async function createTestDatabase() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `)
  const folder = fileURLToPath(new URL('../migrations/', import.meta.url))
  for (const file of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`${folder}/${file}`, 'utf8'))
  }
  return db
}

export async function asUser<T>(db: PGlite, userId: string | null, action: () => Promise<T>): Promise<T> {
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userId ?? ''])
  await db.exec(userId ? 'set role authenticated' : 'set role anon')
  try { return await action() }
  finally { await db.exec('reset role'); await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']) }
}
