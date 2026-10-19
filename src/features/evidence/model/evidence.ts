import { z } from 'zod'

export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const MAX_FILES = 5
export const evidenceSchema = z.object({ id: z.uuid(), complaint_id: z.uuid(), object_path: z.string(), original_filename: z.string(), declared_content_type: z.string(), declared_size_bytes: z.number(), state: z.enum(['pending', 'attached']), expires_at: z.string(), attached_at: z.string().nullable() })
export type Evidence = z.infer<typeof evidenceSchema>
export async function validateFile(file: File) {
  if (!file.name.trim() || file.name.length > 200) return 'Use a filename between 1 and 200 characters.'
  if (!file.size || file.size > MAX_FILE_SIZE) return 'Each file must be non-empty and no larger than 5 MiB.'
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return 'Only JPEG, PNG and PDF files are supported.'
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const valid = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
      : [37, 80, 68, 70, 45].every((value, i) => bytes[i] === value)
  return valid ? '' : 'The file content does not match its type. Choose a JPEG, PNG or PDF file.'
}
export function fileSize(size: number) { return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KiB` : `${(size / 1024 / 1024).toFixed(1)} MiB` }
