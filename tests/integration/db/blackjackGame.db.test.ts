import { describe, expect, it } from 'vitest'

import {
  deleteBlackjackGame,
  getAllOldBlackjackGames,
  getBlackjackGameByGameId,
  getBlackjackGameByUserAndGuild,
  getOldResultBlackjackGames,
  getStaleDealerBlackjackGames,
  saveBlackjackGame,
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
  gameId: 'game-bj-1',
  activeBetId: 'bet-bj-1',
  baseBetAmount: 100,
  showBalance: false,
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

    expect(game?.gameId).toBe('game-bj-1')
    expect(game?.activeBetId).toBe('bet-bj-1')
    expect(game?.sessionStats.roundsPlayed).toBe(0)
    expect(game?.hands[0]?.betAmount).toBe(100)
  })

  it('fetches by game id', async () => {
    await upsertBlackjackGame(baseGame)

    const game = await getBlackjackGameByGameId({
      gameId: 'game-bj-1',
      guildId: 'guild-1'
    })

    expect(game?.userId).toBe('user-1')
  })

  it('saves an existing game document', async () => {
    const game = await upsertBlackjackGame(baseGame)
    expect(game).toBeTruthy()

    game!.phase = 'DEALER'
    await saveBlackjackGame(game!)

    const updated = await getBlackjackGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(updated?.phase).toBe('DEALER')
  })

  it('patches an existing game document', async () => {
    await upsertBlackjackGame(baseGame)

    const updated = await updateBlackjackGame({
      userId: 'user-1',
      guildId: 'guild-1',
      phase: 'RESULT',
      activeBetId: null
    })

    expect(updated?.phase).toBe('RESULT')
    expect(updated?.activeBetId).toBeNull()
  })

  it('finds mid-hand games older than N days', async () => {
    await upsertBlackjackGame(baseGame)
    await BlackjackGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldBlackjackGames(1)
    expect(old.some((g) => g.gameId === 'game-bj-1')).toBe(true)
  })

  it('excludes settled sessions from the mid-hand old query', async () => {
    await upsertBlackjackGame({ ...baseGame, phase: 'RESULT' })
    await BlackjackGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldBlackjackGames(1)
    expect(old.some((g) => g.gameId === 'game-bj-1')).toBe(false)

    const settled = await getOldResultBlackjackGames(1)
    expect(settled.some((g) => g.gameId === 'game-bj-1')).toBe(true)
  })

  it('does not return recent games in old query', async () => {
    await upsertBlackjackGame({ ...baseGame, gameId: 'game-recent' })

    const old = await getAllOldBlackjackGames(1)
    expect(old.some((g) => g.gameId === 'game-recent')).toBe(false)
  })

  it('finds stale dealer games by grace window', async () => {
    const game = await upsertBlackjackGame(baseGame)
    expect(game).toBeTruthy()

    game!.phase = 'DEALER'
    await saveBlackjackGame(game!)
    await BlackjackGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleDealerBlackjackGames(60_000)
    expect(stale.some((g) => g.gameId === 'game-bj-1')).toBe(true)
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
