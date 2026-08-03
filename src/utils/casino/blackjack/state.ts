import { TBlackjackGame } from 'gambling-bot-shared/blackjack'

import type { Card, EngineState } from './types'

/** Copy card fields explicitly - `{...mongooseSubdoc}` drops schema getters. */
const cloneCard = (c: Card): Card => ({
  label: c.label,
  value: c.value,
  suite: c.suite
})

/**
 * Clone into plain objects so SPLIT/HIT mutations (array replace / splice)
 * never touch Mongoose subdocuments in place (those throws are easy to miss).
 */
export const docToEngine = (game: TBlackjackGame): EngineState => ({
  deck: game.deck.map(cloneCard),
  deckIndex: game.deckIndex,
  hands: game.hands.map((h) => ({
    cards: h.cards.map(cloneCard),
    betAmount: h.betAmount,
    finished: h.finished,
    isSplitHand: h.isSplitHand
  })),
  activeHandIndex: game.activeHandIndex,
  phase: game.phase,
  dealerCards: game.dealerCards.map(cloneCard)
})

export const engineToDoc = (engine: EngineState, game: TBlackjackGame) => {
  // Always assign fresh plain clones so Mongoose never sees shared refs from
  // the in-memory engine (in-place DocumentArray wrapping breaks SPLIT).
  game.deck = engine.deck.map(cloneCard)
  game.deckIndex = engine.deckIndex
  game.hands = engine.hands.map((h) => ({
    cards: h.cards.map(cloneCard),
    betAmount: h.betAmount,
    finished: h.finished,
    isSplitHand: h.isSplitHand
  }))
  game.activeHandIndex = engine.activeHandIndex
  game.phase = engine.phase
  game.dealerCards = engine.dealerCards.map(cloneCard)

  const doc = game as TBlackjackGame & {
    markModified?: (path: string) => void
  }
  doc.markModified?.('deck')
  doc.markModified?.('hands')
  doc.markModified?.('dealerCards')
}
