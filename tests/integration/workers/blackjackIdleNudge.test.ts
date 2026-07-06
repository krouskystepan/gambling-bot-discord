import { describe, expect, it } from 'vitest'

import {
  getBlackjackGamesNeedingIdleNudge,
  markBlackjackIdleNudgeSent,
  upsertBlackjackGame
} from '@/services/db/blackjackGame.db'

import { card } from '../../helpers/cards'
import { BlackjackGame, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const MS_PER_HOUR = 60 * 60 * 1000

const seedBlackjackGame = async ({
  userId = 'user-1',
  guildId = 'guild-1',
  betId = 'bet-nudge-1'
}: {
  userId?: string
  guildId?: string
  betId?: string
} = {}) => {
  await upsertBlackjackGame({
    userId,
    guildId,
    channelId: 'channel-1',
    messageId: 'msg-1',
    betId,
    deck: [],
    deckIndex: 0,
    hands: [
      {
        cards: [card('10', 10), card('8', 8)],
        betAmount: 100,
        finished: false,
        isSplitHand: false
      }
    ],
    activeHandIndex: 0,
    phase: 'PLAYER',
    dealerCards: [card('10', 10), card('7', 7)]
  })
}

const setGameUpdatedAt = async (
  userId: string,
  guildId: string,
  updatedAt: Date
) => {
  await BlackjackGame.collection.updateOne(
    { userId, guildId },
    { $set: { updatedAt } }
  )
}

describe('blackjack idle nudge data flow', () => {
  it('returns games idle 4h+ but within the 24h autostand window', async () => {
    await seedBlackjackGame()
    await setGameUpdatedAt(
      'user-1',
      'guild-1',
      new Date(Date.now() - 4 * MS_PER_HOUR)
    )

    const games = await getBlackjackGamesNeedingIdleNudge()
    expect(games.some((g) => g.betId === 'bet-nudge-1')).toBe(true)
  })

  it('excludes games updated less than 3h ago', async () => {
    await seedBlackjackGame({ betId: 'bet-recent' })
    await setGameUpdatedAt(
      'user-1',
      'guild-1',
      new Date(Date.now() - 1 * MS_PER_HOUR)
    )

    const games = await getBlackjackGamesNeedingIdleNudge()
    expect(games.some((g) => g.betId === 'bet-recent')).toBe(false)
  })

  it('excludes games past the 24h autostand window', async () => {
    await seedBlackjackGame({ betId: 'bet-stale' })
    await setGameUpdatedAt(
      'user-1',
      'guild-1',
      new Date(Date.now() - 30 * MS_PER_HOUR)
    )

    const games = await getBlackjackGamesNeedingIdleNudge()
    expect(games.some((g) => g.betId === 'bet-stale')).toBe(false)
  })

  it('excludes games after markBlackjackIdleNudgeSent', async () => {
    await seedBlackjackGame({ betId: 'bet-marked' })
    await setGameUpdatedAt(
      'user-1',
      'guild-1',
      new Date(Date.now() - 4 * MS_PER_HOUR)
    )

    await markBlackjackIdleNudgeSent({ userId: 'user-1', guildId: 'guild-1' })

    const games = await getBlackjackGamesNeedingIdleNudge()
    expect(games.some((g) => g.betId === 'bet-marked')).toBe(false)
  })

  it('clears idleNudgeSentAt on upsertBlackjackGame', async () => {
    await seedBlackjackGame({ betId: 'bet-cleared' })
    await setGameUpdatedAt(
      'user-1',
      'guild-1',
      new Date(Date.now() - 4 * MS_PER_HOUR)
    )

    await markBlackjackIdleNudgeSent({ userId: 'user-1', guildId: 'guild-1' })

    let games = await getBlackjackGamesNeedingIdleNudge()
    expect(games.some((g) => g.betId === 'bet-cleared')).toBe(false)

    await upsertBlackjackGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betId: 'bet-cleared',
      deck: [],
      deckIndex: 0,
      hands: [
        {
          cards: [card('10', 10), card('8', 8), card('3', 3)],
          betAmount: 100,
          finished: false,
          isSplitHand: false
        }
      ],
      activeHandIndex: 0,
      phase: 'PLAYER',
      dealerCards: [card('10', 10), card('7', 7)]
    })

    const doc = await BlackjackGame.findOne({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(doc?.idleNudgeSentAt).toBeNull()

    await setGameUpdatedAt(
      'user-1',
      'guild-1',
      new Date(Date.now() - 4 * MS_PER_HOUR)
    )

    games = await getBlackjackGamesNeedingIdleNudge()
    expect(games.some((g) => g.betId === 'bet-cleared')).toBe(true)
  })
})
