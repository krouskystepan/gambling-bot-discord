import { describe, expect, it } from 'vitest'

import { createTransaction } from '@/services/db/transaction.db'
import {
  addUserBonus,
  claimDailyBonus,
  removeUserBonus
} from '@/services/user/dailyBonus.service'

import {
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

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

    await createTransaction({
      userId: updated!.userId,
      guildId: updated!.guildId,
      amount: 150,
      type: 'bonus',
      source: 'system',
      meta: { bonusStreak: 2 }
    })

    const tx = await Transaction.findOne({
      userId: 'user-1',
      type: 'bonus'
    })
    expect(tx?.amount).toBe(150)
    expect(tx?.meta).toMatchObject({ bonusStreak: 2 })
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

  it('adds bonus balance', async () => {
    await createTestUser({ bonusBalance: 10 })

    const updated = await addUserBonus({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 40
    })

    expect(updated?.bonusBalance).toBe(50)
  })

  it('removes bonus up to available amount', async () => {
    await createTestUser({ bonusBalance: 30 })

    const result = await removeUserBonus({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 100
    })

    expect(result?.removed).toBe(30)
    expect(result?.user.bonusBalance).toBe(0)
  })

  it('returns null when removing bonus from missing user', async () => {
    const result = await removeUserBonus({
      userId: 'missing',
      guildId: 'guild-1',
      amount: 10
    })

    expect(result).toBeNull()
  })

  it('returns null when bonus balance is unset', async () => {
    await User.collection.insertOne({
      userId: 'no-bonus-user',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 0,
      bonusBalance: null
    })

    const result = await removeUserBonus({
      userId: 'no-bonus-user',
      guildId: 'guild-1',
      amount: 10
    })

    expect(result).toBeNull()
  })

  it('returns null when user has no bonus to remove', async () => {
    await createTestUser({ bonusBalance: 0 })

    const result = await removeUserBonus({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 10
    })

    expect(result).toBeNull()
  })
})
