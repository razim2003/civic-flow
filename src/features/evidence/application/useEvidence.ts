import { useCallback, useRef, useState } from 'react'
import { useResource } from '../../../shared/lib/useResource'
import { complaintMessage } from '../../../shared/errors/complaintMessage'
import { downloadEvidence, listEvidence, uploadEvidence } from '../data/evidence-api'
import { MAX_FILES, validateFile } from '../model/evidence'
import type { Evidence } from '../model/evidence'

type UploadItem = { key: string; file: File; state: 'ready' | 'uploading' | 'done' | 'error'; error: string }
export function useEvidence(complaintId: string, onUploaded?: () => void) {
  const resource = useResource(useCallback(() => listEvidence(complaintId), [complaintId]))
  const [items, setItems] = useState<UploadItem[]>([])
  const [error, setError] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [downloading, setDownloading] = useState('')
  const inFlight = useRef(new Set<string>())
  async function add(files: File[]) {
    setError(''); setSelecting(true)
    try {
      const outstanding = items.filter((item) => item.state !== 'done').length
      if ((resource.data?.length ?? 0) + outstanding + files.length > MAX_FILES) { setError('A complaint can have up to five files.'); return }
      for (const file of files) { const message = await validateFile(file); if (message) { setError(`${file.name}: ${message}`); return } }
      setItems((previous) => [...previous, ...files.map((file) => ({ key: crypto.randomUUID(), file, state: 'ready' as const, error: '' }))])
    } catch { setError('The files could not be read. Please choose them again.') }
    finally { setSelecting(false) }
  }
  async function upload(item: UploadItem) {
    if (inFlight.current.has(item.key)) return
    inFlight.current.add(item.key)
    setItems((all) => all.map((value) => value.key === item.key ? { ...value, state: 'uploading', error: '' } : value))
    try {
      await uploadEvidence(complaintId, item.file, item.key)
      setItems((all) => all.map((value) => value.key === item.key ? { ...value, state: 'done' } : value))
      await resource.reload(); onUploaded?.()
    } catch (error) { setItems((all) => all.map((value) => value.key === item.key ? { ...value, state: 'error', error: complaintMessage(error) } : value)) }
    finally { inFlight.current.delete(item.key) }
  }
  async function download(evidence: Evidence) {
    setError(''); setDownloading(evidence.id)
    try { await downloadEvidence(evidence) } catch (error) { setError(complaintMessage(error)) } finally { setDownloading('') }
  }
  function remove(key: string) { setItems((all) => all.filter((item) => item.key !== key || item.state === 'uploading')) }
  return { resource, items, error, selecting, downloading, add, upload, download, remove }
}
