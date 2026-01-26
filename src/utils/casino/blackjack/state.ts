// eslint-disable-next-line no-restricted-imports
import { TBlackjackGame } from '@/models/BlackjackGame'

import { EngineState } from './engine'

export const docToEngine = (game: TBlackjackGame): EngineState => ({
  deck: game.deck,
  deckIndex: game.deckIndex,
  hands: game.hands,
  activeHandIndex: game.activeHandIndex,
  phase: game.phase,
  dealerCards: game.dealerCards
})

export const engineToDoc = (engine: EngineState, game: TBlackjackGame) => {
  game.deck = engine.deck
  game.deckIndex = engine.deckIndex
  game.hands = engine.hands
  game.activeHandIndex = engine.activeHandIndex
  game.phase = engine.phase
  game.dealerCards = engine.dealerCards
}
