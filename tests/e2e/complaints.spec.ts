import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const citizen = '00000000-0000-4000-8000-000000000001'
const category = '10000000-0000-4000-8000-000000000001'
const department = '20000000-0000-4000-8000-000000000001'
const complaintId = '30000000-0000-4000-8000-000000000001'
const evidenceId = '40000000-0000-4000-8000-000000000001'
const date = '2026-10-19T08:00:00.000Z'
type Complaint = { id: string; citizen_id: string; category_id: string; department_id: string; description: string; location_text: string; latitude: number; longitude: number; status: string; priority: string; resolution_text: null; resolved_at: null; withdrawal_reason: string | null; withdrawn_at: string | null; withdrawn_by: string | null; version: number; created_at: string; updated_at: string }
const report = (id = complaintId): Complaint => ({ id, citizen_id: citizen, category_id: category, department_id: department, description: 'Several deep potholes beside the public school.', location_text: 'School Road', latitude: 6.927, longitude: 79.861, status: 'submitted', priority: 'normal', resolution_text: null, resolved_at: null, withdrawal_reason: null, withdrawn_at: null, withdrawn_by: null, version: 1, created_at: date, updated_at: date })

async function fixture(page: Page, options: { reports?: Complaint[]; lostSubmissionResponse?: boolean; uploadFailure?: boolean; tileFailure?: boolean; noCategories?: boolean; withdrawalFailure?: 'stale' | 'lost' } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: citizen, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'), 'synthetic-signature'].join('.')
  const user = { id: citizen, aud: 'authenticated', role: 'authenticated', email: 'citizen@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: date }
  const rows = [...options.reports ?? []]
  const submissionRequests: Record<string, unknown>[] = []
  const uploadRequests: Record<string, unknown>[] = []
  const withdrawalRequests: Record<string, unknown>[] = []
  let uploaded = false, attached = false, attempts = 0
  const evidence = () => ({ id: evidenceId, complaint_id: complaintId, object_path: `${citizen}/${complaintId}/${evidenceId}.pdf`, original_filename: 'sample.pdf', declared_content_type: 'application/pdf', declared_size_bytes: 9, state: attached ? 'attached' : 'pending', expires_at: '2099-01-01T00:00:00Z', attached_at: attached ? date : null })
  await page.route('https://tile.openstreetmap.org/**', (route) => options.tileFailure ? route.abort() : route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=', 'base64') }))
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url())
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user } })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (url.pathname === '/rest/v1/profiles') return route.fulfill({ json: [{ id: citizen, role: 'citizen', display_name: 'Alex Perera', department_id: null, is_active: true, created_at: date, updated_at: date }] })
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: options.noCategories ? [] : ['Road maintenance', 'Waste management', 'Water supply', 'Sanitation', 'Public transport', 'Other public services'].map((name, index) => ({ id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name, description: 'Public service issues', department_id: department, is_active: true })).reverse() })
    if (url.pathname === '/rest/v1/departments') return route.fulfill({ json: [{ id: department, name: 'Road maintenance', is_active: true }] })
    if (url.pathname === '/rest/v1/rpc/submit_complaint') {
      const input = request.postDataJSON(); submissionRequests.push(input)
      if (!rows.length) rows.push({ ...report(), category_id: input.p_category_id, description: input.p_description, location_text: input.p_location_text, latitude: input.p_latitude, longitude: input.p_longitude })
      if (options.lostSubmissionResponse && submissionRequests.length === 1) return route.fulfill({ status: 503, json: { message: 'Temporary network failure' } })
      return route.fulfill({ json: rows[0] })
    }
    if (url.pathname === '/rest/v1/rpc/withdraw_complaint') {
      const input = request.postDataJSON(); withdrawalRequests.push(input)
      const complaint = rows.find((row) => row.id === input.p_complaint_id)
      if (!complaint) return route.fulfill({ status: 403, json: { code: '42501', message: 'not_authorized' } })
      if (options.withdrawalFailure === 'stale' && withdrawalRequests.length === 1) {
        complaint.version++
        return route.fulfill({ status: 409, json: { code: '40001', message: 'stale_version' } })
      }
      if (complaint.status !== 'withdrawn') Object.assign(complaint, { status: 'withdrawn', withdrawal_reason: input.p_reason, withdrawn_at: date, withdrawn_by: citizen, version: complaint.version + 1 })
      if (options.withdrawalFailure === 'lost' && withdrawalRequests.length === 1) return route.fulfill({ status: 503, json: { message: 'Temporary network failure' } })
      return route.fulfill({ json: complaint })
    }
    if (url.pathname === '/rest/v1/complaints') {
      let selected = rows.filter((row) => !url.searchParams.has('id') || `eq.${row.id}` === url.searchParams.get('id'))
      const status = url.searchParams.get('status'); if (status) selected = selected.filter((row) => `eq.${row.status}` === status)
      const description = url.searchParams.get('description'); if (description) selected = selected.filter((row) => row.description.toLowerCase().includes(description.replace('ilike.%', '').replace(/%$/, '').toLowerCase()))
      const count = selected.length, offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 100)
      selected = selected.slice(offset, offset + limit)
      return route.fulfill({ headers: { 'content-range': count ? `${offset}-${offset + selected.length - 1}/${count}` : '*/0', 'access-control-expose-headers': 'content-range' }, json: single ? selected[0] ?? null : selected })
    }
    if (url.pathname === '/rest/v1/complaint_events') return route.fulfill({ json: [{ id: '50000000-0000-4000-8000-000000000001', complaint_id: complaintId, complaint_version: 1, event_type: 'submitted', remark: null, created_at: date }, ...attached ? [{ id: '50000000-0000-4000-8000-000000000002', complaint_id: complaintId, complaint_version: 2, event_type: 'evidence_added', remark: null, created_at: date }] : [], ...rows[0]?.status === 'withdrawn' ? [{ id: '50000000-0000-4000-8000-000000000003', complaint_id: complaintId, complaint_version: rows[0].version, event_type: 'withdrawn', remark: rows[0].withdrawal_reason, created_at: date }] : []] })
    if (url.pathname === '/rest/v1/complaint_evidence') return route.fulfill({ json: attached ? [evidence()] : [] })
    if (url.pathname === '/rest/v1/rpc/reserve_evidence') { uploadRequests.push(request.postDataJSON()); return route.fulfill({ json: evidence() }) }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (request.method() === 'POST') {
        attempts++
        if (options.uploadFailure && attempts === 1) return route.fulfill({ status: 503, json: { statusCode: '503', error: 'Unavailable', message: 'Temporary upload failure' } })
        uploaded = true; return route.fulfill({ json: { Key: `complaint-evidence/${evidence().object_path}`, Id: evidenceId } })
      }
      return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.7\n' })
    }
    if (url.pathname === '/rest/v1/rpc/finalize_evidence') {
      if (!uploaded) return route.fulfill({ status: 400, json: { code: '22023', message: 'upload_missing' } })
      attached = true; return route.fulfill({ json: evidence() })
    }
    return route.fulfill({ status: 501, json: { message: 'Unexpected external request blocked by fixture' } })
  })
  return { rows, submissionRequests, uploadRequests, withdrawalRequests }
}
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('citizen@example.test')
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-passphrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible()
}
async function fillComplaint(page: Page) {
  await page.getByRole('link', { name: 'New complaint', exact: true }).click()
  await page.getByLabel('Service category').selectOption(category)
  await page.getByLabel('Describe the issue').fill('Several deep potholes beside the public school.')
  await page.getByLabel('Location description').fill('School Road')
  await page.getByLabel('Latitude').fill('6.927')
  await page.getByLabel('Longitude').fill('79.861')
}

test('Citizen submits, retries optional evidence, downloads privately and revisits list/detail', async ({ page }, testInfo) => {
  const state = await fixture(page, { uploadFailure: true })
  await login(page)
  await expect(page.getByRole('heading', { name: 'No complaints yet' })).toBeVisible()
  await fillComplaint(page)
  const profileRefresh = page.waitForResponse((response) => response.url().includes('/rest/v1/profiles'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await profileRefresh
  await expect(page.getByLabel('Describe the issue')).toHaveValue('Several deep potholes beside the public school.')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('complaint-form.png'), fullPage: true })
  await page.getByRole('button', { name: 'Submit complaint' }).click()
  await expect(page.getByRole('heading', { name: 'Complaint submitted', exact: true })).toBeVisible()
  expect(state.submissionRequests).toHaveLength(1)
  expect(state.submissionRequests[0]).not.toHaveProperty('citizen_id')
  expect(state.submissionRequests[0]).not.toHaveProperty('status')
  await page.getByLabel('Supporting files').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n') })
  await page.getByRole('button', { name: 'Upload file', exact: true }).click()
  await expect(page.getByText('Upload failed. Your complaint is saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Retry upload' }).click()
  await expect(page.getByRole('button', { name: 'Download sample.pdf' })).toBeVisible()
  expect(state.uploadRequests).toHaveLength(2)
  expect(state.uploadRequests[0].p_request_id).toBe(state.uploadRequests[1].p_request_id)
  expect(state.submissionRequests).toHaveLength(1)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download sample.pdf' }).click()
  expect((await download).suggestedFilename()).toBe('sample.pdf')
  await page.getByRole('link', { name: 'View complaint', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Complaint history' })).toBeVisible()
  await expect(page.getByText('Supporting evidence added', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('complaint-detail.png'), fullPage: true })
  await page.getByRole('link', { name: 'My complaints', exact: true }).first().click()
  await expect(page.getByText('1 complaint · Page 1')).toBeVisible()
  await expect(page.locator('.complaint-card')).toHaveCount(1)
})

test('a lost submission response preserves details and retries the same idempotency key', async ({ page }) => {
  const state = await fixture(page, { lostSubmissionResponse: true })
  await login(page); await fillComplaint(page)
  await page.getByRole('button', { name: 'Submit complaint' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Describe the issue')).toHaveValue('Several deep potholes beside the public school.')
  await page.getByRole('button', { name: 'Submit complaint' }).click()
  await expect(page.getByRole('heading', { name: 'Complaint submitted', exact: true })).toBeVisible()
  expect(state.submissionRequests).toHaveLength(2)
  expect(state.submissionRequests[0]).toEqual(state.submissionRequests[1])
  expect(state.rows).toHaveLength(1)
})

test('blank coordinates fail validation, map click selects location, unavailable tiles allow numeric entry', async ({ page }) => {
  const state = await fixture(page, { tileFailure: true })
  await login(page)
  await fillComplaint(page)
  await page.getByLabel('Latitude').fill(''); await page.getByLabel('Longitude').fill('')
  await page.getByRole('button', { name: 'Submit complaint' }).click()
  await expect(page.getByText('Select a location or enter a latitude.')).toBeVisible()
  expect(state.submissionRequests).toHaveLength(0)
  await page.locator('.leaflet-container').click({ position: { x: 120, y: 130 } })
  await expect(page.getByLabel('Latitude')).not.toHaveValue('')
  await expect(page.getByLabel('Longitude')).not.toHaveValue('')
  await expect(page.getByText('Map tiles could not load.', { exact: false })).toBeVisible()
  await page.getByLabel('Latitude').fill('0'); await page.getByLabel('Longitude').fill('0')
  await page.getByRole('button', { name: 'Submit complaint' }).click()
  await expect(page.getByRole('heading', { name: 'Complaint submitted', exact: true })).toBeVisible()
  expect(state.submissionRequests[0]).toMatchObject({ p_latitude: 0, p_longitude: 0 })
})

test('list pagination/search/status preserve ownership and mobile content fits', async ({ page }, testInfo) => {
  const reports = Array.from({ length: 12 }, (_, i) => ({ ...report(`30000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`), description: i === 0 ? 'Unique public road damage' : `Public road damage report ${i}` }))
  await fixture(page, { reports })
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page)
  await page.getByRole('link', { name: 'My complaints', exact: true }).click()
  await expect(page.locator('.complaint-card')).toHaveCount(10)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.complaint-card')).toHaveCount(2)
  await page.getByLabel('Search complaints').fill('Unique')
  const request = page.waitForRequest((request) => request.url().includes('/rest/v1/complaints?') && request.url().includes('description='))
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  expect(new URL((await request).url()).searchParams.get('citizen_id')).toBe(`eq.${citizen}`)
  await expect(page.locator('.complaint-card')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('complaints-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByLabel('Status', { exact: true }).selectOption('resolved')
  await expect(page.getByRole('heading', { name: 'No matching complaints' })).toBeVisible()
})

test('foreign complaint references show no details and descriptions render as plain text', async ({ page }) => {
  const text = '<img src=x onerror="window.compromised=true"> A public road issue'
  await fixture(page, { reports: [{ ...report(), description: text }] })
  await login(page)
  await page.locator('.complaint-card').click()
  await expect(page.getByText(text, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => 'compromised' in window)).toBe(false)
  await page.evaluate(() => { history.pushState(null, '', '/complaints/30000000-0000-4000-8000-000000000099'); dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { name: 'Complaint unavailable' })).toBeVisible()
  await expect(page.getByText(text, { exact: true })).toHaveCount(0)
})

test('service dropdown contains all six choices with Other last and submits its real category ID', async ({ page }) => {
  const state = await fixture(page)
  await login(page); await fillComplaint(page)
  const select = page.getByLabel('Service category')
  await expect(select.locator('option')).toHaveText(['Select a service category', 'Road maintenance', 'Waste management', 'Water supply', 'Sanitation', 'Public transport', 'Other'])
  await select.selectOption({ label: 'Other' })
  await page.getByRole('button', { name: 'Submit complaint' }).click()
  await expect(page.getByRole('heading', { name: 'Complaint submitted', exact: true })).toBeVisible()
  expect(state.submissionRequests[0].p_category_id).toBe('10000000-0000-4000-8000-000000000006')
  await page.getByRole('link', { name: 'View complaint', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Other', exact: true })).toBeVisible()
})

test('missing category setup is explained and cannot submit fabricated categories', async ({ page }) => {
  await fixture(page, { noCategories: true })
  await login(page)
  await page.getByRole('link', { name: 'New complaint', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Service categories have not been configured yet.')
  await expect(page.getByLabel('Service category').locator('option')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Submit complaint' })).toBeDisabled()
})

test('Citizen confirms a reason to withdraw and can still find its history', async ({ page }, testInfo) => {
  const state = await fixture(page, { reports: [report()] })
  await login(page); await page.locator('.complaint-card').click()
  await page.getByRole('button', { name: 'Withdraw complaint', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('alert')).toContainText('at least 10 characters')
  expect(state.withdrawalRequests).toHaveLength(0)
  await page.getByLabel('Reason for withdrawal').fill('The issue has already been fixed by the local team.')
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('alert')).toContainText('Confirm that you want to withdraw')
  await page.getByRole('button', { name: 'Keep complaint', exact: true }).click()
  expect(state.withdrawalRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Withdraw complaint', exact: true }).click()
  await page.getByLabel('I understand this will close my complaint').check()
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('heading', { name: 'Withdrawal details' })).toBeVisible()
  await expect(page.getByText('Complaint withdrawn', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Withdraw complaint', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Supporting files')).toHaveCount(0)
  expect(state.withdrawalRequests[0]).toEqual({ p_complaint_id: complaintId, p_expected_version: 1, p_reason: 'The issue has already been fixed by the local team.' })
  await page.screenshot({ path: testInfo.outputPath('withdrawn-complaint.png'), fullPage: true })
  await page.getByRole('link', { name: 'My complaints', exact: true }).first().click()
  await page.getByLabel('Status', { exact: true }).selectOption('withdrawn')
  await expect(page.locator('.complaint-card')).toHaveCount(1)
  await expect(page.locator('.complaint-card')).toContainText('Withdrawn')
})

test('stale withdrawal keeps the reason and requires reviewing a refreshed complaint', async ({ page }) => {
  const state = await fixture(page, { reports: [report()], withdrawalFailure: 'stale' })
  await login(page); await page.locator('.complaint-card').click()
  await page.getByRole('button', { name: 'Withdraw complaint', exact: true }).click()
  await page.getByLabel('Reason for withdrawal').fill('This was a duplicate report of the same issue.')
  await page.getByLabel('I understand this will close my complaint').check()
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('alert')).toContainText('This complaint changed')
  await expect(page.getByLabel('Reason for withdrawal')).toHaveValue('This was a duplicate report of the same issue.')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('heading', { name: 'Withdrawal details' })).toBeVisible()
  expect(state.withdrawalRequests.map((request) => request.p_expected_version)).toEqual([1, 2])
})

test('withdrawal retries the same intent after an uncertain response', async ({ page }) => {
  const state = await fixture(page, { reports: [report()], withdrawalFailure: 'lost' })
  await login(page); await page.locator('.complaint-card').click()
  await page.getByRole('button', { name: 'Withdraw complaint', exact: true }).click()
  await page.getByLabel('Reason for withdrawal').fill('The issue was already fixed before this report was processed.')
  await page.getByLabel('I understand this will close my complaint').check()
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(page.getByRole('heading', { name: 'Withdrawal details' })).toBeVisible()
  expect(state.withdrawalRequests).toHaveLength(2)
  expect(state.withdrawalRequests[0]).toEqual(state.withdrawalRequests[1])
  expect(state.rows[0].version).toBe(2)
})

test('resolved and withdrawn complaints do not offer withdrawal', async ({ page }) => {
  await fixture(page, { reports: [{ ...report(), status: 'resolved' }] })
  await login(page); await page.locator('.complaint-card').click()
  await expect(page.getByRole('heading', { name: 'Resolution', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Withdraw complaint', exact: true })).toHaveCount(0)
})
