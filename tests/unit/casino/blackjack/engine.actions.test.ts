import { describe, expect, it } from 'vitest'

import { Card } from '@/utils/casino/blackjack/deck'
import { EngineState, applyAction } from '@/utils/casino/blackjack/engine'
import { calculateHandValue } from '@/utils/casino/blackjack/math'

import { card } from '../../../helpers/cards'

const makeDeck = (...cards: Card[]): Card[] => cards

const playerState = (
  handCards: Card[],
  deck: Card[],
  betAmount = 100
): EngineState => ({
  deck,
  deckIndex: 0,
  hands: [
    {
      cards: handCards,
      betAmount,
      finished: false,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'PLAYER',
  dealerCards: []
})

describe('applyAction', () => {
  it('hit adds a card from the deck', () => {
    const deck = makeDeck(card('5', 5), card('3', 3))
    const state = playerState([card('10', 10), card('6', 6)], deck)

    const result = applyAction(state, 'HIT')

    expect(result).toEqual({ finished: false })
    expect(state.hands[0]?.cards).toHaveLength(3)
    expect(state.deckIndex).toBe(1)
    expect(calculateHandValue(state.hands[0]!.cards)).toBe(21)
  })

  it('hit bust finishes the hand', () => {
    const deck = makeDeck(card('9', 9))
    const state = playerState([card('10', 10), card('5', 5)], deck)

    applyAction(state, 'HIT')

    expect(state.hands[0]?.finished).toBe(true)
    expect(calculateHandValue(state.hands[0]!.cards)).toBeGreaterThan(21)
  })

  it('double down draws one card and finishes the hand', () => {
    const deck = makeDeck(card('2', 2))
    const state = playerState([card('10', 10), card('6', 6)], deck)

    applyAction(state, 'DOUBLE')

    expect(state.hands[0]?.finished).toBe(true)
    expect(state.hands[0]?.cards).toHaveLength(3)
    expect(state.deckIndex).toBe(1)
  })

  it('stand marks the hand finished', () => {
    const state = playerState([card('10', 10), card('8', 8)], [])

    applyAction(state, 'STAND')

    expect(state.hands[0]?.finished).toBe(true)
  })

  it('split creates a second hand and draws cards', () => {
    const deck = makeDeck(card('4', 4), card('5', 5), card('6', 6))
    const state = playerState([card('8', 8), card('8', 8)], deck)

    const result = applyAction(state, 'SPLIT')

    expect(result).toEqual({ finished: false })
    expect(state.hands).toHaveLength(2)
    expect(state.hands[0]?.isSplitHand).toBe(true)
    expect(state.hands[1]?.isSplitHand).toBe(true)
    expect(state.hands[0]?.cards).toHaveLength(2)
    expect(state.hands[1]?.cards).toHaveLength(2)
  })

  it('ace split ends player turn immediately', () => {
    const deck = makeDeck(card('4', 4), card('5', 5))
    const state = playerState([card('A', 11), card('A', 11)], deck)

    const result = applyAction(state, 'SPLIT')

    expect(result).toEqual({ finished: false, dealerTurn: true })
    expect(state.hands[0]?.finished).toBe(true)
    expect(state.hands[1]?.finished).toBe(true)
  })
})
