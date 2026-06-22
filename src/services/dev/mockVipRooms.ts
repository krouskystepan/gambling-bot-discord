import type { TVipRoom } from 'gambling-bot-shared/vip'

import VipRoom from '@/models/VipRoom'

import {
  type MockUserPools,
  fakeChannelId,
  randomCreatedAt,
  randomInt
} from './constants'

export type MockVipRoomsResult = {
  inserted: number
  active: number
  expired: number
  totalMembers: number
}

export async function mockVipRooms({
  guildId,
  pools,
  count,
  days = 30
}: {
  guildId: string
  pools: MockUserPools
  count: number
  days?: number
}): Promise<MockVipRoomsResult> {
  const docs: TVipRoom[] = []
  let totalMembers = 0

  const ownerPool = [...pools.userIds].sort(() => Math.random() - 0.5)
  const owners = ownerPool.slice(0, Math.min(count, ownerPool.length))

  for (let i = 0; i < count; i++) {
    const ownerId = owners[i % owners.length]
    const createdAt = randomCreatedAt(days)
    const isActive = Math.random() < 0.72

    const expiresAt = isActive
      ? new Date(Date.now() + randomInt(1, 90) * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000)

    const memberCount = randomInt(0, Math.min(5, pools.userIds.length - 1))
    const memberIds = pools.userIds
      .filter((id) => id !== ownerId)
      .sort(() => Math.random() - 0.5)
      .slice(0, memberCount)

    totalMembers += memberIds.length

    docs.push({
      ownerId,
      guildId,
      channelId: fakeChannelId(),
      memberIds,
      expiresAt,
      createdAt,
      updatedAt: createdAt
    })
  }

  const insertedDocs: TVipRoom[] = []
  for (const doc of docs) {
    try {
      await VipRoom.create(doc)
      insertedDocs.push(doc)
    } catch {
      // Unique ownerId+guildId — skip duplicates when count > unique owners.
    }
  }

  return {
    inserted: insertedDocs.length,
    active: insertedDocs.filter((d) => d.expiresAt > new Date()).length,
    expired: insertedDocs.filter((d) => d.expiresAt <= new Date()).length,
    totalMembers
  }
}
