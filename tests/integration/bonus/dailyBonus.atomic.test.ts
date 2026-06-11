import { normalizeBonusSettings } from 'gambling-bot-shared'
import { describe, expect, it } from 'vitest'

import { claimDailyBonusAtomic } from '@/services/user/dailyBonus.service'

import {
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const settings = normalizeBonusSettings({
  rewardMode: 'linear',
  baseReward: 100,
  streakIncrement: 10,
  maxReward: 500,
  resetOnMax: false,
  milestoneBonus: { weekly: 25, monthly: 100 }
})

describe('claimDailyBonusAtomic', () => {
  it('claims bonus and writes ledger row atomically', async () => {
    await createTestUser({ bonusBalance: 0, dailyStreak: 1 })

    const now = new Date('2026-05-20T12:00:00Z')
    const result = await claimDailyBonusAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      now,
      settings
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.reward).toBeGreaterThan(0)
    expect(result.user.bonusBalance).toBe(result.reward)

    const tx = await Transaction.findOne({ userId: 'user-1', type: 'bonus' })
    expect(tx?.amount).toBe(result.reward)
    expect(tx?.meta).toMatchObject({ bonusStreak: result.streak })
  })

  it('prevents double claim race', async () => {
    const now = new Date('2026-05-20T12:00:00Z')
    await createTestUser({ bonusBalance: 0, dailyStreak: 0 })

    const [first, second] = await Promise.all([
      claimDailyBonusAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        now,
        settings
      }),
      claimDailyBonusAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        now,
        settings
      })
    ])

    const successes = [first, second].filter((result) => result.ok)
    expect(successes).toHaveLength(1)

    const txs = await Transaction.find({ userId: 'user-1', type: 'bonus' })
    expect(txs).toHaveLength(1)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lastDailyClaim).toEqual(now)
  })
})
