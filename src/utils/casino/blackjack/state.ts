// eslint-disable-next-line no-restricted-imports
import { TBlackjackGame } from '@/models/BlackjackGame'

import { EngineState } from './engine'

export const docToEngine = (doc: TBlackjackGame): EngineState => ({
  deck: [...doc.deck],
  deckIndex: doc.deckIndex,
  playerCards: [...doc.playerCards],
  dealerCards: [...doc.dealerCards],
  betAmount: doc.betAmount
})

export const engineToDoc = (engine: EngineState, doc: TBlackjackGame): void => {
  doc.deck = engine.deck
  doc.deckIndex = engine.deckIndex
  doc.playerCards = engine.playerCards
  doc.dealerCards = engine.dealerCards
  doc.betAmount = engine.betAmount
}
