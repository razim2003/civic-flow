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
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb, is_anonymous boolean not null default false);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner_id text, metadata jsonb, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
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
