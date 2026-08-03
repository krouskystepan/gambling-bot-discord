import {
  baccaratIdleCloseMs,
  baccaratIdleNudgeThresholdMs
} from 'gambling-bot-shared/baccarat'
import { describe, expect, it } from 'vitest'

import {
  deleteBaccaratGame,
  getAllOldBaccaratGames,
  getBaccaratGameByGameId,
  getBaccaratGameByUserAndGuild,
  getBaccaratGamesByGuildId,
  getBaccaratGamesNeedingIdleNudge,
  getStaleDealingBaccaratGames,
  markBaccaratIdleNudgeSent,
  updateBaccaratGame,
  upsertBaccaratGame
} from '@/services/db/baccaratGame.db'

import { BaccaratGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'game-bc-1',
  bets: [{ side: 'player' as const, amount: 100 }],
  showBalance: false,
  skipAnimations: false
}

describe('baccaratGame.db', () => {
  it('upserts and fetches by user and guild', async () => {
    await upsertBaccaratGame(baseGame)

    const game = await getBaccaratGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(game?.gameId).toBe('game-bc-1')
    expect(game?.activeBetId).toBeNull()
    expect(game?.bets).toMatchObject([{ side: 'player', amount: 100 }])
    expect(game?.phase).toBe('waiting')
    expect(game?.sessionStats.roundsPlayed).toBe(0)
  })

  it('fetches by game id and guild id list', async () => {
    await upsertBaccaratGame(baseGame)

    const game = await getBaccaratGameByGameId({
      gameId: 'game-bc-1',
      guildId: 'guild-1'
    })
    expect(game?.userId).toBe('user-1')

    const games = await getBaccaratGamesByGuildId({ guildId: 'guild-1' })
    expect(games).toHaveLength(1)
  })

  it('finds waiting and settled games older than N days', async () => {
    await upsertBaccaratGame(baseGame)
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldBaccaratGames(1)
    expect(old.some((g) => g.gameId === 'game-bc-1')).toBe(true)

    await updateBaccaratGame({
      userId: 'user-1',
      guildId: 'guild-1',
      phase: 'result'
    })
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const settled = await getAllOldBaccaratGames(1)
    expect(settled.some((g) => g.gameId === 'game-bc-1')).toBe(true)
  })

  it('finds and marks idle nudge candidates', async () => {
    await upsertBaccaratGame(baseGame)

    const idleMs = baccaratIdleNudgeThresholdMs() + 60_000
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date(Date.now() - idleMs) } }
    )

    const needing = await getBaccaratGamesNeedingIdleNudge()
    expect(needing.some((g) => g.gameId === 'game-bc-1')).toBe(true)

    await markBaccaratIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const afterMark = await getBaccaratGamesNeedingIdleNudge()
    expect(afterMark.some((g) => g.gameId === 'game-bc-1')).toBe(false)

    // Past the close window the table is handled by the idle-close worker.
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - baccaratIdleCloseMs() - 60_000),
          idleNudgeSentAt: null
        }
      }
    )
    const pastClose = await getBaccaratGamesNeedingIdleNudge()
    expect(pastClose.some((g) => g.gameId === 'game-bc-1')).toBe(false)
  })

  it('finds stale dealing games by grace window', async () => {
    await upsertBaccaratGame(baseGame)
    await updateBaccaratGame({
      userId: 'user-1',
      guildId: 'guild-1',
      phase: 'dealing',
      activeBetId: 'bet-bc-1',
      pendingDeal: {
        playerCards: [
          { label: 'A', suite: '♠️' },
          { label: '9', suite: '♥️' }
        ],
        bankerCards: [
          { label: '2', suite: '♣️' },
          { label: '7', suite: '♦️' }
        ]
      }
    })
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleDealingBaccaratGames(60_000)
    expect(stale.some((g) => g.gameId === 'game-bc-1')).toBe(true)
    expect(stale[0]?.activeBetId).toBe('bet-bc-1')
    expect(stale[0]?.pendingDeal?.playerCards).toHaveLength(2)
  })

  it('deletes game by user and guild', async () => {
    await upsertBaccaratGame(baseGame)

    await deleteBaccaratGame({ userId: 'user-1', guildId: 'guild-1' })

    const game = await getBaccaratGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(game).toBeNull()
  })
})
