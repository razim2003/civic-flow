// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_FILE_SIZE, validateFile } from './evidence'

describe('evidence client checks (usability, not a malware guarantee)', () => {
  it.each([
    ['image/jpeg', new Uint8Array([255, 216, 255, 224])],
    ['image/png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    ['application/pdf', '%PDF-1.7\n'],
  ])('accepts a matching %s header', async (type, body) => {
    expect(await validateFile(new File([body], 'sample', { type }))).toBe('')
  })
  it('rejects spoofed MIME, unsupported types, empty and oversized files', async () => {
    expect(await validateFile(new File(['<script>alert(1)</script>'], 'fake.pdf', { type: 'application/pdf' }))).toContain('does not match')
    expect(await validateFile(new File(['hello'], 'sample.html', { type: 'text/html' }))).toContain('Only JPEG')
    expect(await validateFile(new File([], 'empty.pdf', { type: 'application/pdf' }))).toContain('non-empty')
    expect(await validateFile(new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'large.pdf', { type: 'application/pdf' }))).toContain('5 MiB')
  })
})
