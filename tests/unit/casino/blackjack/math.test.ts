import { describe, expect, it } from 'vitest'

import { calculateHandValue } from '@/utils/casino/blackjack/math'

import { card } from '../../../helpers/cards'

describe('calculateHandValue', () => {
  it('counts a hard hand', () => {
    expect(calculateHandValue([card('K', 10), card('9', 9)])).toBe(19)
  })

  it('counts a soft ace', () => {
    expect(calculateHandValue([card('A', 11), card('6', 6)])).toBe(17)
  })

  it('handles multiple aces without exceeding 21 when possible', () => {
    expect(
      calculateHandValue([card('A', 11), card('A', 11), card('9', 9)])
    ).toBe(21)
  })

  it('counts a bust hand above 21', () => {
    expect(
      calculateHandValue([card('10', 10), card('5', 5), card('9', 9)])
    ).toBe(24)
  })
})
