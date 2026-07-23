import {
  baccaratIdleNudgeThresholdMs,
  baccaratIdleRefundMs
} from 'gambling-bot-shared/baccarat'
import { describe, expect, it } from 'vitest'

import {
  deleteBaccaratGame,
  getAllOldBaccaratGames,
  getBaccaratGameByBetId,
  getBaccaratGameByUserAndGuild,
  getBaccaratGamesByGuildId,
  getBaccaratGamesNeedingIdleNudge,
  markBaccaratIdleNudgeSent,
  upsertBaccaratGame
} from '@/services/db/baccaratGame.db'

import { BaccaratGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  betId: 'bet-bc-1',
  betAmount: 100,
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

    expect(game?.betId).toBe('bet-bc-1')
    expect(game?.betAmount).toBe(100)
  })

  it('fetches by bet id and guild id list', async () => {
    await upsertBaccaratGame(baseGame)

    const game = await getBaccaratGameByBetId({
      betId: 'bet-bc-1',
      guildId: 'guild-1'
    })
    expect(game?.userId).toBe('user-1')

    const games = await getBaccaratGamesByGuildId({ guildId: 'guild-1' })
    expect(games).toHaveLength(1)
  })

  it('finds games older than N days', async () => {
    await upsertBaccaratGame(baseGame)
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    const old = await getAllOldBaccaratGames(1)
    expect(old.some((g) => g.betId === 'bet-bc-1')).toBe(true)
  })

  it('finds and marks idle nudge candidates', async () => {
    await upsertBaccaratGame(baseGame)

    const idleMs = baccaratIdleNudgeThresholdMs() + 60_000
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { updatedAt: new Date(Date.now() - idleMs) } }
    )

    const needing = await getBaccaratGamesNeedingIdleNudge()
    expect(needing.some((g) => g.betId === 'bet-bc-1')).toBe(true)

    await markBaccaratIdleNudgeSent({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    const afterMark = await getBaccaratGamesNeedingIdleNudge()
    expect(afterMark.some((g) => g.betId === 'bet-bc-1')).toBe(false)

    // Past refund window should not be nudged.
    await BaccaratGame.collection.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      {
        $set: {
          updatedAt: new Date(Date.now() - baccaratIdleRefundMs() - 60_000),
          idleNudgeSentAt: null
        }
      }
    )
    const pastRefund = await getBaccaratGamesNeedingIdleNudge()
    expect(pastRefund.some((g) => g.betId === 'bet-bc-1')).toBe(false)
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
