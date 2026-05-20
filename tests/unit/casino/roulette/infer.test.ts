import { describe, expect, it } from 'vitest'

import { inferTypeFromValue } from '@/utils/casino/roulette/infer'

describe('inferTypeFromValue', () => {
  it('infers color bets', () => {
    expect(inferTypeFromValue('red')).toBe('color')
    expect(inferTypeFromValue('BLACK')).toBe('color')
  })

  it('infers parity bets', () => {
    expect(inferTypeFromValue('even')).toBe('parity')
  })

  it('infers range bets', () => {
    expect(inferTypeFromValue('low')).toBe('range')
  })

  it('infers dozen bets', () => {
    expect(inferTypeFromValue('d1')).toBe('dozen')
  })

  it('infers column bets', () => {
    expect(inferTypeFromValue('c2')).toBe('column')
  })

  it('infers number bets', () => {
    expect(inferTypeFromValue('17')).toBe('number')
  })

  it('throws on invalid values', () => {
    expect(() => inferTypeFromValue('foo')).toThrow('Invalid bet value: foo')
  })
})
