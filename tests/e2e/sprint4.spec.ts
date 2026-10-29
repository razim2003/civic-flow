import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { capture } from './capture'

// Sprint 4 journeys: CF-19 feedback, CF-13 inbox/read state, CF-20 category administration, CF-21 monitoring.
// Every Supabase request is intercepted with fictional data; no hosted service is contacted.
const user = '00000000-0000-4000-8000-000000000001'
const department = '20000000-0000-4000-8000-000000000001', otherDepartment = '20000000-0000-4000-8000-000000000002'
const category = '10000000-0000-4000-8000-000000000001'
const complaintId = '30000000-0000-4000-8000-000000000001'
const date = '2026-10-29T08:00:00.000Z'
type Options = { role?: 'citizen' | 'administrator'; feedback?: { rating: number; comment: string | null }; feedbackConflict?: boolean; categoryConflict?: boolean }

async function fixture(page: Page, options: Options = {}) {
  const role = options.role ?? 'citizen'
  const now = Math.floor(Date.now() / 1000)
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'), 'synthetic-signature'].join('.')
  const authUser = { id: user, aud: 'authenticated', role: 'authenticated', email: 'person@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: date }
  const report = { id: complaintId, citizen_id: user, category_id: category, department_id: department, assigned_officer_id: null, description: 'Broken streetlight beside a fictional bus stop.', location_text: 'Sample Junction', latitude: 6.05, longitude: 80.22, status: 'resolved', priority: 'normal', resolution_text: 'The lamp was replaced and tested at night.', resolved_at: date, withdrawal_reason: null, withdrawn_at: null, withdrawn_by: null, version: 5, created_at: date, updated_at: date }
  const events = [
    { id: '50000000-0000-4000-8000-000000000001', complaint_id: complaintId, complaint_version: 1, event_type: 'submitted', remark: null, created_at: date },
    { id: '50000000-0000-4000-8000-000000000002', complaint_id: complaintId, complaint_version: 4, event_type: 'progress_added', remark: '<img src=x onerror=alert(1)> Crew visited the site.', created_at: date },
    { id: '50000000-0000-4000-8000-000000000003', complaint_id: complaintId, complaint_version: 5, event_type: 'resolved', remark: null, created_at: date },
  ]
  const notifications = events.map((event, index) => ({ id: `60000000-0000-4000-8000-00000000000${index + 1}`, complaint_id: complaintId, event_id: event.id, kind: ['submission', 'progress', 'resolution'][index], created_at: `2026-10-29T${String(8 + index).padStart(2, '0')}:00:00.000Z`, read_at: index === 0 ? date : null }))
  let feedback = options.feedback ? { complaint_id: complaintId, citizen_id: user, created_at: date, ...options.feedback } : null
  const categories = [
    { id: category, name: 'Road maintenance', description: 'Roads and footpaths', department_id: department, is_active: true, updated_at: date },
    { id: '10000000-0000-4000-8000-000000000002', name: 'Old drainage route', description: null, department_id: otherDepartment, is_active: false, updated_at: date },
  ]
  const calls: { name: string; input: Record<string, unknown> }[] = []
  const blankTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=', 'base64')
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: blankTile }))
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url())
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    const counted = (rows: unknown[]) => route.fulfill({ headers: { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0', 'access-control-expose-headers': 'content-range' }, json: request.method() === 'HEAD' ? null : rows })
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: authUser } })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (url.pathname === '/rest/v1/profiles') return route.fulfill({ json: [{ id: user, role, display_name: 'Alex Perera', department_id: null, is_active: true, created_at: date, updated_at: date }] })
    if (url.pathname === '/rest/v1/departments') return route.fulfill({ json: [{ id: department, name: 'Road maintenance', is_active: true }, { id: otherDepartment, name: 'Sanitation', is_active: false }] })
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: categories })
    if (url.pathname === '/rest/v1/complaints') {
      const status = url.searchParams.get('status')
      const rows = !status || status === `eq.${report.status}` ? [report] : []
      return single ? route.fulfill({ json: rows[0] ?? null }) : counted(rows)
    }
    if (url.pathname === '/rest/v1/complaint_events') {
      const ids = url.searchParams.get('id')
      return route.fulfill({ json: ids ? events.filter((event) => ids.includes(event.id)) : events })
    }
    if (url.pathname === '/rest/v1/complaint_evidence') return route.fulfill({ json: [] })
    if (url.pathname === '/rest/v1/complaint_feedback') {
      if (url.searchParams.get('select') === 'rating') return route.fulfill({ json: [{ rating: 5 }, { rating: 4 }] })
      return route.fulfill({ json: single ? feedback : feedback ? [feedback] : [] })
    }
    if (url.pathname === '/rest/v1/notifications') {
      const rows = url.searchParams.get('read_at') === 'is.null' ? notifications.filter((item) => !item.read_at) : notifications
      return counted([...rows].reverse())
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').at(-1)!, input: Record<string, unknown> = request.postDataJSON()
      calls.push({ name, input })
      if (name === 'submit_feedback') {
        if (options.feedbackConflict) return route.fulfill({ status: 409, json: { code: '23505', message: 'feedback_exists' } })
        feedback = { complaint_id: complaintId, citizen_id: user, created_at: date, rating: Number(input.p_rating), comment: String(input.p_comment).trim() || null }
        return route.fulfill({ json: feedback })
      }
      if (name === 'mark_notifications_read') {
        const marked = notifications.filter((item) => !item.read_at && (input.p_all || (input.p_notification_ids as string[]).includes(item.id)))
        for (const item of marked) item.read_at = date
        return route.fulfill({ json: marked })
      }
      if (name === 'admin_upsert_category') {
        if (options.categoryConflict) return route.fulfill({ status: 400, json: { code: '23514', message: 'category_in_use' } })
        const saved = { id: String(input.p_id ?? '10000000-0000-4000-8000-000000000009'), name: String(input.p_name).trim(), description: String(input.p_description).trim() || null, department_id: String(input.p_department_id), is_active: Boolean(input.p_is_active), updated_at: date }
        const index = categories.findIndex((item) => item.id === saved.id)
        if (index >= 0) categories[index] = saved; else categories.push(saved)
        return route.fulfill({ json: saved })
      }
    }
    return route.fulfill({ status: 501, json: { message: 'Unexpected request blocked by fixture' } })
  })
  return { calls, notifications }
}
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('person@example.test')
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-passphrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible({ timeout: 15000 })
}
// Sessions are memory-only, so a full page load would sign out; route inside the SPA instead.
async function visit(page: Page, path: string) {
  await page.evaluate((target) => { window.history.pushState({}, '', target); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
}

test('CF-19 Citizen rates a resolved complaint once and then sees it read-only', async ({ page }) => {
  const { calls } = await fixture(page)
  await login(page)
  await visit(page, `/complaints/${complaintId}`)
  await expect(page.getByRole('heading', { name: 'How was the service?' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit feedback' }).click()
  await expect(page.getByRole('alert')).toHaveText('Choose a rating from 1 to 5.')
  expect(calls).toHaveLength(0)
  await page.getByLabel(/Good/).check()
  await page.getByLabel('Comment (optional)').fill('  Quick repair, thank you.  ')
  await page.getByRole('button', { name: 'Submit feedback' }).click()
  await expect(page.getByRole('heading', { name: 'Service feedback' })).toBeVisible()
  await expect(page.getByText('Quick repair, thank you.')).toBeVisible()
  await expect(page.getByRole('img', { name: '4 out of 5' })).toBeVisible()
  await capture(page, '06-citizen-resolved-feedback')
  await expect(page.getByRole('button', { name: 'Submit feedback' })).toHaveCount(0)
  expect(calls).toEqual([{ name: 'submit_feedback', input: { p_complaint_id: complaintId, p_rating: 4, p_comment: 'Quick repair, thank you.' } }])
})

test('CF-19 a duplicate feedback refusal is explained without claiming success', async ({ page }) => {
  await fixture(page, { feedbackConflict: true })
  await login(page)
  await visit(page, `/complaints/${complaintId}`)
  await page.getByLabel(/Excellent/).check()
  await page.getByRole('button', { name: 'Submit feedback' }).click()
  await expect(page.getByRole('alert')).toHaveText('Feedback was already submitted for this complaint. Refresh to see it.')
  await expect(page.getByRole('heading', { name: 'How was the service?' })).toBeVisible()
})

test('CF-13 inbox shows unread updates as plain text and records read state', async ({ page }) => {
  const { calls, notifications } = await fixture(page)
  await login(page)
  await expect(page.getByRole('link', { name: /Updates/ }).getByLabel('2 unread')).toBeVisible()
  await page.getByRole('link', { name: /Updates/ }).click()
  await expect(page.getByRole('heading', { name: 'Updates', exact: true })).toBeVisible()
  await expect(page.getByText('Complaint resolved')).toBeVisible()
  await expect(page.getByText('<img src=x onerror=alert(1)> Crew visited the site.')).toBeVisible()
  await expect(page.getByText('New', { exact: true })).toHaveCount(2)
  await capture(page, '07-citizen-updates-inbox')
  await page.getByRole('button', { name: /Mark Progress update for CF-30000000 as read/ }).click()
  await expect(page.getByText('New', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Updates/ }).getByLabel('1 unread')).toBeVisible()
  await page.getByLabel('Show unread only').check()
  await expect(page.getByText('Complaint resolved')).toBeVisible()
  await expect(page.getByText('Progress update')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mark all as read' }).click()
  await expect(page.getByText('You have no unread updates.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Updates/ }).getByLabel(/unread/)).toHaveCount(0)
  expect(calls.map((call) => call.input)).toEqual([{ p_notification_ids: [notifications[1].id], p_all: false }, { p_notification_ids: null, p_all: true }])
})

test('CF-20 Administrator creates and edits categories; backend refusals are explained', async ({ page }) => {
  const { calls } = await fixture(page, { role: 'administrator' })
  await login(page)
  await page.getByRole('link', { name: 'Service categories', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Service categories' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Old drainage route', exact: true })).toBeVisible()
  await expect(page.getByText('1 active of 2 categories')).toBeVisible()
  await capture(page, '13-admin-service-categories')
  await page.getByRole('button', { name: 'New category' }).click()
  await page.getByRole('button', { name: 'Create category' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a category name.')
  await page.getByLabel('Category name').fill('  Street lighting ')
  await page.getByLabel('Description (optional)').fill('Lamps and poles')
  await expect(page.getByLabel('Receiving department').locator('option')).toHaveText(['Select a department', 'Road maintenance'])
  await page.getByLabel('Receiving department').selectOption(department)
  await page.getByRole('button', { name: 'Create category' }).click()
  await expect(page.getByRole('status')).toHaveText('Category “Street lighting” created.')
  await expect(page.getByRole('button', { name: 'Edit Street lighting' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Old drainage route' }).click()
  await expect(page.getByLabel('Receiving department').locator('option')).toHaveText(['Select a department', 'Road maintenance', 'Sanitation (inactive)'])
  await page.getByLabel('Category name').fill('Drainage (retired)')
  await page.getByRole('button', { name: 'Save category' }).click()
  await expect(page.getByRole('status')).toHaveText('Category “Drainage (retired)” updated.')
  expect(calls).toEqual([
    { name: 'admin_upsert_category', input: { p_id: null, p_name: 'Street lighting', p_description: 'Lamps and poles', p_department_id: department, p_is_active: true } },
    { name: 'admin_upsert_category', input: { p_id: '10000000-0000-4000-8000-000000000002', p_name: 'Drainage (retired)', p_description: '', p_department_id: otherDepartment, p_is_active: false } },
  ])
})

test('CF-20 a referenced category cannot move department and the form keeps the input', async ({ page }) => {
  await fixture(page, { role: 'administrator', categoryConflict: true })
  await login(page)
  await visit(page, '/admin/categories')
  await page.getByRole('button', { name: 'Edit Road maintenance' }).click()
  await page.getByRole('button', { name: 'Save category' }).click()
  await expect(page.getByRole('alert')).toContainText('its department cannot change')
  await expect(page.getByLabel('Category name')).toHaveValue('Road maintenance')
})

test('CF-21 Administrator overview shows monitoring counts without processing controls', async ({ page }) => {
  await fixture(page, { role: 'administrator' })
  await login(page)
  await expect(page.getByText('Average rating')).toBeVisible()
  await expect(page.locator('.stat-card').filter({ hasText: 'Average rating' })).toContainText('4.5')
  await expect(page.locator('.stat-card').filter({ hasText: 'All complaints' })).toContainText('1')
  await expect(page.locator('.stat-card').filter({ hasText: 'Open' })).toContainText('0')
  await expect(page.getByRole('button', { name: /Review|Resolve|Assign/ })).toHaveCount(0)
  await capture(page, '12-admin-overview-monitoring')
})

test('Citizen-only and Administrator-only pages refuse other roles in the UI', async ({ page }) => {
  await fixture(page, { role: 'citizen' })
  await login(page)
  await visit(page, '/admin/categories')
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Service categories' })).toHaveCount(0)
})

test('feedback and inbox fit a mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await fixture(page)
  await login(page)
  for (const path of [`/complaints/${complaintId}`, '/notifications']) {
    await visit(page, path)
    await expect(page.locator('main h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
