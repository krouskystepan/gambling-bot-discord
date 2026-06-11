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
  streakIncrement: 25,
  maxReward: 500,
  resetOnMax: false,
  milestoneBonus: { weekly: 50, monthly: 200 }
})

describe('bonus claim flow', () => {
  it('credits bonus balance and writes a single ledger row', async () => {
    await createTestUser({
      bonusBalance: 0,
      dailyStreak: 2,
      lastDailyClaim: new Date('2026-05-31T10:00:00Z')
    })

    const now = new Date('2026-06-01T12:00:00Z')
    const result = await claimDailyBonusAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      now,
      settings
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.streak).toBe(3)
    expect(result.reward).toBe(150)
    expect(result.isReset).toBe(false)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.bonusBalance).toBe(150)
    expect(user?.dailyStreak).toBe(3)
    expect(user?.lastDailyClaim).toEqual(now)

    const transactions = await Transaction.find({
      userId: 'user-1',
      type: 'bonus'
    })
    expect(transactions).toHaveLength(1)
    expect(transactions[0]?.amount).toBe(150)
    expect(transactions[0]?.meta).toMatchObject({ bonusStreak: 3 })
  })

  it('blocks a second claim in the same window', async () => {
    const now = new Date('2026-06-01T12:00:00Z')
    await createTestUser({
      bonusBalance: 50,
      dailyStreak: 1,
      lastDailyClaim: now
    })

    const result = await claimDailyBonusAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      now: new Date('2026-06-01T18:00:00Z'),
      settings
    })

    expect(result.ok).toBe(false)

    const transactions = await Transaction.find({
      userId: 'user-1',
      type: 'bonus'
    })
    expect(transactions).toHaveLength(0)
  })
})
