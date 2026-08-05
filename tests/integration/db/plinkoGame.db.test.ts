import {
  plinkoIdleCloseMs,
  plinkoIdleNudgeThresholdMs
} from 'gambling-bot-shared/plinko'
import { describe, expect, it } from 'vitest'

import {
  deletePlinkoGame,
  getAllOldPlinkoGames,
  getPlinkoGameByGameId,
  getPlinkoGameByUserAndGuild,
  getPlinkoGamesByGuildId,
  getPlinkoGamesNeedingIdleNudge,
  getStaleDroppingPlinkoGames,
  markPlinkoIdleNudgeSent,
  updatePlinkoGame,
  upsertPlinkoGame
} from '@/services/db/plinkoGame.db'

import { PlinkoGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'pk-game-1',
  showBalance: false,
  skipAnimations: false
}

describe('plinkoGame.db', () => {
  it('upserts and fetches by user and guild', async () => {
    await upsertPlinkoGame(baseGame)

    const game = await getPlinkoGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(game?.gameId).toBe('pk-game-1')
    expect(game?.phase).toBe('ready')
    expect(game?.unitBet).toBeNull()
    expect(game?.ballsCount).toBe(1)
    expect(game?.sessionStats.roundsPlayed).toBe(0)
  })

  it('fetches by game id and guild list', async () => {
    await upsertPlinkoGame(baseGame)

    const byGame = await getPlinkoGameByGameId({
      gameId: 'pk-game-1',
      guildId: 'guild-1'
    })
    expect(byGame?.userId).toBe('user-1')

    const byGuild = await getPlinkoGamesByGuildId({ guildId: 'guild-1' })
    expect(byGuild).toHaveLength(1)
  })

  it('updates bet / balls and clears idle nudge', async () => {
    await upsertPlinkoGame(baseGame)
    await markPlinkoIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const updated = await updatePlinkoGame({
      userId: 'user-1',
      guildId: 'guild-1',
      unitBet: 50,
      ballsCount: 5,
      phase: 'ready'
    })

    expect(updated?.unitBet).toBe(50)
    expect(updated?.ballsCount).toBe(5)
    expect(updated?.idleNudgeSentAt).toBeNull()
  })

  it('finds stale dropping games by grace window', async () => {
    await upsertPlinkoGame({
      ...baseGame,
      unitBet: 50,
      ballsCount: 2,
      phase: 'dropping',
      pendingBatchResults: [
        [0, 0, 1],
        [0, 1, 2]
      ],
      activeBetId: 'bet-plinko-1',
      lockedAmount: 100
    })
    await PlinkoGame.collection.updateOne(
      { gameId: 'pk-game-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleDroppingPlinkoGames(60_000)
    expect(stale.some((game) => game.gameId === 'pk-game-1')).toBe(true)
    expect(stale[0]?.pendingBatchResults).toEqual([
      [0, 0, 1],
      [0, 1, 2]
    ])
  })

  it('finds games older than N days', async () => {
    await upsertPlinkoGame(baseGame)
    await PlinkoGame.collection.updateOne(
      { gameId: 'pk-game-1' },
      { $set: { updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }
    )

    const old = await getAllOldPlinkoGames(1)
    expect(old.some((game) => game.gameId === 'pk-game-1')).toBe(true)
  })

  it('finds games needing idle nudge and marks them', async () => {
    await upsertPlinkoGame(baseGame)
    await PlinkoGame.collection.updateOne(
      { gameId: 'pk-game-1' },
      {
        $set: {
          updatedAt: new Date(
            Date.now() - plinkoIdleNudgeThresholdMs() - 60_000
          )
        }
      }
    )

    const needing = await getPlinkoGamesNeedingIdleNudge()
    expect(needing.some((game) => game.gameId === 'pk-game-1')).toBe(true)

    await markPlinkoIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const after = await getPlinkoGamesNeedingIdleNudge()
    expect(after.some((game) => game.gameId === 'pk-game-1')).toBe(false)

    expect(plinkoIdleCloseMs()).toBeGreaterThan(plinkoIdleNudgeThresholdMs())
  })

  it('deletes games', async () => {
    await upsertPlinkoGame(baseGame)
    await deletePlinkoGame({ userId: 'user-1', guildId: 'guild-1' })
    expect(
      await getPlinkoGameByUserAndGuild({
        userId: 'user-1',
        guildId: 'guild-1'
      })
    ).toBeNull()
  })
})
