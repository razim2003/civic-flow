import { useCallback, useRef, useState } from 'react'
import { userMessage } from '../../../shared/errors/message'
import { useResource } from '../../../shared/lib/useResource'
import { listCategoriesForAdmin, saveCategory } from '../data/categories-api'
import { categoryInputSchema, categoryMessage } from '../model/category'
import type { CategoryInput } from '../model/category'

export function useCategoryAdmin() {
  const loader = useCallback(() => listCategoriesForAdmin(), [])
  const state = useResource(loader)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState('')
  const inFlight = useRef(false)
  async function save(input: CategoryInput) {
    if (inFlight.current) return false
    setSaveError(''); setSuccess('')
    const parsed = categoryInputSchema.safeParse(input)
    if (!parsed.success) { setSaveError(parsed.error.issues[0].message); return false }
    inFlight.current = true; setSaving(true)
    try {
      const saved = await saveCategory(parsed.data)
      await state.reload()
      setSuccess(parsed.data.id ? `Category “${saved.name}” updated.` : `Category “${saved.name}” created.`)
      return true
    } catch (error) { setSaveError(categoryMessage(error) || userMessage(error)); return false }
    finally { inFlight.current = false; setSaving(false) }
  }
  return { ...state, saving, saveError, success, save, clearMessages: () => { setSaveError(''); setSuccess('') } }
}
