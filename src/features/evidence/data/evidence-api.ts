import { supabase } from '../../../shared/lib/supabase/client'
import { evidenceSchema } from '../model/evidence'
import type { Evidence } from '../model/evidence'

export async function listEvidence(complaintId: string) {
  const { data, error } = await supabase.from('complaint_evidence').select('id,complaint_id,object_path,original_filename,declared_content_type,declared_size_bytes,state,expires_at,attached_at').eq('complaint_id', complaintId).eq('state', 'attached').order('created_at')
  if (error) throw error
  return evidenceSchema.array().parse(data)
}
export async function uploadEvidence(complaintId: string, file: File, requestId: string) {
  const reserved = await supabase.rpc('reserve_evidence', { p_complaint_id: complaintId, p_filename: file.name, p_content_type: file.type, p_size: file.size, p_request_id: requestId }).single()
  if (reserved.error) throw reserved.error
  const evidence = evidenceSchema.parse(reserved.data)
  if (evidence.state === 'attached') return evidence
  const uploaded = await supabase.storage.from('complaint-evidence').upload(evidence.object_path, file, { contentType: file.type, upsert: false })
  // A failed response can hide an already completed upload. Finalization checks
  // the real object's owner/type/size and safely resumes that case.
  const finalized = await supabase.rpc('finalize_evidence', { p_evidence_id: evidence.id }).single()
  if (finalized.error) throw uploaded.error ?? finalized.error
  return evidenceSchema.parse(finalized.data)
}
export async function downloadEvidence(evidence: Evidence) {
  const { data, error } = await supabase.storage.from('complaint-evidence').download(evidence.object_path)
  if (error) throw error
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = Array.from(evidence.original_filename, (character) => character.charCodeAt(0) < 32 || character === '/' || character === '\\' ? '_' : character).join('') || 'evidence'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
