import { describe, expect, it } from 'vitest'

import { claimDailyBonus } from '@/services/user/dailyBonus.service'

import { User, createTestUser, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('dailyBonus.service', () => {
  it('claims bonus when eligible', async () => {
    const user = await createTestUser({ bonusBalance: 0 })
    const now = new Date('2026-05-20T12:00:00Z')

    const updated = await claimDailyBonus({
      user,
      reward: 150,
      streak: 2,
      now
    })

    expect(updated?.bonusBalance).toBe(150)
    expect(updated?.dailyStreak).toBe(2)
    expect(updated?.lastDailyClaim).toEqual(now)
  })

  it('prevents double claim within 24 hours', async () => {
    const now = new Date('2026-05-20T12:00:00Z')
    await createTestUser({
      bonusBalance: 100,
      lastDailyClaim: now,
      dailyStreak: 1
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    const secondClaim = await claimDailyBonus({
      user: user!,
      reward: 200,
      streak: 2,
      now: new Date('2026-05-20T18:00:00Z')
    })

    expect(secondClaim).toBeNull()

    const unchanged = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(unchanged?.bonusBalance).toBe(100)
    expect(unchanged?.dailyStreak).toBe(1)
  })
})
