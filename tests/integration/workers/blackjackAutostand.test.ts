import { describe, expect, it } from 'vitest'

import { TBlackjackGame } from 'gambling-bot-shared'
import { reserveCasinoBet, settleCasinoWinnings } from '@/services/casino/casinoBet.service'
import {
  deleteBlackjackGame,
  getAllOldBlackjackGames,
  upsertBlackjackGame
} from '@/services/db/blackjackGame.db'
import {
  applyAction,
  dealerDrawOne,
  dealerShouldDraw,
  docToEngine,
  resolveResult
} from '@/utils/casino/blackjack'

import { card } from '../../helpers/cards'
import { BlackjackGame, User, createTestUser, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

/** Mirrors settlement logic from blackjackAutostand.job (without Discord). */
const settleStaleBlackjackGame = async (game: TBlackjackGame) => {
  const engine = docToEngine(game)
  applyAction(engine, 'STAND')

  const nextHandIndex = engine.hands.findIndex(
    (h, i) => i > engine.activeHandIndex && !h.finished
  )
  if (nextHandIndex !== -1) {
    return { continued: true as const }
  }

  engine.activeHandIndex = engine.hands.length - 1
  while (dealerShouldDraw(engine)) {
    dealerDrawOne(engine)
  }

  let totalPayout = 0
  for (let i = 0; i < engine.hands.length; i++) {
    const r = resolveResult(engine, i)
    if (r.finished) totalPayout += r.payout
  }

  const totalBet = engine.hands.reduce((sum, hand) => sum + hand.betAmount, 0)

  await settleCasinoWinnings({
    userId: game.userId,
    guildId: game.guildId,
    totalBet,
    winnings: totalPayout,
    betId: game.betId
  })

  await deleteBlackjackGame({ userId: game.userId, guildId: game.guildId })

  return { continued: false as const, totalPayout, totalBet }
}

describe('blackjack autostand data flow', () => {
  it('finds stale games, auto-stands, settles winnings, and deletes game', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      betId: 'bet-autostand-1'
    })

    await upsertBlackjackGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betId: 'bet-autostand-1',
      deck: [],
      deckIndex: 0,
      hands: [
        {
          cards: [card('10', 10), card('10', 10)],
          betAmount: 100,
          finished: false,
          isSplitHand: false
        }
      ],
      activeHandIndex: 0,
      phase: 'PLAYER',
      dealerCards: [card('10', 10), card('7', 7)]
    })

    await BlackjackGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const stale = await getAllOldBlackjackGames(1)
    const game = stale.find((g) => g.betId === 'bet-autostand-1')
    expect(game).toBeTruthy()

    const result = await settleStaleBlackjackGame(game!)
    expect(result.continued).toBe(false)
    expect(result.totalPayout).toBe(200)
    expect(result.totalBet).toBe(100)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(1100)
    expect(user?.lockedBalance).toBe(0)

    const remaining = await getAllOldBlackjackGames(1)
    expect(remaining.some((g) => g.betId === 'bet-autostand-1')).toBe(false)
  })
})
