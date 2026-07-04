import { describe, expect, it } from 'vitest'

import { createGuildConfiguration } from '@/services/db/guildConfiguration.db'
import {
  addMemberToVip,
  addVipMemberAtomic,
  clearVipExpiryWarnings,
  createVip,
  deleteVipByOwnerId,
  extendVipAtomic,
  extendVipExpiry,
  finalizeVipPurchase,
  getActiveVipByOwner,
  getAllActiveVips,
  getAllActiveVipsByGuildId,
  getAllOldVips,
  getVipsNeedingExpiryWarning,
  markVipExpiryWarningSent,
  refundVipPurchase,
  removeMemberFromVip,
  removeVipMemberAtomic,
  reserveVipPurchase
} from '@/services/db/vip.db'

import {
  GuildConfiguration,
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

  it('throws USER_NOT_FOUND on extendVipAtomic', async () => {
    await expect(
      extendVipAtomic({
        userId: 'missing',
        guildId: 'guild-1',
        totalPrice: 10,
        newExpiry: new Date('2027-01-01'),
        durationDays: 7
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('throws INSUFFICIENT_FUNDS on extendVipAtomic', async () => {
    await createTestUser({ balance: 5 })
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch-1',
      expiresAt: new Date('2026-08-01T00:00:00Z')
    })

    await expect(
      extendVipAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        totalPrice: 100,
        newExpiry: new Date('2027-01-01'),
        durationDays: 30
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('throws VIP_NOT_FOUND on extendVipAtomic', async () => {
    await createTestUser({ balance: 500 })

    await expect(
      extendVipAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        totalPrice: 50,
        newExpiry: new Date('2027-01-01'),
        durationDays: 30
      })
    ).rejects.toThrow('VIP_NOT_FOUND')
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

  it('lists active and expired VIP rooms', async () => {
    await VipRoom.create({
      ownerId: 'active-1',
      guildId: 'guild-1',
      channelId: 'ch-active',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })
    await VipRoom.create({
      ownerId: 'expired-1',
      guildId: 'guild-1',
      channelId: 'ch-expired',
      expiresAt: new Date('2020-01-01T00:00:00Z')
    })
    await VipRoom.create({
      ownerId: 'other-guild',
      guildId: 'guild-2',
      channelId: 'ch-2',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })

    const byGuild = await getAllActiveVipsByGuildId({ guildId: 'guild-1' })
    expect(byGuild.map((v) => v.ownerId)).toEqual(['active-1'])

    const allActive = await getAllActiveVips()
    expect(allActive.map((v) => v.ownerId).sort()).toEqual([
      'active-1',
      'other-guild'
    ])

    const old = await getAllOldVips()
    expect(old.map((v) => v.ownerId)).toEqual(['expired-1'])
  })

  it('creates, fetches, extends, and deletes VIP room', async () => {
    const expiry = new Date('2026-12-01T00:00:00Z')
    await createVip({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: expiry
    })

    const active = await getActiveVipByOwner({
      ownerId: 'user-1',
      guildId: 'guild-1'
    })
    expect(active?.channelId).toBe('vip-ch')

    const extended = new Date('2027-06-01T00:00:00Z')
    await extendVipExpiry({
      ownerId: 'user-1',
      guildId: 'guild-1',
      newExpiry: extended
    })
    expect(
      (await getActiveVipByOwner({ ownerId: 'user-1', guildId: 'guild-1' }))
        ?.expiresAt
    ).toEqual(extended)

    await deleteVipByOwnerId({ ownerId: 'user-1', guildId: 'guild-1' })
    expect(
      await getActiveVipByOwner({ ownerId: 'user-1', guildId: 'guild-1' })
    ).toBeNull()
  })

  it('clears expiry warnings on extendVipExpiry', async () => {
    const expiry = new Date(Date.now() + 30 * 60 * 1000)
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: expiry,
      expiryWarningsSent: ['1h']
    })

    const extended = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await extendVipExpiry({
      ownerId: 'user-1',
      guildId: 'guild-1',
      newExpiry: extended
    })

    const vip = await VipRoom.findOne({ ownerId: 'user-1', guildId: 'guild-1' })
    expect(vip?.expiresAt).toEqual(extended)
    expect(vip?.expiryWarningsSent).toEqual([])
  })

  it('marks and clears expiry warning tiers', async () => {
    const expiry = new Date(Date.now() + 30 * 60 * 1000)
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: expiry
    })

    await markVipExpiryWarningSent({
      ownerId: 'user-1',
      guildId: 'guild-1',
      tier: '1h'
    })

    expect(
      await getVipsNeedingExpiryWarning('1h').then((rooms) =>
        rooms.map((room) => room.ownerId)
      )
    ).not.toContain('user-1')

    await clearVipExpiryWarnings({ ownerId: 'user-1', guildId: 'guild-1' })

    expect(
      await getVipsNeedingExpiryWarning('1h').then((rooms) =>
        rooms.map((room) => room.ownerId)
      )
    ).toContain('user-1')
  })

  it('adds and removes VIP members without charge', async () => {
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      memberIds: []
    })

    await addMemberToVip({
      ownerId: 'user-1',
      guildId: 'guild-1',
      memberId: 'member-1'
    })

    const updated = await removeMemberFromVip({
      ownerId: 'user-1',
      guildId: 'guild-1',
      memberId: 'member-1'
    })
    expect(updated?.memberIds).toEqual([])
  })

  it('finalizes VIP purchase with transaction meta', async () => {
    await finalizeVipPurchase({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-final',
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      purchaseId: 'vip-purchase-1'
    })

    const vip = await VipRoom.findOne({ ownerId: 'user-1', guildId: 'guild-1' })
    expect(vip?.channelId).toBe('vip-final')

    const tx = await Transaction.findOne({ userId: 'user-1', type: 'vip' })
    expect(tx?.meta).toMatchObject({
      action: 'buy-finalize',
      purchaseId: 'vip-purchase-1'
    })
  })

  it('charges owner when adding VIP member atomically', async () => {
    await createTestUser({ balance: 200 })
    await createGuildConfiguration({ guildId: 'guild-1' })
    await GuildConfiguration.updateOne(
      { guildId: 'guild-1' },
      {
        $set: {
          'vipSettings.maxMembers': 3,
          'vipSettings.pricePerAdditionalMember': 40
        }
      }
    )
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      memberIds: []
    })

    const charged = await addVipMemberAtomic({
      ownerId: 'user-1',
      guildId: 'guild-1',
      memberId: 'member-1'
    })

    expect(charged).toBe(40)
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(160)
  })

  it('throws VIP_NOT_FOUND and VIP_SETTINGS_NOT_FOUND on addVipMemberAtomic', async () => {
    await createTestUser({ balance: 100 })

    await expect(
      addVipMemberAtomic({
        ownerId: 'user-1',
        guildId: 'guild-1',
        memberId: 'member-1'
      })
    ).rejects.toThrow('VIP_NOT_FOUND')

    await createTestUser({ userId: 'user-2', guildId: 'guild-2', balance: 500 })
    await VipRoom.create({
      ownerId: 'user-2',
      guildId: 'guild-2',
      channelId: 'vip-ch-2',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      memberIds: []
    })

    await expect(
      addVipMemberAtomic({
        ownerId: 'user-2',
        guildId: 'guild-2',
        memberId: 'member-1'
      })
    ).rejects.toThrow('VIP_SETTINGS_NOT_FOUND')
  })

  it('throws ALREADY_MEMBER on addVipMemberAtomic', async () => {
    await createTestUser({ balance: 200 })
    await createGuildConfiguration({ guildId: 'guild-1' })
    await GuildConfiguration.updateOne(
      { guildId: 'guild-1' },
      {
        $set: {
          'vipSettings.maxMembers': 5,
          'vipSettings.pricePerAdditionalMember': 10
        }
      }
    )
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      memberIds: ['member-1']
    })

    await expect(
      addVipMemberAtomic({
        ownerId: 'user-1',
        guildId: 'guild-1',
        memberId: 'member-1'
      })
    ).rejects.toThrow('ALREADY_MEMBER')
  })

  it('throws on addVipMemberAtomic edge cases', async () => {
    await createTestUser({ balance: 10 })
    await createGuildConfiguration({ guildId: 'guild-1' })
    await GuildConfiguration.updateOne(
      { guildId: 'guild-1' },
      {
        $set: {
          'vipSettings.maxMembers': 1,
          'vipSettings.pricePerAdditionalMember': 50
        }
      }
    )
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      memberIds: ['member-full']
    })

    await expect(
      addVipMemberAtomic({
        ownerId: 'user-1',
        guildId: 'guild-1',
        memberId: 'member-2'
      })
    ).rejects.toThrow('VIP_FULL')

    await VipRoom.updateOne(
      { ownerId: 'user-1', guildId: 'guild-1' },
      { $set: { memberIds: [] } }
    )

    await expect(
      addVipMemberAtomic({
        ownerId: 'user-1',
        guildId: 'guild-1',
        memberId: 'member-2'
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('removes VIP member atomically', async () => {
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      memberIds: ['member-1']
    })

    await removeVipMemberAtomic({
      ownerId: 'user-1',
      guildId: 'guild-1',
      memberId: 'member-1'
    })

    const vip = await VipRoom.findOne({ ownerId: 'user-1', guildId: 'guild-1' })
    expect(vip?.memberIds).toEqual([])

    await expect(
      removeVipMemberAtomic({
        ownerId: 'user-1',
        guildId: 'guild-1',
        memberId: 'ghost'
      })
    ).rejects.toThrow('NOT_A_MEMBER')

    await expect(
      removeVipMemberAtomic({
        ownerId: 'missing',
        guildId: 'guild-1',
        memberId: 'member-1'
      })
    ).rejects.toThrow('VIP_NOT_FOUND')
  })
})
