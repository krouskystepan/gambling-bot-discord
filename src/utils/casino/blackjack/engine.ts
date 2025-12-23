import { Card } from './deck'
import { calculateHandValue } from './math'

// TODO: STAND
export type PlayerAction = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'DEV-DELETE'

export type EngineResult =
  | { finished: false }
  | {
      finished: true
      payout: number
      resultId: 'PB' | 'DB' | 'PW' | 'DW' | 'PUSH'
    }
  | {
      finished: false
      dealerTurn: true
    }

export type EngineState = {
  deck: Card[]
  deckIndex: number
  playerCards: Card[]
  dealerCards: Card[]
  betAmount: number
}

const draw = (s: EngineState): Card => {
  const card = s.deck[s.deckIndex]
  if (!card) throw new Error('Deck exhausted')
  s.deckIndex++
  return card
}

export const applyAction = (
  s: EngineState,
  action: PlayerAction
): EngineResult => {
  if (action === 'HIT' || action === 'DOUBLE') {
    s.playerCards.push(draw(s))

    const p = calculateHandValue(s.playerCards)
    if (p > 21) {
      return { finished: true, resultId: 'PB', payout: 0 }
    }

    if (action === 'DOUBLE') {
      s.betAmount *= 2
      return { finished: false, dealerTurn: true }
    }

    return { finished: false }
  }

  return { finished: false, dealerTurn: true }
}

export const dealerDrawOne = (s: EngineState): void => {
  s.dealerCards.push(draw(s))
}

export const dealerShouldDraw = (s: EngineState): boolean => {
  return calculateHandValue(s.dealerCards) < 17
}

export const resolveResult = (s: EngineState): EngineResult => {
  const p = calculateHandValue(s.playerCards)
  const d = calculateHandValue(s.dealerCards)

  if (d > 21) {
    return { finished: true, resultId: 'DB', payout: s.betAmount * 2 }
  }

  if (p === d) {
    return { finished: true, resultId: 'PUSH', payout: s.betAmount }
  }

  if (p > d) {
    return { finished: true, resultId: 'PW', payout: s.betAmount * 2 }
  }

  return { finished: true, resultId: 'DW', payout: 0 }
}
