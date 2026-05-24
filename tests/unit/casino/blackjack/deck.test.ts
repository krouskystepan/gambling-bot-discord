import { describe, expect, it } from 'vitest'

import { DECK, SUITES, VALUES } from '@/utils/casino/blackjack/deck'

describe('blackjack deck', () => {
  it('DECK contains two full 52-card decks', () => {
    expect(DECK).toHaveLength(52 * 2)
    expect(SUITES).toHaveLength(4)
    expect(VALUES).toHaveLength(13)
  })
})
