import {
  slotsIdleCloseMs,
  slotsIdleNudgeThresholdMs
} from 'gambling-bot-shared/slots'
import { describe, expect, it } from 'vitest'

import {
  deleteSlotsGame,
  getAllOldSlotsGames,
  getSlotsGameByGameId,
  getSlotsGameByUserAndGuild,
  getSlotsGamesByGuildId,
  getSlotsGamesNeedingIdleNudge,
  getStaleSpinningSlotsGames,
  markSlotsIdleNudgeSent,
  updateSlotsGame,
  upsertSlotsGame
} from '@/services/db/slotsGame.db'

import { SlotsGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'sl-game-1',
  showBalance: false,
  skipAnimations: false
}

describe('slotsGame.db', () => {
  it('upserts and fetches by user and guild', async () => {
    await upsertSlotsGame(baseGame)

    const game = await getSlotsGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(game?.gameId).toBe('sl-game-1')
    expect(game?.phase).toBe('ready')
    expect(game?.unitBet).toBeNull()
    expect(game?.spinsCount).toBe(1)
    expect(game?.sessionStats.roundsPlayed).toBe(0)
  })

  it('fetches by game id and guild list', async () => {
    await upsertSlotsGame(baseGame)

    const byGame = await getSlotsGameByGameId({
      gameId: 'sl-game-1',
      guildId: 'guild-1'
    })
    expect(byGame?.userId).toBe('user-1')

    const byGuild = await getSlotsGamesByGuildId({ guildId: 'guild-1' })
    expect(byGuild).toHaveLength(1)
  })

  it('updates chip / spins and clears idle nudge', async () => {
    await upsertSlotsGame(baseGame)
    await markSlotsIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const updated = await updateSlotsGame({
      userId: 'user-1',
      guildId: 'guild-1',
      unitBet: 50,
      spinsCount: 5,
      phase: 'ready'
    })

    expect(updated?.unitBet).toBe(50)
    expect(updated?.spinsCount).toBe(5)
    expect(updated?.idleNudgeSentAt).toBeNull()
  })

  it('finds stale spinning games by grace window', async () => {
    await upsertSlotsGame({
      ...baseGame,
      unitBet: 50,
      spinsCount: 3,
      phase: 'spinning',
      pendingBatchResults: ['🍒🍒🍒', '🍒🫐🍉', '🍉🍉🍉'],
      activeBetId: 'bet-slots-1',
      lockedAmount: 150
    })
    await SlotsGame.collection.updateOne(
      { gameId: 'sl-game-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleSpinningSlotsGames(60_000)
    expect(stale.some((game) => game.gameId === 'sl-game-1')).toBe(true)
    expect(stale[0]?.pendingBatchResults).toEqual([
      '🍒🍒🍒',
      '🍒🫐🍉',
      '🍉🍉🍉'
    ])
  })

  it('finds games older than N days', async () => {
    await upsertSlotsGame(baseGame)
    await SlotsGame.collection.updateOne(
      { gameId: 'sl-game-1' },
      { $set: { updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }
    )

    const old = await getAllOldSlotsGames(1)
    expect(old.some((game) => game.gameId === 'sl-game-1')).toBe(true)
  })

  it('finds games needing idle nudge and marks them', async () => {
    await upsertSlotsGame(baseGame)
    await SlotsGame.collection.updateOne(
      { gameId: 'sl-game-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - slotsIdleNudgeThresholdMs() - 60_000)
        }
      }
    )

    const needing = await getSlotsGamesNeedingIdleNudge()
    expect(needing.some((game) => game.gameId === 'sl-game-1')).toBe(true)

    await markSlotsIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const after = await getSlotsGamesNeedingIdleNudge()
    expect(after.some((game) => game.gameId === 'sl-game-1')).toBe(false)

    expect(slotsIdleCloseMs()).toBeGreaterThan(slotsIdleNudgeThresholdMs())
  })

  it('deletes games', async () => {
    await upsertSlotsGame(baseGame)
    await deleteSlotsGame({ userId: 'user-1', guildId: 'guild-1' })
    expect(
      await getSlotsGameByUserAndGuild({
        userId: 'user-1',
        guildId: 'guild-1'
      })
    ).toBeNull()
  })
})
