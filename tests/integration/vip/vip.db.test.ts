import { describe, expect, it } from 'vitest'

import {
  extendVipAtomic,
  refundVipPurchase,
  reserveVipPurchase
} from '@/services/db/vip.db'

import {
  Transaction,
  User,
  VipRoom,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

describe('vip.db money flows', () => {
  it('reserves VIP purchase by deducting balance', async () => {
    await createTestUser({ balance: 500 })

    await reserveVipPurchase({
      userId: 'user-1',
      guildId: 'guild-1',
      totalPrice: 200
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(300)
  })

  it('throws INSUFFICIENT_FUNDS on reserve', async () => {
    await createTestUser({ balance: 50 })

    await expect(
      reserveVipPurchase({
        userId: 'user-1',
        guildId: 'guild-1',
        totalPrice: 200
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('throws VIP_ALREADY_EXISTS when active room exists', async () => {
    await createTestUser({ balance: 1000 })
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch-1',
      expiresAt: new Date('2027-01-01T00:00:00Z')
    })

    await expect(
      reserveVipPurchase({
        userId: 'user-1',
        guildId: 'guild-1',
        totalPrice: 200
      })
    ).rejects.toThrow('VIP_ALREADY_EXISTS')
  })

  it('refunds VIP purchase to balance', async () => {
    await createTestUser({ balance: 300 })

    await refundVipPurchase({
      userId: 'user-1',
      guildId: 'guild-1',
      totalPrice: 150,
      purchaseId: 'vip-buy-1'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(450)

    const tx = await Transaction.findOne({
      userId: 'user-1',
      type: 'vip'
    })
    expect(tx?.meta).toMatchObject({
      action: 'buy-refund',
      purchaseId: 'vip-buy-1'
    })
  })

  it('extends VIP and charges balance', async () => {
    await createTestUser({ balance: 400 })
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch-1',
      expiresAt: new Date('2026-08-01T00:00:00Z')
    })

    const newExpiry = new Date('2027-01-01T00:00:00Z')
    await extendVipAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      totalPrice: 100,
      newExpiry,
      durationDays: 30
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    const vip = await VipRoom.findOne({ ownerId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(300)
    expect(vip?.expiresAt).toEqual(newExpiry)
  })
})
