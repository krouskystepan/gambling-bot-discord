import type { TBlackjackHand } from 'gambling-bot-shared/blackjack'

import {
  DECK,
  applyAction,
  calculateHandValue,
  dealerDrawOne,
  dealerShouldDraw,
  resolveResult,
  shuffleDeck
} from '@/utils/casino/blackjack'
import type { EngineState } from '@/utils/casino/blackjack/types'

/** Auto-plays one blackjack hand using the real engine + deck RNG. */
export function simulateBlackjackWinnings(betAmount: number): number {
  const shuffledDeck = shuffleDeck(DECK)
  const playerCards = [shuffledDeck[0]!, shuffledDeck[1]!]
  const dealerCards = [shuffledDeck[2]!, shuffledDeck[3]!]

  const playerValue = calculateHandValue(playerCards)
  const dealerValue = calculateHandValue(dealerCards)

  if (playerValue === 21 || dealerValue === 21) {
    if (playerValue === 21 && dealerValue === 21) return betAmount
    if (playerValue === 21) return betAmount * 2.5
    return 0
  }

  const engine: EngineState = {
    deck: shuffledDeck,
    deckIndex: 4,
    hands: [
      {
        cards: [...playerCards],
        betAmount,
        finished: false,
        isSplitHand: false
      } satisfies TBlackjackHand
    ],
    activeHandIndex: 0,
    phase: 'PLAYER',
    dealerCards: [...dealerCards]
  }

  for (;;) {
    const hand = engine.hands[engine.activeHandIndex]
    if (!hand || hand.finished) {
      const nextHand = engine.activeHandIndex + 1
      if (nextHand < engine.hands.length) {
        engine.activeHandIndex = nextHand
        continue
      }
      break
    }

    const value = calculateHandValue(hand.cards)
    if (value < 17) {
      applyAction(engine, 'HIT')
      continue
    }

    applyAction(engine, 'STAND')
  }

  while (dealerShouldDraw(engine)) {
    dealerDrawOne(engine)
  }

  let totalPayout = 0
  for (let i = 0; i < engine.hands.length; i++) {
    const result = resolveResult(engine, i)
    if (result.finished && 'payout' in result) {
      totalPayout += result.payout
    }
  }

  return totalPayout
}
