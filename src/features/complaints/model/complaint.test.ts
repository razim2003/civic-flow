import { describe, expect, it } from 'vitest'
import { canWithdraw, submissionSchema, withdrawalSchema } from './complaint'
import { parseCoordinate, validPoint } from '../../../shared/location/coordinates'

const valid = { categoryId: '00000000-0000-4000-8000-000000000001', description: 'A damaged public road', locationText: 'School Road', latitude: 6.927, longitude: 79.861 }
describe('complaint form validation and accessible coordinates', () => {
  it('trims meaningful text without discarding zero coordinates', () => {
    expect(submissionSchema.parse({ ...valid, description: ` ${valid.description} `, latitude: 0, longitude: 0 })).toMatchObject({ description: valid.description, latitude: 0, longitude: 0 })
    expect(validPoint('0', '0')).toEqual([0, 0])
  })
  it.each([{ categoryId: '' }, { description: 'short' }, { description: 'x'.repeat(5001) }, { locationText: ' ' }, { locationText: 'x'.repeat(301) }, { latitude: 91 }, { longitude: -181 }, { latitude: NaN }, { longitude: Infinity }])('rejects invalid field values %s', (invalid) => {
    expect(submissionSchema.safeParse({ ...valid, ...invalid }).success).toBe(false)
  })
  it('distinguishes a blank coordinate from zero and refuses to put invalid points on the map', () => {
    expect(parseCoordinate(' ')).toBeNaN()
    expect(validPoint('', '79')).toBeNull()
    expect(validPoint('91', '79')).toBeNull()
    expect(validPoint('6.927', '79.861')).toEqual([6.927, 79.861])
  })
})

describe('owner withdrawal intent validation', () => {
  it('requires a reason and explicit confirmation', () => {
    expect(withdrawalSchema.safeParse({ reason: ' ', confirmed: true }).success).toBe(false)
    expect(withdrawalSchema.safeParse({ reason: 'The issue has already been fixed.', confirmed: false }).success).toBe(false)
    expect(withdrawalSchema.parse({ reason: '  The issue has already been fixed.  ', confirmed: true }).reason).toBe('The issue has already been fixed.')
    expect(withdrawalSchema.safeParse({ reason: 'x'.repeat(2001), confirmed: true }).success).toBe(false)
  })
  it('allows unresolved workflow states and excludes both final states', () => {
    expect((['submitted', 'under_review', 'in_progress'] as const).every(canWithdraw)).toBe(true)
    expect(canWithdraw('resolved')).toBe(false)
    expect(canWithdraw('withdrawn')).toBe(false)
  })
})

