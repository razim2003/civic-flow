export type OfficerInput = { email: string; displayName: string; departmentId: string }
export class InvitationError extends Error {
  constructor(readonly code: 'email_delivery_unavailable' | 'email_rate_limited') { super(code); this.name = 'InvitationError' }
}
export type ProvisionPorts = {
  authenticate: (token: string) => Promise<{ administrator: boolean } | null>
  departmentActive: (id: string) => Promise<boolean>
  invite: (input: OfficerInput, redirectTo: string) => Promise<{ id: string }>
  promote: (id: string, input: OfficerInput) => Promise<void>
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function provisionHandler(ports: ProvisionPorts, origins: string[], appUrl: string) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' }
    if (origin && origins.includes(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' })
    const reply = (status: number, code: string, extra: Record<string, string> = {}) => new Response(JSON.stringify({ code, ...extra }), { status, headers })
    if (origin && !origins.includes(origin)) return reply(403, 'origin_denied')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, 'method_not_allowed')
    const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (!token) return reply(401, 'not_authenticated')
    let administrator: boolean
    try { const actor = await ports.authenticate(token); if (!actor) return reply(401, 'not_authenticated'); administrator = actor.administrator }
    catch { return reply(401, 'not_authenticated') }
    if (!administrator) return reply(403, 'administrator_required')
    let input: OfficerInput
    try {
      const text = await request.text()
      if (text.length > 4096) return reply(400, 'invalid_input')
      const data: unknown = JSON.parse(text)
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return reply(400, 'invalid_input')
      const values = data as Record<string, unknown>
      if (typeof values.email !== 'string' || typeof values.displayName !== 'string' || typeof values.departmentId !== 'string') return reply(400, 'invalid_input')
      input = { email: values.email.trim().toLowerCase(), displayName: values.displayName.trim(), departmentId: values.departmentId }
      if (input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || !input.displayName || input.displayName.length > 100 || !uuid.test(input.departmentId)) return reply(400, 'invalid_input')
      if (!await ports.departmentActive(input.departmentId)) return reply(400, 'department_unavailable')
    } catch { return reply(400, 'invalid_input') }
    let invited: { id: string }
    try { invited = await ports.invite(input, `${appUrl}/accept-invite`) }
    catch (error) { return error instanceof InvitationError ? reply(error.code === 'email_rate_limited' ? 429 : 409, error.code) : reply(409, 'invitation_incomplete') }
    // Auth invitation and database role changes are separate transactions.
    // Failure leaves no Officer privileges; never claim the promotion succeeded.
    try { await ports.promote(invited.id, input) }
    catch { return reply(409, 'officer_access_pending', { userId: invited.id }) }
    return reply(200, 'officer_invited', { userId: invited.id })
  }
}
