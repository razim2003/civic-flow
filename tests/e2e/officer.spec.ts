import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Complaint } from '../../src/features/complaints'

const officer = '00000000-0000-4000-8000-000000000001', citizen = '00000000-0000-4000-8000-000000000002'
const department = '10000000-0000-4000-8000-000000000001', destination = '10000000-0000-4000-8000-000000000002'
const category = '20000000-0000-4000-8000-000000000001', otherCategory = '20000000-0000-4000-8000-000000000002'
const id = '30000000-0000-4000-8000-000000000001', date = '2026-10-20T08:00:00Z'
const teammate = '00000000-0000-4000-8000-000000000003', evidenceId = '50000000-0000-4000-8000-000000000001'
async function fixture(page: Page, options: { stale?: boolean; closed?: boolean; workflowMissing?: boolean; rosterDenied?: boolean; evidence?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: officer, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'), 'synthetic-signature'].join('.')
  const user = { id: officer, aud: 'authenticated', role: 'authenticated', email: 'officer@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: date }
  const report: Complaint = { id, citizen_id: citizen, category_id: category, department_id: department, assigned_officer_id: null, description: 'Several potholes near a fictional school.', location_text: 'Sample Road', latitude: 7, longitude: 80, status: options.closed ? 'withdrawn' : 'submitted', priority: 'normal', resolution_text: null, resolved_at: null, withdrawal_reason: options.closed ? 'The issue was fixed by the service team.' : null, withdrawn_at: options.closed ? date : null, withdrawn_by: options.closed ? citizen : null, version: 1, created_at: date, updated_at: date }
  const calls: { name: string; input: Record<string, unknown> }[] = []
  const reads: URL[] = [], downloads: string[] = []
  const events = [{ id: '40000000-0000-4000-8000-000000000001', complaint_id: id, complaint_version: 1, event_type: 'submitted', remark: null as string | null, created_at: date }]
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user } })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (url.pathname === '/rest/v1/profiles') return route.fulfill({ json: [{ id: officer, role: 'officer', department_id: department, display_name: 'Sam Officer', is_active: true, created_at: date, updated_at: date }] })
    if (url.pathname === '/rest/v1/departments') return route.fulfill({ json: [{ id: department, name: 'Road maintenance', is_active: true }, { id: destination, name: 'Water supply', is_active: true }] })
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: [{ id: category, department_id: department, name: 'Road maintenance', description: null, is_active: true }, { id: otherCategory, department_id: destination, name: 'Water supply', description: null, is_active: true }] })
    if (url.pathname === '/rest/v1/rpc/list_assignable_officers') {
      if (options.workflowMissing) return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Function unavailable' } })
      if (options.rosterDenied) return route.fulfill({ status: 403, json: { code: '42501', message: 'not_authorized' } })
      return route.fulfill({ json: [{ id: officer, display_name: 'Sam Officer' }, { id: teammate, display_name: 'Second Officer' }] })
    }
    if (url.pathname === '/rest/v1/complaints') {
      reads.push(url)
      let matches = report.department_id === department
      for (const key of ['id', 'department_id', 'assigned_officer_id', 'category_id', 'priority'] as const) if (url.searchParams.has(key)) matches &&= url.searchParams.get(key) === 'is.null' ? report[key] === null : url.searchParams.get(key) === `eq.${report[key]}`
      const status = url.searchParams.get('status'); if (status) matches &&= status.startsWith('in.') ? status.includes(report.status) : status === `eq.${report.status}`
      const description = url.searchParams.get('description'); if (description) matches &&= report.description.includes(description.replace('ilike.%', '').replace(/%$/, ''))
      const single = request.headers().accept?.includes('vnd.pgrst.object')
      return route.fulfill({ headers: { 'content-range': matches ? '0-0/1' : '*/0', 'access-control-expose-headers': 'content-range' }, json: single ? matches ? report : null : matches && Number(url.searchParams.get('offset') ?? 0) === 0 ? [report] : [] })
    }
    if (url.pathname === '/rest/v1/complaint_events') return route.fulfill({ json: events })
    if (url.pathname === '/rest/v1/complaint_evidence') return route.fulfill({ json: options.evidence ? [{ id: evidenceId, complaint_id: id, object_path: `${citizen}/${id}/${evidenceId}.pdf`, original_filename: 'sample.pdf', declared_content_type: 'application/pdf', declared_size_bytes: 9, state: 'attached', expires_at: '2099-01-01T00:00:00Z', attached_at: date }] : [] })
    if (url.pathname.startsWith('/storage/v1/object/')) {
      expect(request.method()).toBe('GET')
      expect(request.headers().authorization).toBe(`Bearer ${token}`)
      downloads.push(url.pathname)
      return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.7\n' })
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').at(-1)!, input: Record<string, unknown> = request.postDataJSON()
      calls.push({ name, input })
      if (options.stale && calls.length === 1) { report.version++; return route.fulfill({ status: 409, json: { code: 'PT409', message: 'stale_version' } }) }
      const eventTypes: Record<string, string> = { review_complaint: 'reviewed', assign_complaint: 'assigned', set_complaint_priority: 'priority_changed', start_complaint: 'started', add_progress: 'progress_added', resolve_complaint: 'resolved', transfer_complaint: 'transferred' }
      if (!eventTypes[name]) return route.fulfill({ status: 501, json: { message: 'Unexpected RPC blocked' } })
      if ((name === 'assign_complaint' && report.assigned_officer_id === input.p_officer_id) || (name === 'set_complaint_priority' && report.priority === input.p_priority)) return route.fulfill({ json: report })
      if (name === 'review_complaint') report.status = 'under_review'
      if (name === 'assign_complaint') report.assigned_officer_id = String(input.p_officer_id)
      if (name === 'set_complaint_priority') report.priority = 'high'
      if (name === 'start_complaint') report.status = 'in_progress'
      if (name === 'resolve_complaint') { report.status = 'resolved'; report.resolution_text = String(input.p_resolution_text); report.resolved_at = date }
      if (name === 'transfer_complaint') { report.department_id = destination; report.category_id = otherCategory; report.assigned_officer_id = null }
      report.version++
      events.push({ id: `40000000-0000-4000-8000-${String(report.version).padStart(12, '0')}`, complaint_id: id, complaint_version: report.version, event_type: eventTypes[name], remark: input.p_remark ? String(input.p_remark) : null, created_at: date })
      return route.fulfill({ json: report })
    }
    return route.fulfill({ status: 501, json: { message: 'Unexpected external request blocked' } })
  })
  return { report, calls, reads, downloads }
}
async function login(page: Page) {
  await page.goto('/login'); await page.getByLabel('Email address').fill('officer@example.test')
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-passphrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Sam.' })).toBeVisible()
}
async function detail(page: Page) {
  await page.getByRole('link', { name: 'Department complaints', exact: true }).click()
  await page.getByRole('link', { name: /Several potholes/ }).click()
  await expect(page.getByRole('heading', { name: 'Process complaint' })).toBeVisible()
}
async function save(page: Page, action: string, button: string) {
  await page.getByLabel('Action', { exact: true }).selectOption(action)
  await page.getByRole('button', { name: button, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Complaint updated' })).toContainText('Complaint updated')
}

test('Officer reviews, assigns, prioritizes, starts, updates and resolves a complaint', async ({ page }, testInfo) => {
  const state = await fixture(page); await login(page)
  await page.screenshot({ path: testInfo.outputPath('officer-overview.png'), fullPage: true })
  await detail(page)
  await expect(page.getByLabel('Supporting files')).toHaveCount(0)
  await save(page, 'review', 'Begin review')
  await page.getByLabel('Action', { exact: true }).selectOption('assign')
  await page.getByLabel('Assign to Officer').selectOption(officer)
  await page.getByRole('button', { name: 'Assign / reassign Officer', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Complaint updated' })).toContainText('Complaint updated')
  await page.getByLabel('Action', { exact: true }).selectOption('priority')
  await page.getByLabel('New priority').selectOption('high')
  await page.getByRole('button', { name: 'Set priority', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Complaint updated' })).toContainText('Complaint updated')
  await save(page, 'start', 'Start work')
  await page.getByLabel('Action', { exact: true }).selectOption('progress')
  await page.getByLabel('Progress update', { exact: true }).fill('Surface preparation completed.')
  await page.getByRole('button', { name: 'Add progress update', exact: true }).click()
  await expect(page.getByText('Surface preparation completed.', { exact: true })).toBeVisible()
  await page.getByLabel('Action', { exact: true }).selectOption('resolve')
  await page.getByLabel('Resolution details', { exact: true }).fill('The road surface was repaired and inspected.')
  await expect(page.getByRole('button', { name: 'Resolve complaint', exact: true })).toBeDisabled()
  await page.getByLabel('I confirm the issue is resolved.').check()
  await page.getByRole('button', { name: 'Resolve complaint', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Complaint closed' })).toBeVisible()
  await expect(page.getByText('The road surface was repaired and inspected.', { exact: true })).toBeVisible()
  expect(state.calls.map((call) => call.name)).toEqual(['review_complaint', 'assign_complaint', 'set_complaint_priority', 'start_complaint', 'add_progress', 'resolve_complaint'])
  expect(state.calls.map((call) => call.input.p_expected_version)).toEqual([1, 2, 3, 4, 5, 6])
  await page.screenshot({ path: testInfo.outputPath('officer-resolved.png'), fullPage: true })
})
test('assigned queue and filters use department and assignment scopes', async ({ page }) => {
  const state = await fixture(page); state.report.assigned_officer_id = officer
  await login(page); await page.getByRole('link', { name: 'Assigned to me', exact: true }).first().click()
  await expect(page.locator('.complaint-card')).toHaveCount(1)
  await page.getByLabel('Priority', { exact: true }).selectOption('urgent')
  await expect(page.getByRole('heading', { name: 'No matching complaints' })).toBeVisible()
  await page.getByLabel('Priority', { exact: true }).selectOption('')
  await expect(page.locator('.complaint-card')).toHaveCount(1)
})
test('stale writes keep the remark and require a deliberate refresh', async ({ page }) => {
  const state = await fixture(page, { stale: true }); await login(page); await detail(page)
  await page.getByLabel('Remark (optional)').fill('Checking the reported location.')
  await page.getByRole('button', { name: 'Begin review', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Refresh and review')
  await expect(page.getByLabel('Remark (optional)')).toHaveValue('Checking the reported location.')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: 'Begin review', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Complaint updated' })).toContainText('Complaint updated')
  expect(state.calls.map((call) => call.input.p_expected_version)).toEqual([1, 2])
})
test('transfer returns to the queue after old-department read access is lost', async ({ page }) => {
  await fixture(page); await login(page); await detail(page)
  await page.getByLabel('Action', { exact: true }).selectOption('transfer')
  await page.getByLabel('Destination service category').selectOption(otherCategory)
  await page.getByLabel('Reason for change').fill('The issue belongs to the water service team.')
  await page.getByRole('button', { name: 'Transfer to another service', exact: true }).click()
  await expect(page).toHaveURL(/\/officer\/complaints$/)
  await expect(page.getByRole('status').filter({ hasText: 'Complaint transferred' })).toContainText('Complaint transferred')
  await expect(page.locator('.complaint-card')).toHaveCount(0)
})
test('Withdrawn complaints remain readable with all processing disabled on mobile', async ({ page }, testInfo) => {
  await fixture(page, { closed: true }); await page.setViewportSize({ width: 375, height: 812 }); await login(page)
  await page.getByRole('link', { name: 'Department complaints', exact: true }).click()
  await page.getByLabel('Status', { exact: true }).selectOption('all')
  await page.locator('.complaint-card').click()
  await expect(page.getByRole('heading', { name: 'Complaint closed' })).toBeVisible()
  await expect(page.getByLabel('Action', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('officer-mobile.png'), fullPage: true })
})

test('missing workflow setup preserves read access and blocks processing until activation', async ({ page }) => {
  const options = { workflowMissing: true, evidence: true }
  const state = await fixture(page, options)
  await login(page)
  await expect(page.getByRole('alert')).toContainText('awaiting activation')
  await expect(page.locator('.complaint-card')).toHaveCount(1)
  await detail(page)
  await expect(page.getByRole('alert')).toContainText('awaiting activation')
  await expect(page.getByLabel('Action', { exact: true })).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download sample.pdf' }).click()
  expect((await download).suggestedFilename()).toBe('sample.pdf')
  expect(state.downloads).toHaveLength(1)
  expect(state.calls).toHaveLength(0)
  options.workflowMissing = false
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByLabel('Action', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('authorization denial is not treated as missing setup', async ({ page }) => {
  await fixture(page, { rosterDenied: true })
  await login(page)
  await page.getByRole('link', { name: 'Department complaints', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('check your access')
  await expect(page.getByText('awaiting activation', { exact: false })).toHaveCount(0)
  await expect(page.locator('.complaint-card')).toHaveCount(0)
})

test('search and assignment filters survive a detail visit and clear together', async ({ page }) => {
  const state = await fixture(page)
  await login(page)
  await page.getByRole('link', { name: 'Department complaints', exact: true }).click()
  await page.getByLabel('Assignment', { exact: true }).selectOption('unassigned')
  await page.getByLabel('Search complaints').fill('potholes')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.locator('.complaint-card')).toHaveCount(1)
  expect(state.reads.at(-1)?.searchParams.get('assigned_officer_id')).toBe('is.null')
  await page.locator('.complaint-card').click()
  const back = page.locator('.page-back')
  await expect(back).toHaveAttribute('href', '/officer/complaints?assignment=unassigned&search=potholes')
  await back.click()
  await expect(page.getByLabel('Search complaints')).toHaveValue('potholes')
  await expect(page.getByLabel('Assignment', { exact: true })).toHaveValue('unassigned')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByLabel('Search complaints')).toHaveValue('')
  await expect(page.getByLabel('Assignment', { exact: true })).toHaveValue('all')
  await expect(page).toHaveURL(/\/officer\/complaints$/)
})

test('another assignee cannot start, progress or resolve through the Officer UI', async ({ page }) => {
  const state = await fixture(page)
  state.report.assigned_officer_id = teammate
  state.report.status = 'in_progress'
  await login(page); await detail(page)
  await expect(page.getByText('Work is underway.', { exact: false })).toBeVisible()
  for (const value of ['start', 'progress', 'resolve']) await expect(page.locator(`#officer-action option[value="${value}"]`)).toHaveCount(0)
  await page.getByLabel('Action', { exact: true }).selectOption('assign')
  await page.getByLabel('Assign to Officer').selectOption(officer)
  await page.getByLabel('Reason for change').fill('short')
  await page.getByRole('button', { name: 'Assign / reassign Officer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('at least 10 characters')
  expect(state.calls).toHaveLength(0)
})

test('unchanged priority reports a no-op without promising a new history event', async ({ page }) => {
  const state = await fixture(page)
  await login(page); await detail(page)
  await page.getByLabel('Action', { exact: true }).selectOption('priority')
  await page.getByRole('button', { name: 'Set priority', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No change was needed' })).toBeVisible()
  expect(state.report.version).toBe(1)
})
