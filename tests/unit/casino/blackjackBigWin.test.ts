import { describe, expect, it } from 'vitest'

import type { EngineState } from '@/utils/casino/blackjack/types'
import { collectBlackjackBigWinLines } from '@/utils/casino/blackjackBigWin'

import { card } from '../../helpers/cards'

const winningEngine = (betAmount = 100): EngineState => ({
  deck: [],
  deckIndex: 0,
  hands: [
    {
      cards: [card('10', 10), card('K', 10)],
      betAmount,
      finished: true,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'PLAYER',
  dealerCards: [card('10', 10), card('8', 8)]
})

describe('collectBlackjackBigWinLines', () => {
  it('returns lines when payout multiplier meets the minimum', () => {
    const lines = collectBlackjackBigWinLines({
      engine: winningEngine(),
      globalSettings: undefined,
      minMultiplier: 2
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('x2.00')
  })

  it('returns empty when minimum is disabled', () => {
    const lines = collectBlackjackBigWinLines({
      engine: winningEngine(),
      globalSettings: undefined,
      minMultiplier: 0
    })

    expect(lines).toEqual([])
  })

  it('returns empty when payout multiplier is below the minimum', () => {
    const lines = collectBlackjackBigWinLines({
      engine: winningEngine(),
      globalSettings: undefined,
      minMultiplier: 2.5
    })

    expect(lines).toEqual([])
  })

  it('skips hands with no payout', () => {
    const lines = collectBlackjackBigWinLines({
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('6', 6)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'PLAYER',
        dealerCards: [card('10', 10), card('K', 10)]
      },
      globalSettings: undefined,
      minMultiplier: 2
    })

    expect(lines).toEqual([])
  })

  it('skips missing hands in the engine', () => {
    const engine = winningEngine()
    engine.hands = [undefined as unknown as EngineState['hands'][number]]

    const lines = collectBlackjackBigWinLines({
      engine,
      globalSettings: undefined,
      minMultiplier: 2
    })

    expect(lines).toEqual([])
  })
})
