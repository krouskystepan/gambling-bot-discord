import { describe, expect, it } from 'vitest'

import {
  applyAction,
  canSplit,
  dealerDrawOne,
  dealerShouldDraw,
  resolveResult
} from '@/utils/casino/blackjack/engine'
import type { EngineState } from '@/utils/casino/blackjack/types'

import { card } from '../../../helpers/cards'

const baseState = (
  playerCards: ReturnType<typeof card>[],
  dealerCards: ReturnType<typeof card>[],
  betAmount = 100
): EngineState => ({
  deck: [],
  deckIndex: 0,
  hands: [
    {
      cards: playerCards,
      betAmount,
      finished: false,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'PLAYER',
  dealerCards
})

describe('resolveResult', () => {
  it('player bust loses bet', () => {
    const state = baseState(
      [card('10', 10), card('5', 5), card('9', 9)],
      [card('10', 10), card('8', 8)]
    )

    expect(resolveResult(state, 0)).toEqual({
      finished: true,
      resultId: 'PB',
      payout: 0
    })
  })

  it('dealer bust pays double bet', () => {
    const state = baseState(
      [card('10', 10), card('K', 10)],
      [card('10', 10), card('5', 5), card('9', 9)]
    )

    expect(resolveResult(state, 0)).toEqual({
      finished: true,
      resultId: 'DB',
      payout: 200
    })
  })

  it('push returns original bet', () => {
    const state = baseState(
      [card('10', 10), card('8', 8)],
      [card('9', 9), card('9', 9)]
    )

    expect(resolveResult(state, 0)).toEqual({
      finished: true,
      resultId: 'PUSH',
      payout: 100
    })
  })

  it('player win pays double bet', () => {
    const state = baseState(
      [card('10', 10), card('K', 10)],
      [card('9', 9), card('9', 9)]
    )

    expect(resolveResult(state, 0)).toEqual({
      finished: true,
      resultId: 'PW',
      payout: 200
    })
  })

  it('uses custom win / push multipliers', () => {
    const multipliers = { win: 1.8, blackjack: 3, push: 0.5, insurance: 3 }
    const winState = baseState(
      [card('10', 10), card('K', 10)],
      [card('9', 9), card('9', 9)]
    )
    const pushState = baseState(
      [card('10', 10), card('8', 8)],
      [card('9', 9), card('9', 9)]
    )

    expect(resolveResult(winState, 0, multipliers)).toEqual({
      finished: true,
      resultId: 'PW',
      payout: 180
    })
    expect(resolveResult(pushState, 0, multipliers)).toEqual({
      finished: true,
      resultId: 'PUSH',
      payout: 50
    })
  })

  it('returns dealer win when hand index is invalid', () => {
    const state = baseState(
      [card('10', 10), card('8', 8)],
      [card('9', 9), card('9', 9)]
    )

    expect(resolveResult(state, 5)).toEqual({
      finished: true,
      resultId: 'DW',
      payout: 0
    })
  })

  it('player loss returns no payout', () => {
    const state = baseState(
      [card('9', 9), card('7', 7)],
      [card('10', 10), card('K', 10)]
    )

    expect(resolveResult(state, 0)).toEqual({
      finished: true,
      resultId: 'DW',
      payout: 0
    })
  })
})

describe('dealerDrawOne', () => {
  it('draws from the deck into dealer hand', () => {
    const state: EngineState = {
      ...baseState([], [card('10', 10)]),
      deck: [card('5', 5)],
      deckIndex: 0
    }

    dealerDrawOne(state)

    expect(state.dealerCards).toHaveLength(2)
    expect(state.deckIndex).toBe(1)
  })
})

describe('applyAction edge cases', () => {
  it('no-ops when hand is already finished', () => {
    const state = baseState([card('10', 10), card('8', 8)], [])
    state.hands[0]!.finished = true

    expect(applyAction(state, 'HIT')).toEqual({ finished: false })
    expect(state.hands[0]?.cards).toHaveLength(2)
  })

  it('rejects invalid split', () => {
    const state = baseState([card('8', 8), card('9', 9)], [])

    expect(() => applyAction(state, 'SPLIT')).toThrow('Invalid split')
    expect(state.hands).toHaveLength(1)
  })

  it('returns finished false for unknown action', () => {
    const state = baseState([card('10', 10), card('8', 8)], [])

    expect(
      applyAction(
        state,
        'UNKNOWN' as unknown as Parameters<typeof applyAction>[1]
      )
    ).toEqual({ finished: false })
  })
})

describe('dealerShouldDraw', () => {
  it('draws on 16', () => {
    const state = baseState([], [card('10', 10), card('6', 6)])
    expect(dealerShouldDraw(state)).toBe(true)
  })

  it('stands on 17', () => {
    const state = baseState([], [card('10', 10), card('7', 7)])
    expect(dealerShouldDraw(state)).toBe(false)
  })
})

describe('canSplit', () => {
  it('allows split on matching pair', () => {
    const state = baseState([card('8', 8), card('8', 8)], [])
    expect(canSplit(state)).toBe(true)
  })

  it('disallows split when hand does not have two cards', () => {
    const state = baseState([card('8', 8)], [])
    expect(canSplit(state)).toBe(false)
  })

  it('throws when deck is exhausted', () => {
    const state: EngineState = {
      ...baseState([card('10', 10)], []),
      deck: [],
      deckIndex: 0
    }

    expect(() => dealerDrawOne(state)).toThrow('Deck exhausted')
    expect(state.dealerCards).toHaveLength(0)
  })

  it('disallows split on different ranks', () => {
    const state = baseState([card('8', 8), card('9', 9)], [])
    expect(canSplit(state)).toBe(false)
  })

  it('returns false when active hand is missing', () => {
    const state = baseState([card('8', 8), card('8', 8)], [])
    state.activeHandIndex = 3
    expect(canSplit(state)).toBe(false)
  })

  it('allows resplit on a non-Ace pair when under the hand cap', () => {
    const state: EngineState = {
      ...baseState([card('8', 8), card('8', 8)], []),
      hands: [
        {
          cards: [card('8', 8), card('8', 8)],
          betAmount: 100,
          finished: false,
          isSplitHand: true
        },
        {
          cards: [card('8', 8), card('9', 9)],
          betAmount: 100,
          finished: false,
          isSplitHand: true
        }
      ],
      activeHandIndex: 0
    }
    expect(canSplit(state)).toBe(true)
  })

  it('allows resplit when already at 3 hands', () => {
    const pairHand = {
      cards: [card('8', 8), card('8', 8)],
      betAmount: 100,
      finished: false,
      isSplitHand: true
    }
    const otherHand = {
      cards: [card('8', 8), card('9', 9)],
      betAmount: 100,
      finished: false,
      isSplitHand: true
    }
    const state: EngineState = {
      ...baseState([card('8', 8), card('8', 8)], []),
      hands: [pairHand, otherHand, { ...otherHand }],
      activeHandIndex: 0
    }
    expect(canSplit(state)).toBe(true)
  })

  it('disallows split at the 4-hand cap', () => {
    const pairHand = {
      cards: [card('8', 8), card('8', 8)],
      betAmount: 100,
      finished: false,
      isSplitHand: true
    }
    const otherHand = {
      cards: [card('8', 8), card('9', 9)],
      betAmount: 100,
      finished: false,
      isSplitHand: true
    }
    const state: EngineState = {
      ...baseState([card('8', 8), card('8', 8)], []),
      hands: [pairHand, otherHand, { ...otherHand }, { ...otherHand }],
      activeHandIndex: 0
    }
    expect(canSplit(state)).toBe(false)
  })

  it('disallows Ace resplit after an earlier split', () => {
    const state: EngineState = {
      ...baseState([card('A', 11), card('A', 11)], []),
      hands: [
        {
          cards: [card('A', 11), card('A', 11)],
          betAmount: 100,
          finished: false,
          isSplitHand: true
        },
        {
          cards: [card('8', 8), card('9', 9)],
          betAmount: 100,
          finished: false,
          isSplitHand: true
        }
      ],
      activeHandIndex: 0
    }
    expect(canSplit(state)).toBe(false)
  })

  it('allows Ace split from the original deal', () => {
    const state = baseState([card('A', 11), card('A', 11)], [])
    expect(canSplit(state)).toBe(true)
  })
})
