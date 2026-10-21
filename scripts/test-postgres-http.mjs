// Dedicated disposable containers only. Never reads .env or contacts hosted Supabase.
// Auth issues real user JWTs; PostgREST verifies them and executes the real RLS/RPCs.
// Storage is a SQL metadata fixture: this does not test the Storage HTTP service.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const exec = promisify(execFile)
const images = { db: 'postgis/postgis:17-3.5', auth: 'public.ecr.aws/supabase/gotrue:v2.197.0', rest: 'public.ecr.aws/supabase/postgrest:v14.18' }
const runId = `civicflow-test-${randomUUID().slice(0, 8)}`, folder = resolve('tmp', runId)
const containers = [], files = []
let networkCreated = false, checks = 0
const secret = randomBytes(48).toString('hex'), password = randomBytes(24).toString('hex')
const docker = async (...args) => (await exec('docker', args, { maxBuffer: 4 * 1024 * 1024 })).stdout.trim()
const pause = () => new Promise((resolve) => setTimeout(resolve, 500))
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 60; attempt++) { try { if (await check()) return } catch { /* Wait for this newly created service only. */ } await pause() }
  throw new Error(`${label} did not become ready in 30 seconds`)
}
async function start(kind, values, port, extra = []) {
  const env = resolve(folder, `${kind}.env`); files.push(env)
  await writeFile(env, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'))
  const name = `${runId}-${kind}`
  const id = await docker('run', '--detach', '--name', name, '--network', runId, '--label', `civicflow.test=${runId}`, '--env-file', env, ...(port ? ['--publish', `127.0.0.1::${port}`] : []), ...extra, images[kind])
  containers.push(id)
  let address = ''
  if (port) {
    try { address = await docker('port', id, `${port}/tcp`) }
    catch {
      const logs = await exec('docker', ['logs', id])
      process.stdout.write((logs.stdout + logs.stderr).replaceAll(password, '[fixture secret]').replaceAll(secret, '[fixture secret]').slice(-5000))
      throw new Error(`${kind} exited before publishing its test port`)
    }
  }
  return { id, url: address ? `http://${address}` : '' }
}
let db
async function sql(statement) {
  const file = resolve(folder, `${randomUUID()}.sql`); files.push(file)
  await writeFile(file, statement)
  await docker('cp', file, `${db.id}:/tmp/civicflow-check.sql`)
  return docker('exec', db.id, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/civicflow-check.sql')
}
function jwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`
}
function passed(label) { checks++; process.stdout.write(`PASS ${label}\n`) }
try {
  for (const image of Object.values(images)) await docker('image', 'inspect', image)
  process.stdout.write('Preparing dedicated local PostgreSQL/Auth fixtures.\n')
  await mkdir(folder, { recursive: true })
  await docker('network', 'create', '--label', `civicflow.test=${runId}`, runId); networkCreated = true
  db = await start('db', { POSTGRES_PASSWORD: password, POSTGRES_DB: 'postgres' }, null, ['--network-alias', 'db', '--tmpfs', '/var/lib/postgresql/data'])
  // The entrypoint briefly starts a socket-only initialization server; Auth
  // must wait for the final TCP listener before attempting its migrations.
  await waitFor(async () => (await docker('exec', db.id, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres')).includes('accepting connections'), 'PostgreSQL')
  await sql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role authenticator login noinherit password '${password}';
    grant anon,authenticated,service_role to authenticator;
    create role supabase_auth_admin login createrole password '${password}';
    create schema auth authorization supabase_auth_admin;
    alter role supabase_auth_admin set search_path=auth;
    grant all on database postgres to supabase_auth_admin;
    create extension if not exists pgcrypto;
  `)
  const auth = await start('auth', {
    GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://127.0.0.1',
    GOTRUE_SITE_URL: 'http://127.0.0.1:5173', GOTRUE_DB_DRIVER: 'postgres',
    GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${password}@db:5432/postgres?sslmode=disable`,
    GOTRUE_DB_NAMESPACE: 'auth', GOTRUE_JWT_SECRET: secret, GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true',
  }, 9999)
  try { await waitFor(async () => (await fetch(`${auth.url}/health`)).ok, 'Supabase Auth') }
  catch (error) {
    const logs = await exec('docker', ['logs', auth.id])
    process.stdout.write((logs.stdout + logs.stderr).replaceAll(password, '[fixture secret]').replaceAll(secret, '[fixture secret]').slice(-5000))
    throw error
  }
  process.stdout.write('Local Auth ready; applying application migrations.\n')
  await sql(`
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,owner_id text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
  `)
  for (const name of (await readdir('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()) await sql(await readFile(`supabase/migrations/${name}`, 'utf8'))
  const rest = await start('rest', { PGRST_DB_URI: `postgres://authenticator:${password}@db:5432/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: secret }, 3000)
  await waitFor(async () => (await fetch(rest.url)).ok, 'PostgREST')
  async function createUser(name) {
    const email = `${name}@example.test`
    const created = await fetch(`${auth.url}/admin/users`, { method: 'POST', headers: { Authorization: `Bearer ${jwt('service_role')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: name, role: 'administrator' } }) })
    assert.equal(created.status, 200, `fixture identity creation (${name}) failed`)
    const user = await created.json()
    const loggedIn = await fetch(`${auth.url}/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    assert.equal(loggedIn.status, 200, `fixture login (${name}) failed`)
    const session = await loggedIn.json()
    return { id: user.id, token: session.access_token }
  }
  const actors = {}
  for (const name of ['citizen', 'otherCitizen', 'officer', 'teammate', 'foreignOfficer', 'administrator', 'inactive']) actors[name] = await createUser(name)
  async function api(path, user, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(`${rest.url}/${path}`, { signal: AbortSignal.timeout(20000), method, headers: { ...(user ? { Authorization: `Bearer ${user.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null }
  }
  const { citizen, otherCitizen, officer, teammate, foreignOfficer, administrator, inactive } = actors
  assert.equal((await api('profiles?select=role', citizen)).body[0].role, 'citizen')
  passed('real Auth signup trigger ignores forged Administrator metadata')
  const categories = (await api('categories?select=id,department_id,name', citizen)).body
  const road = categories.find((row) => row.name === 'Road maintenance'), water = categories.find((row) => row.name === 'Water supply')
  await sql(`update public.profiles set role='officer',department_id='${road.department_id}' where id in ('${officer.id}','${teammate.id}','${inactive.id}'); update public.profiles set role='officer',department_id='${water.department_id}' where id='${foreignOfficer.id}'; update public.profiles set role='administrator' where id='${administrator.id}'; update public.profiles set is_active=false where id='${inactive.id}';`)
  const rpc = (name, user, body) => api(`rpc/${name}`, user, body)
  const submit = async (user = citizen) => {
    const result = await rpc('submit_complaint', user, { p_category_id: road.id, p_description: 'A fictional road surface needs repair.', p_location_text: 'Sample Road', p_latitude: 7, p_longitude: 80, p_request_id: randomUUID() })
    assert.equal(result.status, 200); return result.body[0]
  }
  const report = await submit()
  assert.equal((await rpc('withdraw_complaint', citizen, { p_complaint_id: report.id, p_expected_version: 2, p_reason: 'The issue no longer needs further action.' })).status, 409)
  passed('stale Citizen withdrawal returns one non-retrying HTTP 409')
  for (const user of [otherCitizen, foreignOfficer, inactive]) assert.deepEqual((await api(`complaints?id=eq.${report.id}`, user)).body, [])
  for (const user of [citizen, officer, teammate, administrator]) assert.equal((await api(`complaints?id=eq.${report.id}`, user)).body.length, 1)
  assert.equal((await api(`complaints?id=eq.${report.id}`, null)).status, 401)
  assert.equal((await api(`complaints?id=eq.${report.id}`, officer, { status: 'resolved' }, 'PATCH')).status, 403)
  passed('verified non-privileged JWTs enforce owner, department, inactive and direct-DML boundaries')
  for (const user of [citizen, otherCitizen, foreignOfficer, administrator, inactive]) assert.equal((await rpc('review_complaint', user, { p_id: report.id, p_expected_version: 1, p_remark: '' })).status, 403)
  assert.equal((await rpc('review_complaint', null, { p_id: report.id, p_expected_version: 1, p_remark: '' })).status, 401)
  passed('direct HTTP workflow attempts deny all unauthorized roles')
  const race = await Promise.all([officer, teammate].map((user) => rpc('review_complaint', user, { p_id: report.id, p_expected_version: 1, p_remark: 'Review the fictional report.' })))
  assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]) // Application conflicts must not trigger transaction retries.
  assert.equal(race.find((result) => result.status !== 200).body.message, 'stale_version')
  assert.equal((await api(`complaint_events?complaint_id=eq.${report.id}`, citizen)).body.length, 2)
  passed('concurrent review permits exactly one write and one history event')
  const expected = (version) => ({ p_id: report.id, p_expected_version: version })
  assert.equal((await rpc('assign_complaint', officer, { ...expected(2), p_officer_id: officer.id, p_reason: '' })).status, 200)
  assert.equal((await rpc('start_complaint', teammate, { ...expected(3), p_remark: '' })).status, 403)
  assert.equal((await rpc('start_complaint', officer, { ...expected(3), p_remark: '' })).status, 200)
  assert.equal((await rpc('add_progress', officer, { ...expected(4), p_remark: 'Repairs are underway.' })).status, 200)
  assert.equal((await rpc('resolve_complaint', officer, { ...expected(5), p_resolution_text: 'short' })).status, 400)
  const finalRace = await Promise.all([
    rpc('resolve_complaint', officer, { ...expected(5), p_resolution_text: 'The surface has been repaired and checked.' }),
    rpc('withdraw_complaint', citizen, { p_complaint_id: report.id, p_expected_version: 5, p_reason: 'The issue no longer needs further attention.' }),
  ])
  assert.equal(finalRace.filter((result) => result.status === 200).length, 1)
  const finalReport = (await api(`complaints?id=eq.${report.id}`, citizen)).body[0]
  assert.ok(['resolved', 'withdrawn'].includes(finalReport.status)); assert.equal(finalReport.version, 6)
  assert.equal((await api(`complaint_events?complaint_id=eq.${report.id}`, citizen)).body.length, 6)
  passed('assigned lifecycle and concurrent resolution/withdrawal preserve one final result')
  const transfer = await submit()
  assert.equal((await rpc('transfer_complaint', officer, { p_id: transfer.id, p_expected_version: 1, p_category_id: water.id, p_department_id: water.department_id, p_reason: 'The water department should handle this report.' })).status, 200)
  assert.deepEqual((await api(`complaints?id=eq.${transfer.id}`, officer)).body, [])
  assert.equal((await api(`complaints?id=eq.${transfer.id}`, foreignOfficer)).body.length, 1)
  passed('transfer immediately changes department read access')
  const auditTarget = await submit()
  await sql(`create function private.test_fail_notification() returns trigger language plpgsql as $$ begin raise exception 'fixture_notification_failure'; end $$; create trigger test_fail_notification before insert on public.notifications for each row execute function private.test_fail_notification();`)
  assert.equal((await rpc('review_complaint', officer, { p_id: auditTarget.id, p_expected_version: 1, p_remark: '' })).status, 400)
  const unchanged = (await api(`complaints?id=eq.${auditTarget.id}`, citizen)).body[0]
  assert.equal(unchanged.status, 'submitted'); assert.equal(unchanged.version, 1)
  assert.equal((await api(`complaint_events?complaint_id=eq.${auditTarget.id}`, citizen)).body.length, 1)
  passed('a failed notification rolls back the status and history transaction')
  const secondAdmin = await createUser('secondAdministrator')
  await sql(`update public.profiles set role='administrator' where id='${secondAdmin.id}'`)
  const administrationRace = await Promise.all([[administrator, secondAdmin], [secondAdmin, administrator]].map(([actor, target]) => rpc('admin_update_user', actor, { p_target_id: target.id, p_role: 'administrator', p_department_id: null, p_is_active: false, p_display_name: 'Synthetic Administrator' })))
  assert.deepEqual(administrationRace.map((result) => result.status).sort(), [200, 403])
  assert.equal(await sql("select count(*) from public.profiles where role='administrator' and is_active"), '1')
  passed('concurrent Administrator deactivation retains one active Administrator')
  process.stdout.write(`${checks} PostgreSQL/Auth/PostgREST integration checks passed. Storage HTTP and Edge runtime are not covered.\n`)
} finally {
  // Only containers whose IDs were returned by this invocation can be stopped.
  for (const id of [...containers].reverse()) {
    try { await docker('stop', '--time', '5', id); await docker('rm', id) }
    catch { /* Only this invocation's disposable fixtures are eligible for cleanup. */ }
  }
  if (networkCreated) await docker('network', 'rm', runId)
  for (const file of files) { try { await unlink(file) } catch { /* No persisted application data is touched. */ } }
}
