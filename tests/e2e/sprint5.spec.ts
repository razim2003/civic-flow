import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { capture } from './capture'

// CR-006 journeys: dispatch, analytics, Officer map/inbox, landing, theme and service targets. Fictional data; Supabase is intercepted.
const user = '00000000-0000-4000-8000-000000000001', citizen = '00000000-0000-4000-8000-000000000002', officerB = '00000000-0000-4000-8000-000000000003'
const road = '20000000-0000-4000-8000-000000000001', water = '20000000-0000-4000-8000-000000000002', transport = '20000000-0000-4000-8000-000000000003'
const roadCat = '10000000-0000-4000-8000-000000000001', waterCat = '10000000-0000-4000-8000-000000000002', transportCat = '10000000-0000-4000-8000-000000000003'
const stuck = '30000000-0000-4000-8000-000000000001', owned = '30000000-0000-4000-8000-000000000002'
const old = new Date(Date.now() - 10 * 86_400_000).toISOString(), recent = new Date(Date.now() - 3_600_000).toISOString()
const blankTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=', 'base64')
const complaint = (id: string, department: string, category: string, assigned: string | null, createdAt: string, extra: Record<string, unknown> = {}) => ({ id, citizen_id: citizen, category_id: category, department_id: department, assigned_officer_id: assigned, description: 'Bus shelter roof collapsed near a fictional junction.', location_text: 'Sample Junction', latitude: 6.05, longitude: 80.22, status: 'submitted', priority: 'normal', resolution_text: null, resolved_at: null, withdrawal_reason: null, withdrawn_at: null, withdrawn_by: null, version: 1, created_at: createdAt, updated_at: createdAt, ...extra })

async function fixture(page: Page, role: 'administrator' | 'officer') {
  const now = Math.floor(Date.now() / 1000)
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'), 'synthetic-signature'].join('.')
  const reports = [complaint(stuck, transport, transportCat, null, old), complaint(owned, road, roadCat, role === 'officer' ? user : officerB, recent, { priority: 'urgent', latitude: 6.03, longitude: 80.25 })]
  const calls: { name: string; input: Record<string, unknown> }[] = []
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: blankTile }))
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url())
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    const counted = (rows: unknown[]) => route.fulfill({ headers: { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0', 'access-control-expose-headers': 'content-range' }, json: request.method() === 'HEAD' ? null : rows })
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: user, aud: 'authenticated', role: 'authenticated', email: 'person@example.test', app_metadata: {}, user_metadata: {}, identities: [], created_at: old } } })
    if (url.pathname === '/rest/v1/profiles') {
      if (url.searchParams.get('role') === 'eq.officer') return route.fulfill({ json: [{ id: officerB, display_name: 'Nimal Officer', department_id: road }] })
      return route.fulfill({ json: [{ id: user, role, display_name: 'Alex Perera', department_id: role === 'officer' ? road : null, is_active: true, created_at: old, updated_at: old }] })
    }
    if (url.pathname === '/rest/v1/departments') return route.fulfill({ json: [{ id: road, name: 'Road maintenance', is_active: true }, { id: water, name: 'Water supply', is_active: true }, { id: transport, name: 'Public transport', is_active: true }] })
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: [{ id: roadCat, name: 'Road maintenance', description: null, department_id: road, is_active: true }, { id: waterCat, name: 'Water supply', description: null, department_id: water, is_active: true }, { id: transportCat, name: 'Public transport', description: null, department_id: transport, is_active: true }] })
    if (url.pathname === '/rest/v1/complaints') {
      let rows = reports.filter((row) => ['submitted', 'under_review', 'in_progress'].includes(row.status))
      const department = url.searchParams.get('department_id'); if (department) rows = rows.filter((row) => `eq.${row.department_id}` === department)
      const id = url.searchParams.get('id'); if (id) rows = reports.filter((row) => `eq.${row.id}` === id)
      return single ? route.fulfill({ json: rows[0] ?? null }) : counted(rows)
    }
    if (url.pathname === '/rest/v1/complaint_events') return route.fulfill({ json: [{ id: '50000000-0000-4000-8000-000000000001', complaint_id: owned, complaint_version: 1, event_type: 'submitted', remark: null, created_at: recent }] })
    if (url.pathname === '/rest/v1/complaint_evidence' || url.pathname === '/rest/v1/complaint_feedback') return route.fulfill({ json: [] })
    if (url.pathname === '/rest/v1/notifications') return counted(role === 'officer' ? [{ id: '60000000-0000-4000-8000-000000000001', complaint_id: owned, event_id: '50000000-0000-4000-8000-000000000001', kind: 'submission', created_at: recent, read_at: null }] : [])
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').at(-1)!, input: Record<string, unknown> = request.postDataJSON() ?? {}
      if (name === 'list_assignable_officers') return route.fulfill({ json: [{ id: user, display_name: 'Alex Perera' }] })
      if (name === 'admin_analytics') return route.fulfill({ json: { generated_at: new Date().toISOString(), status: { submitted: 2, resolved: 3, withdrawn: 1 }, priority: { normal: 1, urgent: 1 }, overdue: 1, categories: [{ id: roadCat, name: 'Road maintenance', is_active: true, total: 4, open: 1, resolved: 3 }], departments: [{ id: road, name: 'Road maintenance', is_active: true, officers: 1, open: 1, unassigned: 0, overdue: 0 }, { id: transport, name: 'Public transport', is_active: true, officers: 0, open: 1, unassigned: 1, overdue: 1 }], officers: [{ id: officerB, display_name: 'Nimal Officer', department_id: road, open: 1, resolved: 3 }], resolution: { count: 3, avg_hours: 50, within_target: 2 }, satisfaction: { count: 2, average: 4.5, distribution: { 5: 1, 4: 1 } }, trend: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month, index) => ({ month, submitted: index + 1, resolved: index })) } })
      calls.push({ name, input })
      if (name === 'admin_dispatch_complaint') {
        const target = reports.find((row) => row.id === input.p_id)!
        Object.assign(target, { department_id: input.p_department_id, category_id: input.p_category_id, assigned_officer_id: input.p_officer_id, version: target.version + 1 })
        return route.fulfill({ json: target })
      }
    }
    return route.fulfill({ status: 501, json: { message: 'Unexpected request blocked by fixture' } })
  })
  return { calls, reports }
}
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('person@example.test')
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-passphrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible({ timeout: 15000 })
}

test('CR-006 Administrator sees the coverage gap and dispatches a stuck complaint to a staffed department', async ({ page }) => {
  const { calls } = await fixture(page, 'administrator')
  await login(page)
  await page.getByRole('link', { name: 'Dispatch centre', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Dispatch centre' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Public transport coverage' })).toContainText('No Officers')
  await expect(page.getByRole('button', { name: /Needs attention/ })).toContainText('1')
  const row = page.getByRole('article', { name: 'Complaint CF-30000000' })
  await expect(row).toContainText('No Officers in department')
  await expect(row).toContainText('Past service target')
  await capture(page, '14-admin-dispatch-centre')
  await row.getByRole('button', { name: 'Dispatch' }).click()
  await row.getByLabel('Department').selectOption(road)
  await expect(row.getByLabel('Category')).toHaveValue(roadCat)
  await row.getByLabel('Assign Officer').selectOption(officerB)
  await row.getByRole('button', { name: 'Confirm dispatch' }).click()
  await expect(row.getByRole('alert')).toHaveText('Explain the dispatch in at least 10 characters.')
  expect(calls).toHaveLength(0)
  await row.getByLabel('Reason (shared with the citizen)').fill('Road crews handle bus shelters on this route.')
  await row.getByRole('button', { name: 'Confirm dispatch' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Complaint dispatched' })).toBeVisible()
  expect(calls).toEqual([{ name: 'admin_dispatch_complaint', input: { p_id: stuck, p_department_id: road, p_category_id: roadCat, p_officer_id: officerB, p_expected_version: 1, p_reason: 'Road crews handle bus shelters on this route.' } }])
})

test('CR-006 Administrator analytics shows targets, coverage and exports CSV', async ({ page }) => {
  await fixture(page, 'administrator')
  await login(page)
  await page.getByRole('link', { name: 'Analytics', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Service analytics' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Public transport')
  await expect(page.locator('.big-number')).toHaveText('67%')
  await expect(page.getByRole('img', { name: /submitted and resolved per month/ })).toBeVisible()
  await capture(page, '15-admin-analytics')
  await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click()
  await capture(page, '17-admin-analytics-dark')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await download).suggestedFilename()).toMatch(/^civicflow-analytics-\d{4}-\d{2}-\d{2}\.csv$/)
})

test('CR-006 Officer sees assignments in Updates, the department map and service targets', async ({ page }) => {
  await fixture(page, 'officer')
  await login(page)
  await expect(page.getByRole('link', { name: /Updates/ }).getByLabel('1 unread')).toBeVisible()
  await page.getByRole('link', { name: /Updates/ }).click()
  await expect(page.getByRole('link', { name: 'View complaint' })).toHaveAttribute('href', `/officer/complaints/${owned}`)
  await page.getByRole('link', { name: 'Department map', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Department map' })).toBeVisible()
  await expect(page.locator('path.leaflet-interactive')).toHaveCount(1)
  await capture(page, '16-officer-department-map')
  await page.getByRole('link', { name: 'Department complaints', exact: true }).click()
  await expect(page.locator('.sla-badge').first()).toContainText(/Due in/)
})

test('landing page explains the product and the theme toggle switches to dark mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Report it once.')
  await expect(page.getByRole('link', { name: /Create a free account/ })).toHaveAttribute('href', '/register')
  await capture(page, '00-landing')
  const before = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
