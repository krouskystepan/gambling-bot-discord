import { describe, expect, it } from 'vitest'

import { cancelRaffle } from '@/services/raffles/cancelRaffle.service'
import { upsertRaffle } from '@/services/db/raffle.db'

import {
  Raffle,
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const seedActiveRaffle = async (raffleId: string) => {
  await upsertRaffle({
    raffleId,
    drawId: 'draw-cancel-1',
    guildId: 'guild-1',
    creatorId: 'mod-1',
    channelId: 'channel-1',
    ticketPrice: 10,
    maxTicketsPerUser: 5,
    nextDrawAt: new Date('2099-01-01T00:00:00Z'),
    drawIntervalMs: 86_400_000
  })

  await Raffle.updateOne(
    { raffleId },
    {
      $set: {
        participants: [
          { userId: 'user-1', tickets: 2 },
          { userId: 'user-2', tickets: 1 }
        ]
      }
    }
  )
}

describe('cancelRaffle.service', () => {
  it('returns NOT_FOUND when raffle is missing', async () => {
    const result = await cancelRaffle({
      raffleId: 'missing',
      guildId: 'guild-1'
    })

    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('cancels raffle and refunds participants', async () => {
    await createTestUser({ userId: 'user-1', balance: 100 })
    await createTestUser({ userId: 'user-2', balance: 50 })
    await seedActiveRaffle('raffle-cancel')

    const result = await cancelRaffle({
      raffleId: 'raffle-cancel',
      guildId: 'guild-1'
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.raffle.status).toBe('canceled')
    expect(result.refundErrors).toEqual([])

    const user1 = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    const user2 = await User.findOne({ userId: 'user-2', guildId: 'guild-1' })
    expect(user1?.balance).toBe(120)
    expect(user2?.balance).toBe(60)

    const refunds = await Transaction.find({ type: 'refund' }).sort({ amount: 1 })
    expect(refunds).toHaveLength(2)
    expect(refunds.map((tx) => tx.amount)).toEqual([10, 20])
  })

  it('records refund errors for missing users', async () => {
    await seedActiveRaffle('raffle-cancel-errors')

    const result = await cancelRaffle({
      raffleId: 'raffle-cancel-errors',
      guildId: 'guild-1'
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.refundErrors).toEqual(
      expect.arrayContaining(['user-1', 'user-2'])
    )
  })
})
