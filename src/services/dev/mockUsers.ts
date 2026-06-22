import Transaction from '@/models/Transaction'
import User from '@/models/User'

import { type MockUserPools, randomCreatedAt, randomInt } from './constants'

export type MockUsersResult = {
  created: number
  skipped: number
}

function randomUserBalance(maxBalance: number): {
  balance: number
  bonusBalance: number
  lockedBalance: number
  dailyStreak: number
  lastDailyClaim: Date | null
} {
  const tierRoll = Math.random()

  let balance: number
  if (tierRoll < 0.55) {
    balance = randomInt(0, Math.min(500, maxBalance))
  } else if (tierRoll < 0.85) {
    balance = randomInt(200, Math.min(5_000, maxBalance))
  } else if (tierRoll < 0.97) {
    balance = randomInt(2_000, Math.min(25_000, maxBalance))
  } else {
    balance = randomInt(10_000, maxBalance)
  }

  const bonusBalance =
    Math.random() < 0.35
      ? randomInt(0, Math.min(Math.floor(balance * 0.4), 2_000))
      : 0

  const lockedBalance =
    Math.random() < 0.08
      ? randomInt(10, Math.min(Math.floor(balance * 0.3), 1_000))
      : 0

  const dailyStreak = Math.random() < 0.6 ? randomInt(0, 21) : randomInt(0, 60)

  const lastDailyClaim = Math.random() < 0.7 ? randomCreatedAt(14) : null

  return {
    balance,
    bonusBalance,
    lockedBalance,
    dailyStreak,
    lastDailyClaim
  }
}

export async function mockUsers({
  guildId,
  pools,
  days,
  maxBalance = 50_000,
  zeroBalance = false
}: {
  guildId: string
  pools: MockUserPools
  days: number
  maxBalance?: number
  zeroBalance?: boolean
}): Promise<MockUsersResult> {
  let created = 0
  let skipped = 0

  for (const userId of pools.userIds) {
    const profile = zeroBalance
      ? {
          balance: 0,
          bonusBalance: 0,
          lockedBalance: 0,
          dailyStreak: 0,
          lastDailyClaim: null
        }
      : randomUserBalance(maxBalance)
    const createdAt = randomCreatedAt(days)

    try {
      const result = await User.updateOne(
        { userId, guildId },
        {
          $setOnInsert: {
            userId,
            guildId,
            ...profile
          }
        },
        { upsert: true, timestamps: false }
      )

      if (result.upsertedCount > 0) {
        await User.updateOne(
          { userId, guildId },
          { $set: { createdAt, updatedAt: createdAt } }
        )
        created++
      } else {
        skipped++
      }
    } catch {
      skipped++
    }
  }

  return { created, skipped }
}

/** Align user balances with mock transaction history (player net cash position). */
export async function syncMockUserBalancesFromTransactions({
  guildId,
  userIds
}: {
  guildId: string
  userIds: string[]
}): Promise<number> {
  const rows = await Transaction.aggregate<{ _id: string; net: number }>([
    { $match: { guildId, userId: { $in: userIds } } },
    {
      $group: {
        _id: '$userId',
        net: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ['$type', ['deposit', 'win', 'bonus', 'refund']]
                  },
                  then: '$amount'
                },
                {
                  case: { $in: ['$type', ['bet', 'withdraw']] },
                  then: { $multiply: ['$amount', -1] }
                }
              ],
              default: 0
            }
          }
        }
      }
    }
  ])

  const netByUser = new Map(rows.map((row) => [row._id, row.net]))
  let updated = 0

  for (const userId of userIds) {
    const net = netByUser.get(userId) ?? 0
    await User.updateOne(
      { userId, guildId },
      {
        $set: {
          balance: Math.max(0, Math.round(net)),
          bonusBalance: 0,
          lockedBalance: 0
        }
      }
    )
    updated++
  }

  return updated
}
