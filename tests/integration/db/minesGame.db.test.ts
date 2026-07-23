import {
  minesAutoResolveIdleMs,
  minesIdleNudgeThresholdMs
} from 'gambling-bot-shared/mines'
import { describe, expect, it } from 'vitest'

import {
  deleteMinesGame,
  getAllOldMinesGames,
  getMinesGameByBetId,
  getMinesGameByUserAndGuild,
  getMinesGamesByGuildId,
  getMinesGamesNeedingIdleNudge,
  markMinesIdleNudgeSent,
  updateMinesGame,
  upsertMinesGame
} from '@/services/db/minesGame.db'

import { MinesGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  betId: 'bet-mines-1',
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

    expect(game?.betId).toBe('bet-mines-1')
    expect(game?.mineCount).toBe(3)
  })

  it('fetches by bet id and guild list', async () => {
    await upsertMinesGame(baseGame)

    const byBet = await getMinesGameByBetId({
      betId: 'bet-mines-1',
      guildId: 'guild-1'
    })
    expect(byBet?.userId).toBe('user-1')

    const byGuild = await getMinesGamesByGuildId({ guildId: 'guild-1' })
    expect(byGuild).toHaveLength(1)
  })

  it('updates an existing game document', async () => {
    const game = await upsertMinesGame(baseGame)
    expect(game).toBeTruthy()

    game!.revealedIndices = [5]
    await updateMinesGame(game!)

    const updated = await getMinesGameByUserAndGuild({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(updated?.revealedIndices).toEqual([5])
    expect(updated?.idleNudgeSentAt).toBeNull()
  })

  it('finds games older than N days', async () => {
    await upsertMinesGame(baseGame)
    await MinesGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldMinesGames(1)
    expect(old.some((g) => g.betId === 'bet-mines-1')).toBe(true)
  })

  it('does not return recent games in old query', async () => {
    await upsertMinesGame({ ...baseGame, betId: 'bet-recent' })

    const old = await getAllOldMinesGames(1)
    expect(old.some((g) => g.betId === 'bet-recent')).toBe(false)
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
    expect(needing.some((g) => g.betId === 'bet-mines-1')).toBe(true)

    await markMinesIdleNudgeSent({ userId: 'user-1', guildId: 'guild-1' })
    const after = await getMinesGamesNeedingIdleNudge()
    expect(after.some((g) => g.betId === 'bet-mines-1')).toBe(false)

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
    expect(tooOld.some((g) => g.betId === 'bet-mines-1')).toBe(false)
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
