// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvitationError, provisionHandler } from './handler'
import type { ProvisionPorts } from './handler'

const app = 'http://127.0.0.1:5173'
const input = { email: 'officer@example.test', displayName: 'Sample Officer', departmentId: '10000000-0000-4000-8000-000000000001' }
let ports: ProvisionPorts
beforeEach(() => {
  ports = { authenticate: vi.fn(async () => ({ administrator: true })), departmentActive: vi.fn(async () => true), invite: vi.fn(async () => ({ id: 'new-user' })), promote: vi.fn(async () => undefined) }
})
const send = (body: unknown = input, headers: Record<string, string> = { Authorization: 'Bearer valid-user-jwt', Origin: app }) => provisionHandler(ports, [app], app)(new Request(`${app}/function`, { method: 'POST', headers, body: JSON.stringify(body) }))
describe('Administrator-only Officer invitations', () => {
  it('requires a verified session before any invitation', async () => {
    expect((await send(input, { Origin: app })).status).toBe(401)
    vi.mocked(ports.authenticate).mockResolvedValue(null)
    expect((await send()).status).toBe(401)
    expect(ports.invite).not.toHaveBeenCalled()
  })
  it('denies non-Administrators regardless of supplied roles', async () => {
    vi.mocked(ports.authenticate).mockResolvedValue({ administrator: false })
    expect((await send({ ...input, role: 'administrator' })).status).toBe(403)
    expect(ports.invite).not.toHaveBeenCalled()
  })
  it('denies foreign origins and supports an allowed preflight without privileges', async () => {
    expect((await send(input, { Origin: 'https://foreign.example.test' })).status).toBe(403)
    const response = await provisionHandler(ports, [app], app)(new Request(app, { method: 'OPTIONS', headers: { Origin: app } }))
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(app)
    expect(ports.invite).not.toHaveBeenCalled()
  })
  it.each([{ ...input, email: 'invalid' }, { ...input, displayName: ' ' }, { ...input, departmentId: 'invalid' }, { ...input, displayName: 'x'.repeat(101) }, { ...input, ignored: 'x'.repeat(4096) }])('rejects malformed/bounded input before sending', async (body) => {
    expect((await send(body)).status).toBe(400)
    expect(ports.invite).not.toHaveBeenCalled()
  })
  it('rejects an unavailable department', async () => {
    vi.mocked(ports.departmentActive).mockResolvedValue(false)
    expect((await send()).status).toBe(400)
    expect(ports.invite).not.toHaveBeenCalled()
  })
  it('uses the server redirect, normalized identity and fixed Officer promotion', async () => {
    const response = await send({ ...input, email: ' OFFICER@EXAMPLE.TEST ', role: 'administrator', redirectTo: 'https://foreign.example.test' })
    expect(response.status).toBe(200)
    expect(ports.invite).toHaveBeenCalledWith(input, `${app}/accept-invite`)
    expect(ports.promote).toHaveBeenCalledWith('new-user', input)
    expect(await response.json()).toEqual({ code: 'officer_invited', userId: 'new-user' })
  })
  it('reports uncertain invitation failures without proceeding to promotion', async () => {
    vi.mocked(ports.invite).mockRejectedValue(new Error('ambiguous network error'))
    expect(await (await send()).json()).toEqual({ code: 'invitation_incomplete' })
    expect(ports.promote).not.toHaveBeenCalled()
  })
  it.each(['email_delivery_unavailable', 'email_rate_limited'] as const)('reports %s without promotion or automatic retry', async (code) => {
    vi.mocked(ports.invite).mockRejectedValue(new InvitationError(code))
    const response = await send()
    expect(response.status).toBe(code === 'email_rate_limited' ? 429 : 409)
    expect(await response.json()).toEqual({ code })
    expect(ports.invite).toHaveBeenCalledTimes(1)
    expect(ports.promote).not.toHaveBeenCalled()
  })
  it('reports partial promotion failure and never claims Officer access', async () => {
    vi.mocked(ports.promote).mockRejectedValue(new Error('administrator revoked'))
    const response = await send()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ code: 'officer_access_pending', userId: 'new-user' })
  })
})
