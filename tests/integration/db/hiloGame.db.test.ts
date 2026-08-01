import {
  hiloGuessTimeoutMs,
  hiloIdleCloseMs,
  hiloIdleNudgeThresholdMs
} from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

import {
  claimHiloGameForSettle,
  deleteHiloGame,
  deleteHiloGameByGameId,
  getHiloGameByGameId,
  getHiloGameByUserAndGuild,
  getHiloGamesByGuildId,
  getHiloGamesNeedingIdleNudge,
  getOldIdleHiloGames,
  getTimedOutHiloGames,
  markHiloIdleNudgeSent,
  updateHiloGame,
  upsertHiloGame
} from '@/services/db/hiloGame.db'

import { HiloGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'hilo-1',
  activeBetId: 'hilo-1',
  betAmount: 100,
  firstCard: { label: '7', suite: '♥️' as const, rank: 7 },
  remainingDeck: [{ label: 'A', suite: '♠️' as const, rank: 14 }],
  houseEdgeSnapshot: 0.01,
  showBalance: false,
  status: 'WAITING' as const
}

describe('hiloGame.db', () => {
  it('upserts and fetches by user, game id, and guild', async () => {
    await upsertHiloGame(baseGame)

    const byUser = await getHiloGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(byUser?.gameId).toBe('hilo-1')
    expect(byUser?.status).toBe('WAITING')
    expect(byUser?.idleNudgeSentAt).toBeNull()
    expect(byUser?.sessionStats.roundsPlayed).toBe(0)

    const byGame = await getHiloGameByGameId({
      gameId: 'hilo-1',
      guildId: 'guild-1'
    })
    expect(byGame?.betAmount).toBe(100)

    const byGuild = await getHiloGamesByGuildId({ guildId: 'guild-1' })
    expect(byGuild).toHaveLength(1)
  })

  it('upserts an empty BETTING table', async () => {
    await upsertHiloGame({
      ...baseGame,
      activeBetId: null,
      betAmount: null,
      firstCard: null,
      remainingDeck: [],
      status: 'BETTING'
    })

    const game = await getHiloGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(game?.status).toBe('BETTING')
    expect(game?.betAmount).toBeNull()
  })

  it('claims WAITING games for settle once', async () => {
    await upsertHiloGame(baseGame)

    const first = await claimHiloGameForSettle({
      gameId: 'hilo-1',
      guildId: 'guild-1'
    })
    expect(first?.status).toBe('SETTLING')

    const second = await claimHiloGameForSettle({
      gameId: 'hilo-1',
      guildId: 'guild-1'
    })
    expect(second).toBeNull()
  })

  it('finds timed-out waiting games by updatedAt', async () => {
    await upsertHiloGame(baseGame)
    await HiloGame.collection.updateOne(
      { gameId: 'hilo-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - hiloGuessTimeoutMs() - 1_000)
        }
      }
    )

    const timedOut = await getTimedOutHiloGames()
    expect(timedOut.map((game) => game.gameId)).toContain('hilo-1')
  })

  it('finds idle games needing a nudge and marks them sent', async () => {
    await upsertHiloGame(baseGame)
    await HiloGame.collection.updateOne(
      { gameId: 'hilo-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - hiloIdleNudgeThresholdMs() - 1_000)
        }
      }
    )

    const needingNudge = await getHiloGamesNeedingIdleNudge()
    expect(needingNudge.map((game) => game.gameId)).toContain('hilo-1')

    await markHiloIdleNudgeSent({ userId: 'user-1', guildId: 'guild-1' })

    const afterMark = await getHiloGamesNeedingIdleNudge()
    expect(afterMark.map((game) => game.gameId)).not.toContain('hilo-1')
  })

  it('finds old BETTING/RESULT tables for idle close', async () => {
    await upsertHiloGame({
      ...baseGame,
      activeBetId: null,
      status: 'RESULT'
    })
    await HiloGame.collection.updateOne(
      { gameId: 'hilo-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - hiloIdleCloseMs() - 1_000)
        }
      }
    )

    const idle = await getOldIdleHiloGames()
    expect(idle.map((game) => game.gameId)).toContain('hilo-1')
  })

  it('updates fields and clears idle nudge', async () => {
    await upsertHiloGame(baseGame)
    await markHiloIdleNudgeSent({ userId: 'user-1', guildId: 'guild-1' })

    await updateHiloGame({
      userId: 'user-1',
      guildId: 'guild-1',
      status: 'RESULT',
      activeBetId: null
    })

    const game = await getHiloGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(game?.status).toBe('RESULT')
    expect(game?.idleNudgeSentAt).toBeNull()
  })

  it('deletes by user and by game id', async () => {
    await upsertHiloGame(baseGame)
    await deleteHiloGame({ userId: 'user-1', guildId: 'guild-1' })
    expect(
      await getHiloGameByUserAndGuild({ userId: 'user-1', guildId: 'guild-1' })
    ).toBeNull()

    await upsertHiloGame({
      ...baseGame,
      gameId: 'hilo-2',
      activeBetId: 'hilo-2'
    })
    await deleteHiloGameByGameId({ gameId: 'hilo-2', guildId: 'guild-1' })
    expect(
      await getHiloGameByGameId({ gameId: 'hilo-2', guildId: 'guild-1' })
    ).toBeNull()
  })
})
