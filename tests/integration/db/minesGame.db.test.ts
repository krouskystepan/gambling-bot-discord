import {
  minesAutoResolveIdleMs,
  minesIdleNudgeThresholdMs
} from 'gambling-bot-shared/mines'
import { describe, expect, it } from 'vitest'

import {
  deleteMinesGame,
  getAllOldMinesGames,
  getMinesGameByGameId,
  getMinesGameByUserAndGuild,
  getMinesGamesByGuildId,
  getMinesGamesNeedingIdleNudge,
  getOldResultMinesGames,
  getStaleSettlingMinesGames,
  markMinesIdleNudgeSent,
  saveMinesGame,
  upsertMinesGame
} from '@/services/db/minesGame.db'

import { MinesGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'game-mines-1',
  activeBetId: 'bet-mines-1',
  betAmount: 100,
  mineCount: 3,
  mineIndices: [0, 1, 2],
  revealedIndices: [] as number[],
  houseEdgeSnapshot: 0.03,
  status: 'ACTIVE' as const
}

describe('minesGame.db', () => {
  it('upserts and fetches by user and guild', async () => {
    await upsertMinesGame(baseGame)

    const game = await getMinesGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(game?.gameId).toBe('game-mines-1')
    expect(game?.activeBetId).toBe('bet-mines-1')
    expect(game?.mineCount).toBe(3)
    expect(game?.sessionStats.roundsPlayed).toBe(0)
  })

  it('fetches by game id and guild list', async () => {
    await upsertMinesGame(baseGame)

    const byGame = await getMinesGameByGameId({
      gameId: 'game-mines-1',
      guildId: 'guild-1'
    })
    expect(byGame?.userId).toBe('user-1')

    const byGuild = await getMinesGamesByGuildId({ guildId: 'guild-1' })
    expect(byGuild).toHaveLength(1)
  })

  it('saves an existing game document', async () => {
    const game = await upsertMinesGame(baseGame)
    expect(game).toBeTruthy()

    game!.revealedIndices = [5]
    await saveMinesGame(game!)

    const updated = await getMinesGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(updated?.revealedIndices).toEqual([5])
    expect(updated?.idleNudgeSentAt).toBeNull()
  })

  it('finds boards whose settlement never completed', async () => {
    await upsertMinesGame({
      ...baseGame,
      status: 'RESULT',
      revealedIndices: [0]
    })
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleSettlingMinesGames(60_000)
    expect(stale.some((g) => g.gameId === 'game-mines-1')).toBe(true)
    expect(stale[0]?.status).toBe('RESULT')
  })

  it('ignores settled boards without an active bet', async () => {
    await upsertMinesGame({
      ...baseGame,
      status: 'RESULT',
      activeBetId: null,
      revealedIndices: [0]
    })
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleSettlingMinesGames(60_000)
    expect(stale).toHaveLength(0)
  })

  it('finds active games older than N days', async () => {
    await upsertMinesGame(baseGame)
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldMinesGames(1)
    expect(old.some((g) => g.gameId === 'game-mines-1')).toBe(true)
  })

  it('routes settled games to the idle close query', async () => {
    await upsertMinesGame({
      ...baseGame,
      status: 'RESULT',
      activeBetId: null
    })
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    expect(
      (await getAllOldMinesGames(1)).some((g) => g.gameId === 'game-mines-1')
    ).toBe(false)
    expect(
      (await getOldResultMinesGames(1)).some((g) => g.gameId === 'game-mines-1')
    ).toBe(true)
  })

  it('does not return recent games in old query', async () => {
    await upsertMinesGame({ ...baseGame, gameId: 'game-recent' })

    const old = await getAllOldMinesGames(1)
    expect(old.some((g) => g.gameId === 'game-recent')).toBe(false)
  })

  it('finds and marks idle nudge candidates', async () => {
    await upsertMinesGame(baseGame)
    const idleMs = minesIdleNudgeThresholdMs() + 60_000
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - idleMs),
          idleNudgeSentAt: null
        }
      }
    )

    const needing = await getMinesGamesNeedingIdleNudge()
    expect(needing.some((g) => g.gameId === 'game-mines-1')).toBe(true)

    await markMinesIdleNudgeSent({ userId: 'user-1', guildId: 'guild-1' })
    const after = await getMinesGamesNeedingIdleNudge()
    expect(after.some((g) => g.gameId === 'game-mines-1')).toBe(false)

    // Past auto-resolve window should not be nudged
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - minesAutoResolveIdleMs() - 60_000),
          idleNudgeSentAt: null
        }
      }
    )
    const tooOld = await getMinesGamesNeedingIdleNudge()
    expect(tooOld.some((g) => g.gameId === 'game-mines-1')).toBe(false)
  })

  it('deletes game by user and guild', async () => {
    await upsertMinesGame(baseGame)

    await deleteMinesGame({ userId: 'user-1', guildId: 'guild-1' })

    const game = await getMinesGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(game).toBeNull()
  })
})
