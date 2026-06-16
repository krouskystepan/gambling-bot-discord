import { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import { describe, expect, it } from 'vitest'

import { docToEngine, engineToDoc } from '@/utils/casino/blackjack/state'

import { card } from '../../../helpers/cards'

const sampleGame = (): TBlackjackGame => ({
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'ch-1',
  messageId: 'msg-1',
  betId: 'bet-1',
  deck: [card('5', 5)],
  deckIndex: 2,
  hands: [
    {
      cards: [card('10', 10), card('9', 9)],
      betAmount: 50,
      finished: false,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'PLAYER',
  dealerCards: [card('7', 7)],
  createdAt: new Date(),
  updatedAt: new Date()
})

describe('blackjack state mapping', () => {
  it('docToEngine copies persisted fields', () => {
    const game = sampleGame()
    const engine = docToEngine(game)

    expect(engine.deckIndex).toBe(2)
    expect(engine.hands[0]?.betAmount).toBe(50)
    expect(engine.dealerCards).toHaveLength(1)
  })

  it('engineToDoc writes engine state back onto document', () => {
    const game = sampleGame()
    const engine = docToEngine(game)

    engine.phase = 'DEALER'
    engine.deckIndex = 3
    engine.hands[0]!.finished = true

    engineToDoc(engine, game)

    expect(game.phase).toBe('DEALER')
    expect(game.deckIndex).toBe(3)
    expect(game.hands[0]?.finished).toBe(true)
  })
})
