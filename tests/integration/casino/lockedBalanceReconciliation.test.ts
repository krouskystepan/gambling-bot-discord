import { describe, expect, it } from 'vitest'

import {
  releaseExcessLockedBalance,
  reserveCasinoBet
} from '@/services/casino/casinoBet.service'
import {
  LOCK_EPSILON,
  RECONCILIATION_GRACE_MS,
  computeJustifiedLockedAmount,
  findOrphanBetRefunds,
  reconcileUserLockedBalance
} from '@/services/casino/lockedBalanceReconciliation.service'
import { upsertBlackjackGame } from '@/services/db/blackjackGame.db'
import { createPrediction } from '@/services/db/prediction.db'
import { getUsersWithLockedBalance } from '@/services/db/user.db'
import { placePredictionBet } from '@/services/predictions/placePredictionBet.service'

import { card } from '../../helpers/cards'
import {
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const backdateBetTx = async (betId: string, ageMs: number) => {
  await Transaction.collection.updateOne(
    { referenceId: betId, type: 'bet' },
    { $set: { createdAt: new Date(Date.now() - ageMs) } }
  )
}

const seedBlackjack = async ({
  betAmount = 100,
  betId = 'bj-bet-1'
}: {
  betAmount?: number
  betId?: string
} = {}) => {
  await upsertBlackjackGame({
    userId: 'user-1',
    guildId: 'guild-1',
    channelId: 'channel-1',
    messageId: 'msg-1',
    betId,
    deck: [card('2', 2)],
    deckIndex: 1,
    hands: [
      {
        cards: [card('10', 10), card('8', 8)],
        betAmount,
        finished: false,
        isSplitHand: false
      }
    ],
    activeHandIndex: 0,
    phase: 'PLAYER',
    dealerCards: [card('10', 10), card('7', 7)]
  })
}

const seedActivePrediction = async (predictionId: string) => {
  await createPrediction({
    predictionId,
    guildId: 'guild-1',
    channelId: 'channel-1',
    creatorId: 'mod-1',
    title: 'Test event',
    choices: [
      { choiceName: 'Yes', odds: 2, bets: [] },
      { choiceName: 'No', odds: 1.5, bets: [] }
    ],
    autolock: new Date('2026-12-01T00:00:00Z'),
    status: 'active'
  })
}

describe('lockedBalanceReconciliation.service', () => {
  it('justifies lock when blackjack hand is active', async () => {
    await createTestUser({ balance: 900, lockedBalance: 100 })
    await seedBlackjack({ betAmount: 100 })

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(100)
    expect(breakdown.blackjack).toBe(100)
    expect(justified - 100).toBeLessThanOrEqual(LOCK_EPSILON)

    const result = await reconcileUserLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(result).toBeNull()
  })

  it('justifies lock when prediction bet is active', async () => {
    await createTestUser({ balance: 500, bonusBalance: 0 })
    await seedActivePrediction('pred-active')
    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-active',
      choiceName: 'Yes',
      amount: 80,
      minBet: 10,
      maxBet: 500
    })

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(80)
    expect(breakdown.predictions).toBe(80)

    const result = await reconcileUserLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(result).toBeNull()
  })

  it('refunds orphan instant-game lock after grace window', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 60,
      betId: 'orphan-dice',
      game: 'dice'
    })

    await backdateBetTx('orphan-dice', RECONCILIATION_GRACE_MS + 60_000)

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 60
    })
    expect(orphans).toHaveLength(1)
    expect(orphans[0]?.betId).toBe('orphan-dice')

    const result = await reconcileUserLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(result?.excessBefore).toBeCloseTo(60, 4)
    expect(result?.orphanBetIds).toEqual(['orphan-dice'])

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBeLessThanOrEqual(LOCK_EPSILON)
    expect(user?.balance).toBe(900)

    const refundTx = await Transaction.findOne({
      referenceId: 'orphan-dice',
      type: 'refund'
    })
    expect(refundTx?.amount).toBe(60)
  })

  it('does not refund recent bets inside grace window', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 45,
      betId: 'recent-dice',
      game: 'dice'
    })

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(45)
    expect(breakdown.graceBets).toBe(45)

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 45
    })
    expect(orphans).toHaveLength(0)

    const result = await reconcileUserLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(result).toBeNull()
  })

  it('does not refund pending RPS pair within grace window', async () => {
    await createTestUser({
      userId: 'p1',
      balance: 0,
      lockedBalance: 50
    })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 50
    })

    await Transaction.create([
      {
        userId: 'p1',
        guildId: 'guild-1',
        amount: 50,
        type: 'bet',
        source: 'casino',
        referenceId: 'rps-pending',
        meta: { game: 'rps' }
      },
      {
        userId: 'p2',
        guildId: 'guild-1',
        amount: 50,
        type: 'bet',
        source: 'casino',
        referenceId: 'rps-pending',
        meta: { game: 'rps' }
      }
    ])

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'p1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(50)
    expect(breakdown.graceBets).toBe(50)

    const orphans = await findOrphanBetRefunds({
      userId: 'p1',
      guildId: 'guild-1',
      maxExcess: 50
    })
    expect(orphans).toHaveLength(0)
  })

  it('justifies older pending RPS pair outside grace window', async () => {
    await createTestUser({
      userId: 'p1',
      balance: 0,
      lockedBalance: 40
    })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 40
    })

    await Transaction.create([
      {
        userId: 'p1',
        guildId: 'guild-1',
        amount: 40,
        type: 'bet',
        source: 'casino',
        referenceId: 'rps-old',
        meta: { game: 'rps' },
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 60_000)
      },
      {
        userId: 'p2',
        guildId: 'guild-1',
        amount: 40,
        type: 'bet',
        source: 'casino',
        referenceId: 'rps-old',
        meta: { game: 'rps' },
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 60_000)
      }
    ])

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'p1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(40)
    expect(breakdown.pendingRps).toBe(40)

    const orphans = await findOrphanBetRefunds({
      userId: 'p1',
      guildId: 'guild-1',
      maxExcess: 40
    })
    expect(orphans).toHaveLength(0)
  })

  it('releases rounding remainder via releaseExcessLockedBalance', async () => {
    await createTestUser({ balance: 100, lockedBalance: 0.00005 })

    await releaseExcessLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 0.00005
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBeCloseTo(100.00005, 6)

    const refundTx = await Transaction.findOne({
      userId: 'user-1',
      type: 'refund',
      source: 'system'
    })
    expect(refundTx?.meta).toEqual({ reason: 'locked_balance_reconciliation' })
  })
})

describe('getUsersWithLockedBalance', () => {
  it('returns users above epsilon threshold', async () => {
    await createTestUser({
      userId: 'locked-user',
      balance: 100,
      lockedBalance: 25
    })
    await createTestUser({
      userId: 'clear-user',
      guildId: 'guild-2',
      balance: 100,
      lockedBalance: 0
    })

    const users = await getUsersWithLockedBalance()
    expect(users).toHaveLength(1)
    expect(users[0]?.userId).toBe('locked-user')
    expect(users[0]?.lockedBalance).toBe(25)
  })
})
