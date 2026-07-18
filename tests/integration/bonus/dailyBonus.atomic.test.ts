import { normalizeBonusSettings } from 'gambling-bot-shared/bonus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    vi.restoreAllMocks()
  })

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

  it('claims bonus when last claim was more than 24 hours ago', async () => {
    await createTestUser({
      bonusBalance: 50,
      dailyStreak: 3,
      lastDailyClaim: new Date('2026-05-18T12:00:00Z')
    })

    const now = new Date('2026-05-20T12:00:00Z')
    const result = await claimDailyBonusAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      now,
      settings
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.streak).toBeGreaterThan(0)
    expect(result.user.dailyStreak).toBe(result.streak)
  })

  it('returns USER_NOT_FOUND when user is missing', async () => {
    const result = await claimDailyBonusAtomic({
      userId: 'missing-user',
      guildId: 'guild-1',
      now: new Date('2026-05-20T12:00:00Z'),
      settings
    })

    expect(result).toEqual({ ok: false, reason: 'USER_NOT_FOUND' })
  })

  it('returns ALREADY_CLAIMED when bonus was claimed within 24 hours', async () => {
    const now = new Date('2026-05-20T12:00:00Z')
    await createTestUser({
      bonusBalance: 100,
      lastDailyClaim: now,
      dailyStreak: 2
    })

    const result = await claimDailyBonusAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      now: new Date('2026-05-20T18:00:00Z'),
      settings
    })

    expect(result).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' })
  })

  it('claims bonus when daily streak is null on user document', async () => {
    await User.collection.insertOne({
      userId: 'null-streak-user',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 0,
      bonusBalance: 0,
      dailyStreak: null,
      lastDailyClaim: null
    })

    const result = await claimDailyBonusAtomic({
      userId: 'null-streak-user',
      guildId: 'guild-1',
      now: new Date('2026-05-20T12:00:00Z'),
      settings
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.streak).toBeGreaterThan(0)
  })

  it('returns ALREADY_CLAIMED when conditional update does not match', async () => {
    await createTestUser({
      bonusBalance: 0,
      dailyStreak: 2,
      lastDailyClaim: null
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    vi.spyOn(User, 'findOne').mockReturnValue({
      session: () => Promise.resolve(user)
    } as never)
    vi.spyOn(User, 'findOneAndUpdate').mockReturnValue({
      lean: () => Promise.resolve(null)
    } as never)

    const result = await claimDailyBonusAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      now: new Date('2026-05-20T12:00:00Z'),
      settings
    })

    expect(result).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' })
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
