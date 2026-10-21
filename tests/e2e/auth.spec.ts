import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const id = '00000000-0000-4000-8000-000000000001'
const now = Math.floor(Date.now() / 1000)
function token() {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'), 'synthetic-test-signature'].join('.')
}
async function mockSupabase(page: Page, role = 'citizen', missingProfile = false) {
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'citizen@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: new Date().toISOString() }
  const profile = { id, display_name: 'Alex Perera', role, department_id: role === 'officer' ? '10000000-0000-4000-8000-000000000001' : null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await page.route('https://*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token(), refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user } })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (url.pathname === '/auth/v1/recover') return route.fulfill({ json: {} })
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    if (url.pathname === '/auth/v1/signup') return route.fulfill({ json: { user, session: null } })
    if (url.pathname === '/rest/v1/profiles') {
      const single = route.request().headers().accept?.includes('vnd.pgrst.object')
      return route.fulfill({ headers: { 'content-range': '0-0/1' }, json: missingProfile ? null : single ? profile : [profile] })
    }
    if (url.pathname === '/rest/v1/departments') return route.fulfill({ json: [{ id: '10000000-0000-4000-8000-000000000001', name: 'Roads', is_active: true }] })
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: [] })
    if (url.pathname === '/rest/v1/complaints') return route.fulfill({ headers: { 'content-range': '*/0' }, json: [] })
    if (url.pathname === '/rest/v1/rpc/list_assignable_officers') return route.fulfill({ json: [] })
    if (url.pathname === '/rest/v1/rpc/update_my_profile') {
      profile.display_name = route.request().postDataJSON().p_display_name
      return route.fulfill({ json: profile })
    }
    if (url.pathname === '/rest/v1/rpc/admin_update_user') {
      const input = route.request().postDataJSON()
      if (input.p_role !== 'administrator' || !input.p_is_active) return route.fulfill({ status: 400, json: { code: '23514', message: 'last_administrator' } })
      return route.fulfill({ json: profile })
    }
    return route.fulfill({ status: 501, json: { message: 'Unexpected request blocked by test fixture' } })
  })
}
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('citizen@example.test')
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-passphrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('protected URLs redirect to sign-in without a session', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/admin/users')
  // Allow cold Vite compilation before checking the completed redirect.
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible({ timeout: 15000 })
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('link', { name: 'User management', exact: true })).toHaveCount(0)
})
test('registration validates input and shows email verification without accepting a role', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/register')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await page.getByLabel('Full name').fill('Alex Perera')
  await page.getByLabel('Email address').fill('citizen@example.test')
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-passphrase')
  const request = page.waitForRequest((request) => request.url().includes('/auth/v1/signup'))
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  expect((await request).postDataJSON().data).toEqual({ display_name: 'Alex Perera' })
  await expect(page.getByRole('status')).toContainText('Check your email')
})
for (const role of ['citizen', 'officer', 'administrator']) {
  test(`${role} reaches the right workspace and logout clears it`, async ({ page }) => {
    await mockSupabase(page, role)
    await login(page)
    await expect(page).toHaveURL(/\/workspace$/)
    await expect(page.getByText(`${role === 'administrator' ? 'Administrator' : role === 'officer' ? 'Officer' : 'Citizen'} workspace`)).toBeVisible()
    if (role === 'administrator') { await page.getByRole('link', { name: 'User management' }).click(); await expect(page.getByRole('cell', { name: 'Administrator', exact: true })).toBeVisible() }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  })
}
test('Citizen cannot open Administrator UI through a manually entered route', async ({ page }) => {
  await mockSupabase(page)
  await login(page)
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
  await page.evaluate(() => { window.history.pushState(null, '', '/admin/users'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'User management' })).toHaveCount(0)
})
test('a missing profile fails closed and offers retry and sign-out', async ({ page }) => {
  await mockSupabase(page, 'citizen', true)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Your account needs attention.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
test('password recovery has a generic response and expired reset links cannot set a password', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/forgot-password')
  await page.getByLabel('Email address').fill('citizen@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If an account exists')
  await page.goto('/reset-password')
  await expect(page.getByRole('alert')).toContainText('missing or has expired')
  await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0)
})
test('session is not persisted across a full reload', async ({ page }) => {
  await mockSupabase(page)
  await login(page)
  await expect(page).toHaveURL(/\/workspace$/)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('sb-')))).toEqual([])
})
test('authentication page fits a small mobile viewport', async ({ page }) => {
  await mockSupabase(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.getByLabel('Email address')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('profile changes refresh the displayed account without changing its role', async ({ page }) => {
  await mockSupabase(page)
  await login(page)
  await page.getByRole('link', { name: 'Profile settings' }).click()
  await page.getByLabel('Full name').fill('Taylor Perera')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByLabel('Full name')).toHaveValue('Taylor Perera')
  await expect(page.getByText('Citizen workspace')).toBeVisible()
})

test('Administrator sees backend refusal when attempting to remove the last admin', async ({ page }) => {
  await mockSupabase(page, 'administrator')
  await login(page)
  await page.getByRole('link', { name: 'User management' }).click()
  await page.getByRole('button', { name: 'Edit access for Alex Perera' }).click()
  await page.getByLabel('Account role').selectOption('citizen')
  await page.getByRole('button', { name: 'Save access' }).click()
  await expect(page.getByRole('alert')).toHaveText('At least one active administrator must remain.')
  await expect(page.getByText('Administrator workspace')).toBeVisible()
})

test('a valid recovery session can update its password and keep the success message', async ({ page }) => {
  await mockSupabase(page)
  await page.goto(`/reset-password#access_token=${token()}&refresh_token=synthetic-refresh-token&expires_in=3600&token_type=bearer&type=recovery`)
  await page.getByLabel('New password', { exact: true }).fill('a-new-long-test-passphrase')
  await page.getByLabel('Confirm new password').fill('a-new-long-test-passphrase')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByRole('status')).toContainText('Your password has been updated.')
  await expect(page.getByRole('link', { name: 'Go to workspace' })).toBeVisible()
})

test('an invitation session sets its own password without changing its role', async ({ page }) => {
  await mockSupabase(page)
  await page.goto(`/accept-invite#access_token=${token()}&refresh_token=synthetic-refresh-token&expires_in=3600&token_type=bearer&type=invite`)
  await expect(page.getByRole('heading', { name: 'Set up your account.' })).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill('a-long-test-passphrase')
  await page.getByLabel('Confirm new password').fill('a-long-test-passphrase')
  const request = page.waitForRequest((request) => request.method() === 'PUT' && request.url().includes('/auth/v1/user'))
  await page.getByRole('button', { name: 'Set password', exact: true }).click()
  expect((await request).postDataJSON()).toEqual({ password: 'a-long-test-passphrase', code_challenge: null, code_challenge_method: null })
  await expect(page.getByRole('status')).toContainText('Your password has been updated')
  await page.getByRole('link', { name: 'Go to workspace' }).click()
  await expect(page.getByText('Citizen workspace')).toBeVisible()
})

test('an expired invitation cannot submit a password', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/accept-invite')
  await expect(page.getByRole('alert')).toContainText('invitation link is missing or has expired')
  await expect(page.getByRole('button', { name: 'Set password', exact: true })).toHaveCount(0)
})

test('Administrator creates an Officer invitation with a department and no password or role selector', async ({ page }) => {
  await mockSupabase(page, 'administrator')
  const invitations: unknown[] = []
  await page.route('https://*.supabase.co/functions/v1/provision-officer', async (route) => {
    invitations.push(route.request().postDataJSON())
    await route.fulfill({ json: { code: 'officer_invited', userId: 'invited-user' } })
  })
  await login(page)
  await page.getByRole('link', { name: 'User management', exact: true }).click()
  await page.getByRole('link', { name: 'Create Officer account' }).click()
  await page.getByLabel('Officer full name').fill('Sample Officer')
  await page.getByLabel('Officer email address').fill('officer@example.test')
  await page.getByLabel('Department', { exact: true }).selectOption('10000000-0000-4000-8000-000000000001')
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Account role')).toHaveCount(0)
  await page.getByRole('button', { name: 'Send Officer invitation' }).click()
  await expect(page.getByRole('status')).toContainText('Officer account created and invitation sent')
  expect(invitations).toEqual([{ displayName: 'Sample Officer', email: 'officer@example.test', departmentId: '10000000-0000-4000-8000-000000000001' }])
})

test('Citizen cannot enter Officer or Officer-provisioning routes', async ({ page }) => {
  await mockSupabase(page); await login(page)
  await expect(page).toHaveURL(/\/workspace$/)
  for (const path of ['/officer/complaints', '/admin/officers/new']) {
    await page.evaluate((path) => { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
    await expect(page.getByRole('heading', { name: path.startsWith('/admin') ? 'Administrator access required' : 'Officer access required' })).toBeVisible()
  }
})

test('Administrator sees email-delivery refusal without false success or automatic retry', async ({ page }) => {
  await mockSupabase(page, 'administrator')
  let attempts = 0
  await page.route('https://*.supabase.co/functions/v1/provision-officer', async (route) => {
    attempts++
    await route.fulfill({ status: 409, json: { code: 'email_delivery_unavailable' } })
  })
  await login(page)
  await page.getByRole('link', { name: 'User management', exact: true }).click()
  await page.getByRole('link', { name: 'Create Officer account' }).click()
  await page.getByLabel('Officer full name').fill('Sample Officer')
  await page.getByLabel('Officer email address').fill('officer@example.test')
  await page.getByLabel('Department', { exact: true }).selectOption('10000000-0000-4000-8000-000000000001')
  await page.getByRole('button', { name: 'Send Officer invitation' }).click()
  await expect(page.getByRole('alert')).toContainText('configure the email service')
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(attempts).toBe(1)
})
