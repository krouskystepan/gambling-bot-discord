import { describe, expect, it } from 'vitest'

import {
  deleteBlackjackGame,
  getAllOldBlackjackGames,
  getBlackjackGameByBetId,
  getBlackjackGameByUserAndGuild,
  updateBlackjackGame,
  upsertBlackjackGame
} from '@/services/db/blackjackGame.db'

import { card } from '../../helpers/cards'
import { BlackjackGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  betId: 'bet-bj-1',
  deck: [card('2', 2)],
  deckIndex: 1,
  hands: [
    {
      cards: [card('10', 10), card('8', 8)],
      betAmount: 100,
      finished: false,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'PLAYER' as const,
  dealerCards: [card('10', 10), card('7', 7)]
}

describe('blackjackGame.db', () => {
  it('upserts and fetches by user and guild', async () => {
    await upsertBlackjackGame(baseGame)

    const game = await getBlackjackGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(game?.betId).toBe('bet-bj-1')
    expect(game?.hands[0]?.betAmount).toBe(100)
  })

  it('fetches by bet id', async () => {
    await upsertBlackjackGame(baseGame)

    const game = await getBlackjackGameByBetId({
      betId: 'bet-bj-1',
      guildId: 'guild-1'
    })

    expect(game?.userId).toBe('user-1')
  })

  it('updates an existing game document', async () => {
    const game = await upsertBlackjackGame(baseGame)
    expect(game).toBeTruthy()

    game!.phase = 'DEALER'
    await updateBlackjackGame(game!)

    const updated = await getBlackjackGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(updated?.phase).toBe('DEALER')
  })

  it('finds games older than N days', async () => {
    await upsertBlackjackGame(baseGame)
    await BlackjackGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldBlackjackGames(1)
    expect(old.some((g) => g.betId === 'bet-bj-1')).toBe(true)
  })

  it('does not return recent games in old query', async () => {
    await upsertBlackjackGame({ ...baseGame, betId: 'bet-recent' })

    const old = await getAllOldBlackjackGames(1)
    expect(old.some((g) => g.betId === 'bet-recent')).toBe(false)
  })

  it('deletes game by user and guild', async () => {
    await upsertBlackjackGame(baseGame)

    await deleteBlackjackGame({ userId: 'user-1', guildId: 'guild-1' })

    const game = await getBlackjackGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(game).toBeNull()
  })
})
