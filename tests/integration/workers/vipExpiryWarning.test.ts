import { describe, expect, it } from 'vitest'

import {
  extendVipAtomic,
  extendVipExpiry,
  getVipsNeedingExpiryWarning,
  markVipExpiryWarningSent
} from '@/services/db/vip.db'

import {
  User,
  VipRoom,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

describe('vip expiry warning data flow', () => {
  it('returns only 24h tier rooms in the 24h window', async () => {
    await VipRoom.create({
      ownerId: 'user-24h',
      guildId: 'guild-1',
      channelId: 'vip-24h',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
    })
    await VipRoom.create({
      ownerId: 'user-1h',
      guildId: 'guild-1',
      channelId: 'vip-1h',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    })
    await VipRoom.create({
      ownerId: 'user-later',
      guildId: 'guild-1',
      channelId: 'vip-later',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    })

    const needing24h = await getVipsNeedingExpiryWarning('24h')
    const ownerIds = needing24h.map((room) => room.ownerId)

    expect(ownerIds).toContain('user-24h')
    expect(ownerIds).not.toContain('user-1h')
    expect(ownerIds).not.toContain('user-later')
  })

  it('returns only 1h tier rooms in the 1h window', async () => {
    await VipRoom.create({
      ownerId: 'user-24h',
      guildId: 'guild-1',
      channelId: 'vip-24h',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
    })
    await VipRoom.create({
      ownerId: 'user-1h',
      guildId: 'guild-1',
      channelId: 'vip-1h',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    })

    const needing1h = await getVipsNeedingExpiryWarning('1h')
    const ownerIds = needing1h.map((room) => room.ownerId)

    expect(ownerIds).toContain('user-1h')
    expect(ownerIds).not.toContain('user-24h')
  })

  it('excludes rooms already marked for a warning tier', async () => {
    await VipRoom.create({
      ownerId: 'user-24h',
      guildId: 'guild-1',
      channelId: 'vip-24h',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
    })

    await markVipExpiryWarningSent({
      ownerId: 'user-24h',
      guildId: 'guild-1',
      tier: '24h'
    })

    expect(
      await getVipsNeedingExpiryWarning('24h').then((rooms) =>
        rooms.map((room) => room.ownerId)
      )
    ).not.toContain('user-24h')
  })

  it('clears warning markers after extendVipExpiry', async () => {
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-1',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      expiryWarningsSent: ['24h']
    })

    await extendVipExpiry({
      ownerId: 'user-1',
      guildId: 'guild-1',
      newExpiry: new Date(Date.now() + 12 * 60 * 60 * 1000)
    })

    expect(
      await getVipsNeedingExpiryWarning('24h').then((rooms) =>
        rooms.map((room) => room.ownerId)
      )
    ).toContain('user-1')
  })

  it('clears warning markers after extendVipAtomic', async () => {
    await createTestUser({ balance: 500 })
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-1',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      expiryWarningsSent: ['1h']
    })

    const newExpiry = new Date(Date.now() + 45 * 60 * 1000)
    await extendVipAtomic({
      userId: 'user-1',
      guildId: 'guild-1',
      totalPrice: 100,
      newExpiry,
      durationDays: 7
    })

    const vip = await VipRoom.findOne({ ownerId: 'user-1', guildId: 'guild-1' })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(vip?.expiresAt).toEqual(newExpiry)
    expect(vip?.expiryWarningsSent).toEqual([])
    expect(user?.balance).toBe(400)
    expect(
      await getVipsNeedingExpiryWarning('1h').then((rooms) =>
        rooms.map((room) => room.ownerId)
      )
    ).toContain('user-1')
  })
})
