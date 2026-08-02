import { BLACKJACK_DECK_MAX, BLACKJACK_DECK_MIN } from 'gambling-bot-shared/blackjack'
import { describe, expect, it } from 'vitest'

import { DECK, SUITES, VALUES, createDeck } from '@/utils/casino/blackjack/deck'

describe('blackjack deck', () => {
  it('DECK defaults to the minimum multi-deck shoe', () => {
    expect(DECK).toHaveLength(52 * BLACKJACK_DECK_MIN)
    expect(SUITES).toHaveLength(4)
    expect(VALUES).toHaveLength(13)
  })

  it('createDeck builds shoes from 2 to 8 decks', () => {
    expect(createDeck(BLACKJACK_DECK_MIN)).toHaveLength(52 * 2)
    expect(createDeck(6)).toHaveLength(52 * 6)
    expect(createDeck(BLACKJACK_DECK_MAX)).toHaveLength(52 * 8)
  })
})
