import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import type { Profile } from '../model/auth'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), logout: vi.fn(), subscribe: vi.fn() }))
vi.mock('../data/auth-api', () => ({ authApi: mocks }))

function StateView() {
  const { profile, error, loading, logout } = useAuth()
  return <><span>{loading ? 'loading' : profile?.display_name ?? error ?? 'signed out'}</span><button onClick={() => void logout()}>Sign out</button></>
}
function fixture(name: string): Profile {
  return { id: '00000000-0000-4000-8000-000000000001', display_name: name, role: 'citizen', is_active: true, department_id: null, created_at: '', updated_at: '' }
}

describe('session boundary race handling', () => {
  let change: (id: string | null, recovery: boolean) => void
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.subscribe.mockImplementation((callback) => { change = callback; callback(null, false); return () => undefined })
    mocks.logout.mockResolvedValue(undefined)
  })
  it('does not restore a profile whose request finished after sign-out', async () => {
    let resolve!: (profile: Profile) => void
    mocks.profile.mockReturnValue(new Promise<Profile>((r) => { resolve = r }))
    render(<AuthProvider><StateView /></AuthProvider>)
    act(() => change('00000000-0000-4000-8000-000000000001', false))
    await waitFor(() => expect(mocks.profile).toHaveBeenCalled())
    act(() => change(null, false))
    await act(async () => resolve(fixture('Stale user')))
    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(screen.queryByText('Stale user')).not.toBeInTheDocument()
  })
  it('clears a previous user before loading a different account', async () => {
    mocks.profile.mockResolvedValueOnce(fixture('First user')).mockReturnValueOnce(new Promise(() => undefined))
    render(<AuthProvider><StateView /></AuthProvider>)
    act(() => change('00000000-0000-4000-8000-000000000001', false))
    await screen.findByText('First user')
    act(() => change('00000000-0000-4000-8000-000000000002', false))
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByText('First user')).not.toBeInTheDocument()
  })
  it('fails closed when profile access fails', async () => {
    mocks.profile.mockRejectedValue(new Error('not_authorized'))
    render(<AuthProvider><StateView /></AuthProvider>)
    act(() => change('00000000-0000-4000-8000-000000000001', false))
    await screen.findByText('You do not have permission to perform this action.')
    expect(screen.queryByText('loading')).not.toBeInTheDocument()
  })
})
