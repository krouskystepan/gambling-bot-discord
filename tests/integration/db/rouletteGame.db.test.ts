import {
  rouletteIdleCloseMs,
  rouletteIdleNudgeThresholdMs
} from 'gambling-bot-shared/roulette'
import { describe, expect, it } from 'vitest'

import {
  deleteRouletteGame,
  getAllOldRouletteGames,
  getRouletteGameByGameId,
  getRouletteGameByUserAndGuild,
  getRouletteGamesByGuildId,
  getRouletteGamesNeedingIdleNudge,
  getStaleSpinningRouletteGames,
  markRouletteIdleNudgeSent,
  updateRouletteGame,
  upsertRouletteGame
} from '@/services/db/rouletteGame.db'

import { RouletteGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'rl-game-1',
  showBalance: false,
  skipAnimations: false
}

describe('rouletteGame.db', () => {
  it('upserts and fetches by user and guild', async () => {
    await upsertRouletteGame(baseGame)

    const game = await getRouletteGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(game?.gameId).toBe('rl-game-1')
    expect(game?.phase).toBe('betting')
    expect(game?.bets).toEqual([])
  })

  it('fetches by game id and guild list', async () => {
    await upsertRouletteGame(baseGame)

    const byGame = await getRouletteGameByGameId({
      gameId: 'rl-game-1',
      guildId: 'guild-1'
    })
    expect(byGame?.userId).toBe('user-1')

    const byGuild = await getRouletteGamesByGuildId({ guildId: 'guild-1' })
    expect(byGuild).toHaveLength(1)
  })

  it('updates slip state and clears idle nudge', async () => {
    await upsertRouletteGame(baseGame)
    await markRouletteIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const updated = await updateRouletteGame({
      userId: 'user-1',
      guildId: 'guild-1',
      bets: [
        {
          amount: 100,
          type: 'color',
          value: 'red',
          displayValue: 'red'
        }
      ],
      phase: 'betting'
    })

    expect(updated?.bets).toHaveLength(1)
    expect(updated?.idleNudgeSentAt).toBeNull()
  })

  it('finds stale spinning games by grace window', async () => {
    await upsertRouletteGame({
      ...baseGame,
      phase: 'spinning',
      bets: [
        {
          amount: 100,
          type: 'color',
          value: 'red',
          displayValue: 'red'
        }
      ],
      activeBetId: 'bet-1',
      lockedAmount: 100,
      pendingSpinResult: '18'
    })
    await RouletteGame.collection.updateOne(
      { gameId: 'rl-game-1' },
      { $set: { updatedAt: new Date(Date.now() - 61_000) } }
    )

    const stale = await getStaleSpinningRouletteGames(60_000)
    expect(stale.some((game) => game.gameId === 'rl-game-1')).toBe(true)
    expect(stale[0]?.pendingSpinResult).toBe('18')
  })

  it('finds games older than N days', async () => {
    await upsertRouletteGame(baseGame)
    await RouletteGame.collection.updateOne(
      { gameId: 'rl-game-1' },
      { $set: { updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }
    )

    const old = await getAllOldRouletteGames(1)
    expect(old.some((game) => game.gameId === 'rl-game-1')).toBe(true)
  })

  it('finds games needing idle nudge and marks them', async () => {
    await upsertRouletteGame(baseGame)
    await RouletteGame.collection.updateOne(
      { gameId: 'rl-game-1' },
      {
        $set: {
          updatedAt: new Date(
            Date.now() - rouletteIdleNudgeThresholdMs() - 60_000
          )
        }
      }
    )

    const needing = await getRouletteGamesNeedingIdleNudge()
    expect(needing.some((game) => game.gameId === 'rl-game-1')).toBe(true)

    await markRouletteIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const after = await getRouletteGamesNeedingIdleNudge()
    expect(after.some((game) => game.gameId === 'rl-game-1')).toBe(false)

    // Still within close window, not past refund age
    expect(rouletteIdleCloseMs()).toBeGreaterThan(rouletteIdleNudgeThresholdMs())
  })

  it('deletes a game', async () => {
    await upsertRouletteGame(baseGame)
    await deleteRouletteGame({ userId: 'user-1', guildId: 'guild-1' })

    expect(
      await getRouletteGameByUserAndGuild({
        userId: 'user-1',
        guildId: 'guild-1'
      })
    ).toBeNull()
  })
})
