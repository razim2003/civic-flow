import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useAuth, roles } from '../../auth'
import type { Profile } from '../../auth'
import { listDepartments, listUsers, updateUser } from '../data/users-api'
import { userMessage } from '../../../shared/errors/message'

const editSchema = z.object({ id: z.uuid(), role: z.enum(roles), departmentId: z.uuid().nullable(), active: z.boolean(), name: z.string().trim().min(1).max(100) }).refine((v) => v.role === 'officer' ? !!v.departmentId : v.departmentId === null)

export function useUsers() {
  const { profile, refreshProfile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const request = useRef(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++request.current } }, [])
  const load = useCallback(async () => {
    const ticket = ++request.current
    setLoading(true); setError('')
    try {
      const [result, departments] = await Promise.all([listUsers(search, page), listDepartments()])
      if (!mounted.current || ticket !== request.current) return
      setUsers(result.users); setCount(result.count); setDepartments(departments)
    } catch (error) { if (mounted.current && ticket === request.current) { setUsers([]); setError(userMessage(error)) } }
    finally { if (mounted.current && ticket === request.current) setLoading(false) }
  }, [page, search])
  useEffect(() => { const timeout = setTimeout(() => { void load() }, 250); return () => { clearTimeout(timeout); ++request.current } }, [load])
  async function save(value: z.input<typeof editSchema>) {
    if (saving) return false
    const parsed = editSchema.safeParse(value)
    if (!parsed.success) { setError('Enter a valid name and select a department for Officer access.'); return false }
    setSaving(true); setError(''); setSuccess('')
    try {
      await updateUser(parsed.data)
      if (!mounted.current) return true
      if (value.id === profile?.id) await refreshProfile()
      else { await load(); setSuccess('User access updated.') }
      return true
    } catch (error) { if (mounted.current) setError(userMessage(error)); return false }
    finally { if (mounted.current) setSaving(false) }
  }
  return { users, departments, count, page, setPage, search, setSearch: (value: string) => { setPage(0); setSearch(value) }, loading, saving, error, success, load, save }
}
