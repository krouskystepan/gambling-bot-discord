import { TBlackjackHand } from 'gambling-bot-shared/blackjack'

import { calculateHandValue } from './math'
import type { Card, EngineResult, EngineState, PlayerAction } from './types'

const draw = (s: EngineState): Card => {
  const card = s.deck[s.deckIndex]
  if (!card) throw new Error('Deck exhausted')
  s.deckIndex++
  return card
}

export const canSplit = (s: EngineState): boolean => {
  const hand = s.hands[s.activeHandIndex]
  if (!hand) return false

  if (s.hands.length > 1) return false

  if (hand.cards.length !== 2) return false

  return hand.cards[0].label === hand.cards[1].label
}

export const applyAction = (
  s: EngineState,
  action: PlayerAction
): EngineResult => {
  const hand = s.hands[s.activeHandIndex]
  if (!hand || hand.finished) {
    return { finished: false }
  }

  if (action === 'HIT' || action === 'DOUBLE') {
    hand.cards.push(draw(s))

    const p = calculateHandValue(hand.cards)
    if (p > 21) {
      hand.finished = true
      return { finished: false }
    }

    if (action === 'DOUBLE') {
      hand.finished = true
      return { finished: false }
    }

    return { finished: false }
  }

  if (action === 'SPLIT') {
    if (!canSplit(s)) {
      throw new Error('Invalid split')
    }

    const [c1, c2] = hand.cards
    const isAceSplit = c1.label === 'A' && c2.label === 'A'

    hand.cards = [c1, draw(s)]
    hand.isSplitHand = true

    const secondHand: TBlackjackHand = {
      cards: [c2, draw(s)],
      betAmount: hand.betAmount,
      finished: false,
      isSplitHand: true
    }

    s.hands.splice(s.activeHandIndex + 1, 0, secondHand)

    if (isAceSplit) {
      hand.finished = true
      secondHand.finished = true

      s.activeHandIndex = s.hands.length - 1

      return { finished: false, dealerTurn: true }
    }

    return { finished: false }
  }

  if (action === 'STAND') {
    hand.finished = true
    return { finished: false }
  }

  return { finished: false }
}

export const dealerDrawOne = (s: EngineState): void => {
  s.dealerCards.push(draw(s))
}

export const dealerShouldDraw = (s: EngineState): boolean => {
  return calculateHandValue(s.dealerCards) < 17
}

export const resolveResult = (
  s: EngineState,
  handIndex: number
): EngineResult => {
  const hand = s.hands[handIndex]
  if (!hand) {
    return { finished: true, resultId: 'DW', payout: 0 }
  }

  const p = calculateHandValue(hand.cards)
  const d = calculateHandValue(s.dealerCards)

  if (p > 21) {
    return { finished: true, resultId: 'PB', payout: 0 }
  }

  if (d > 21) {
    return { finished: true, resultId: 'DB', payout: hand.betAmount * 2 }
  }

  if (p === d) {
    return { finished: true, resultId: 'PUSH', payout: hand.betAmount }
  }

  if (p > d) {
    return { finished: true, resultId: 'PW', payout: hand.betAmount * 2 }
  }

  return { finished: true, resultId: 'DW', payout: 0 }
}
