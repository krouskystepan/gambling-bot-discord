import { afterEach, describe, expect, it, vi } from 'vitest'

import { getActiveVipChannels } from '@/services/vip/getActiveVipChannels.service'

import { VipRoom, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('getActiveVipChannels', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns channel ids for active VIP rooms in guild', async () => {
    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-1',
      channelId: 'vip-ch-1',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })
    await VipRoom.create({
      ownerId: 'user-2',
      guildId: 'guild-1',
      channelId: 'vip-ch-2',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })
    await VipRoom.create({
      ownerId: 'user-3',
      guildId: 'guild-1',
      channelId: 'vip-expired',
      expiresAt: new Date('2020-01-01T00:00:00Z')
    })

    const channels = await getActiveVipChannels('guild-1')
    expect(channels.sort()).toEqual(['vip-ch-1', 'vip-ch-2'])
  })

  it('caches results for one minute', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))

    await VipRoom.create({
      ownerId: 'user-1',
      guildId: 'guild-cache',
      channelId: 'vip-cache-1',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })

    expect(await getActiveVipChannels('guild-cache')).toEqual(['vip-cache-1'])

    await VipRoom.create({
      ownerId: 'user-2',
      guildId: 'guild-cache',
      channelId: 'vip-cache-2',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })

    expect(await getActiveVipChannels('guild-cache')).toEqual(['vip-cache-1'])

    vi.advanceTimersByTime(60_001)

    expect(await getActiveVipChannels('guild-cache').then((c) => c.sort())).toEqual(
      ['vip-cache-1', 'vip-cache-2']
    )
  })
})
