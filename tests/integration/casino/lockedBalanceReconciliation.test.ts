import { describe, expect, it, vi } from 'vitest'

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
import { upsertMinesGame } from '@/services/db/minesGame.db'
import { createPrediction } from '@/services/db/prediction.db'
import { getUsersWithLockedBalance } from '@/services/db/user.db'
import * as userDb from '@/services/db/user.db'
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

  it('justifies lock when mines game is active', async () => {
    await createTestUser({ balance: 900, lockedBalance: 100 })
    await upsertMinesGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betId: 'mines-bet-1',
      betAmount: 100,
      mineCount: 3,
      mineIndices: [0, 1, 2],
      revealedIndices: [],
      houseEdgeSnapshot: 0.03,
      status: 'ACTIVE'
    })

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(100)
    expect(breakdown.mines).toBe(100)

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 100
    })
    expect(orphans.every((o) => o.betId !== 'mines-bet-1')).toBe(true)

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

  it('ignores settled transactions with null referenceId', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 25,
      betId: 'unsettled-null-settled',
      game: 'dice'
    })

    await backdateBetTx(
      'unsettled-null-settled',
      RECONCILIATION_GRACE_MS + 60_000
    )

    const findSpy = vi.spyOn(Transaction, 'find')
    findSpy.mockImplementation((query: unknown) => {
      const q = query as Record<string, unknown>
      if (
        q.referenceId &&
        typeof q.referenceId === 'object' &&
        '$in' in q.referenceId
      ) {
        return {
          select: vi.fn().mockReturnValue({
            lean: vi
              .fn()
              .mockResolvedValue([
                { referenceId: null },
                { referenceId: 'unsettled-null-settled' }
              ])
          })
        } as never
      }

      if (q['meta.game'] === 'rps') {
        return {
          lean: vi.fn().mockResolvedValue([])
        } as never
      }

      return {
        lean: vi.fn().mockResolvedValue([
          {
            referenceId: 'unsettled-null-settled',
            amount: 25,
            createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 60_000),
            meta: { game: 'dice' }
          }
        ])
      } as never
    })

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 25
    })

    findSpy.mockRestore()

    expect(orphans).toHaveLength(0)
  })

  it('treats settled RPS pairs as no longer pending', async () => {
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

    await Transaction.collection.insertMany([
      {
        userId: 'p1',
        guildId: 'guild-1',
        amount: 40,
        type: 'bet',
        source: 'casino',
        referenceId: 'rps-settled',
        meta: { game: 'rps' },
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 60_000)
      },
      {
        userId: 'p2',
        guildId: 'guild-1',
        amount: 40,
        type: 'bet',
        source: 'casino',
        referenceId: 'rps-settled',
        meta: { game: 'rps' },
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 60_000)
      },
      {
        userId: 'p1',
        guildId: 'guild-1',
        amount: 72,
        type: 'win',
        source: 'casino',
        referenceId: null
      },
      {
        userId: 'p1',
        guildId: 'guild-1',
        amount: 72,
        type: 'win',
        source: 'casino',
        referenceId: 'rps-settled'
      }
    ])

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'p1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(0)
    expect(breakdown.pendingRps).toBe(0)
  })

  it('excludes active blackjack bet from orphan refunds', async () => {
    await createTestUser({ balance: 900, lockedBalance: 100 })
    await seedBlackjack({ betAmount: 100, betId: 'bj-excluded' })
    await backdateBetTx('bj-excluded', RECONCILIATION_GRACE_MS + 60_000)

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 100
    })

    expect(orphans).toHaveLength(0)
  })

  it('refunds oldest orphan bets first and defaults missing game to dice', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await Transaction.create([
      {
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 30,
        type: 'bet',
        source: 'casino',
        referenceId: 'orphan-newer',
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 30_000)
      },
      {
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 20,
        type: 'bet',
        source: 'casino',
        referenceId: 'orphan-older',
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 90_000)
      }
    ])

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 100
    })

    expect(orphans).toEqual([
      { betId: 'orphan-older', amount: 20, game: 'dice' },
      { betId: 'orphan-newer', amount: 30, game: 'dice' }
    ])
  })

  it('releases remainder after orphan refunds during reconcile', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 60,
      betId: 'orphan-with-remainder',
      game: 'dice'
    })

    await User.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { lockedBalance: 70 } }
    )

    await backdateBetTx(
      'orphan-with-remainder',
      RECONCILIATION_GRACE_MS + 60_000
    )

    const result = await reconcileUserLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(result?.refunded).toBeCloseTo(60, 4)
    expect(result?.released).toBeCloseTo(10, 4)
    expect(result?.orphanBetIds).toEqual(['orphan-with-remainder'])

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBeLessThanOrEqual(LOCK_EPSILON)
    expect(user?.balance).toBe(910)
  })

  it('handles missing user after orphan refunds', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 60,
      betId: 'orphan-missing-user',
      game: 'dice'
    })

    await User.updateOne(
      { userId: 'user-1', guildId: 'guild-1' },
      { $set: { lockedBalance: 60 } }
    )

    await backdateBetTx('orphan-missing-user', RECONCILIATION_GRACE_MS + 60_000)

    const getUserSpy = vi.spyOn(userDb, 'getUser')
    getUserSpy
      .mockResolvedValueOnce({
        userId: 'user-1',
        guildId: 'guild-1',
        lockedBalance: 60
      } as never)
      .mockResolvedValueOnce(null)

    const result = await reconcileUserLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    getUserSpy.mockRestore()

    expect(result?.refunded).toBeCloseTo(60, 4)
    expect(result?.released).toBe(0)
  })

  it('ignores other users prediction bets when justifying lock', async () => {
    await createTestUser({ balance: 500, bonusBalance: 0 })
    await createTestUser({
      userId: 'other-user',
      balance: 500,
      bonusBalance: 0
    })
    await createPrediction({
      predictionId: 'pred-other-user',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Other user event',
      choices: [{ choiceName: 'Yes', odds: 2, bets: [] }],
      autolock: new Date('2026-12-01T00:00:00Z'),
      status: 'active'
    })

    await placePredictionBet({
      userId: 'other-user',
      guildId: 'guild-1',
      predictionId: 'pred-other-user',
      choiceName: 'Yes',
      amount: 120,
      minBet: 10,
      maxBet: 500
    })

    const { justified, breakdown } = await computeJustifiedLockedAmount({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(justified).toBe(0)
    expect(breakdown.predictions).toBe(0)
  })

  it('returns null when user is missing or lock is within epsilon', async () => {
    expect(
      await reconcileUserLockedBalance({
        userId: 'missing-user',
        guildId: 'guild-1'
      })
    ).toBeNull()

    await createTestUser({ balance: 100, lockedBalance: LOCK_EPSILON / 2 })

    expect(
      await reconcileUserLockedBalance({
        userId: 'user-1',
        guildId: 'guild-1'
      })
    ).toBeNull()
  })

  it('stops orphan selection once max excess is exhausted', async () => {
    await createTestUser({ balance: 900, lockedBalance: 0 })

    await Transaction.create([
      {
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 20,
        type: 'bet',
        source: 'casino',
        referenceId: 'orphan-first',
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 90_000)
      },
      {
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 30,
        type: 'bet',
        source: 'casino',
        referenceId: 'orphan-second',
        createdAt: new Date(Date.now() - RECONCILIATION_GRACE_MS - 30_000)
      }
    ])

    const orphans = await findOrphanBetRefunds({
      userId: 'user-1',
      guildId: 'guild-1',
      maxExcess: 20
    })

    expect(orphans).toEqual([
      { betId: 'orphan-first', amount: 20, game: 'dice' }
    ])
  })

  it('skips RPS bets without referenceId when counting pending pairs', async () => {
    const findSpy = vi.spyOn(Transaction, 'find')
    findSpy.mockImplementation((query: unknown) => {
      const q = query as Record<string, unknown>
      if (q['meta.game'] === 'rps') {
        return {
          lean: vi
            .fn()
            .mockResolvedValue([
              { referenceId: null },
              { referenceId: 'rps-valid' }
            ])
        } as never
      }

      if (q.userId) {
        return {
          lean: vi.fn().mockResolvedValue([])
        } as never
      }

      return {
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      } as never
    })

    const { breakdown } = await computeJustifiedLockedAmount({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    findSpy.mockRestore()

    expect(breakdown.pendingRps).toBe(0)
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
