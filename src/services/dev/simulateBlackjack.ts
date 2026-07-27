import type { TBlackjackHand } from 'gambling-bot-shared/blackjack'
import {
  type BlackjackWinMultipliers,
  defaultCasinoSettings,
  getBlackjackPayout
} from 'gambling-bot-shared/casino'

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

const defaultWinMultipliers = defaultCasinoSettings.blackjack.winMultipliers

/** Auto-plays one blackjack hand using the real engine + deck RNG. */
export function simulateBlackjackWinnings(
  betAmount: number,
  winMultipliers: BlackjackWinMultipliers = defaultWinMultipliers
): number {
  const shuffledDeck = shuffleDeck(DECK)
  const playerCards = [shuffledDeck[0]!, shuffledDeck[1]!]
  const dealerCards = [shuffledDeck[2]!, shuffledDeck[3]!]

  const playerValue = calculateHandValue(playerCards)
  const dealerValue = calculateHandValue(dealerCards)

  if (playerValue === 21 || dealerValue === 21) {
    if (playerValue === 21 && dealerValue === 21) {
      return getBlackjackPayout(betAmount, 'push', winMultipliers)
    }
    if (playerValue === 21) {
      return getBlackjackPayout(betAmount, 'blackjack', winMultipliers)
    }
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
    const result = resolveResult(engine, i, winMultipliers)
    if (result.finished && 'payout' in result) {
      totalPayout += result.payout
    }
  }

  return totalPayout
}
