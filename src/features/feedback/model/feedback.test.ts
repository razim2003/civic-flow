// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { feedbackInputSchema, feedbackMessage } from './feedback'

describe('CF-19 feedback input matches the submit_feedback contract', () => {
  it.each([1, 2, 3, 4, 5])('accepts rating %s', (rating) => expect(feedbackInputSchema.safeParse({ rating, comment: '' }).success).toBe(true))
  it.each([0, 6, 2.5, undefined])('rejects rating %s', (rating) => expect(feedbackInputSchema.safeParse({ rating, comment: '' }).success).toBe(false))
  it('trims comments and enforces 2,000 characters', () => {
    expect(feedbackInputSchema.parse({ rating: 4, comment: '  Good  ' }).comment).toBe('Good')
    expect(feedbackInputSchema.safeParse({ rating: 4, comment: 'x'.repeat(2000) }).success).toBe(true)
    expect(feedbackInputSchema.safeParse({ rating: 4, comment: 'x'.repeat(2001) }).success).toBe(false)
  })
  it('translates database error codes into user guidance', () => {
    expect(feedbackMessage({ message: 'feedback_exists' })).toMatch(/already submitted/)
    expect(feedbackMessage({ message: 'feedback_closed' })).toMatch(/after your complaint is resolved/)
    expect(feedbackMessage(new Error('invalid_feedback'))).toMatch(/rating from 1 to 5/)
    expect(feedbackMessage(new Error('other'))).toBe('')
  })
})
