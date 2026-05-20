import { describe, expect, it } from 'vitest'

import {
  addRaffleTickets,
  cancelRaffleAtomic,
  completeRaffleDraw,
  getRaffleById,
  searchRafflesForAutocomplete,
  upsertRaffle
} from '@/services/db/raffle.db'
import {
  payRaffleWinner,
  refundRafflePurchase
} from '@/services/casino/casinoBet.service'

import {
  Raffle,
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const seedRaffle = async (raffleId: string) => {
  await upsertRaffle({
    raffleId,
    drawId: 'draw-1',
    guildId: 'guild-1',
    creatorId: 'mod-1',
    channelId: 'channel-1',
    ticketPrice: 10,
    maxTicketsPerUser: 5,
    nextDrawAt: new Date('2020-01-01T00:00:00Z'),
    drawIntervalMs: 86_400_000
  })
  await Raffle.updateOne(
    { raffleId },
    {
      $set: {
        participants: [
          { userId: 'user-1', tickets: 2 },
          { userId: 'user-2', tickets: 3 }
        ]
      }
    }
  )
}

describe('raffle.db', () => {
  it('fetches raffle by id', async () => {
    await seedRaffle('raffle-get')

    const raffle = await getRaffleById({
      raffleId: 'raffle-get',
      guildId: 'guild-1'
    })

    expect(raffle?.ticketPrice).toBe(10)
  })

  it('adds tickets for new and existing participants', async () => {
    await upsertRaffle({
      raffleId: 'raffle-tickets',
      drawId: 'draw-1',
      guildId: 'guild-1',
      creatorId: 'mod-1',
      channelId: 'channel-1',
      ticketPrice: 10,
      maxTicketsPerUser: 5,
      nextDrawAt: new Date('2099-01-01T00:00:00Z'),
      drawIntervalMs: 86_400_000
    })

    const first = await addRaffleTickets({
      raffleId: 'raffle-tickets',
      guildId: 'guild-1',
      userId: 'user-1',
      tickets: 2,
      maxTicketsPerUser: 5
    })
    expect(first).toBe(true)

    const second = await addRaffleTickets({
      raffleId: 'raffle-tickets',
      guildId: 'guild-1',
      userId: 'user-1',
      tickets: 1,
      maxTicketsPerUser: 5
    })
    expect(second).toBe(true)

    const third = await addRaffleTickets({
      raffleId: 'raffle-tickets',
      guildId: 'guild-1',
      userId: 'user-2',
      tickets: 3,
      maxTicketsPerUser: 5
    })
    expect(third).toBe(true)

    const raffle = await Raffle.findOne({ raffleId: 'raffle-tickets' })
    expect(raffle?.participants).toHaveLength(2)
  })

  it('searches raffles for autocomplete', async () => {
    await seedRaffle('raffle-search-1')

    const results = await searchRafflesForAutocomplete({
      guildId: 'guild-1',
      query: 'search'
    })

    expect(results.some((r) => r.raffleId === 'raffle-search-1')).toBe(true)
    expect(results[0]).toHaveProperty('totalPot')
  })

  it('cancels active raffle', async () => {
    await seedRaffle('raffle-1')

    const canceled = await cancelRaffleAtomic({
      raffleId: 'raffle-1',
      guildId: 'guild-1'
    })

    expect(canceled?.status).toBe('canceled')
  })

  it('completes draw and resets participants', async () => {
    await seedRaffle('raffle-2')

    const nextDrawAt = new Date('2026-06-01T00:00:00Z')
    const lastDrawAt = new Date('2026-05-01T00:00:00Z')

    await completeRaffleDraw({
      raffleId: 'raffle-2',
      nextDrawAt,
      lastDrawAt,
      drawId: 'draw-2'
    })

    const raffle = await Raffle.findOne({ raffleId: 'raffle-2' })
    expect(raffle?.participants).toEqual([])
    expect(raffle?.nextDrawAt).toEqual(nextDrawAt)
    expect(raffle?.drawId).toBe('draw-2')
  })
})

describe('raffle money via casinoBet.service', () => {
  it('refunds raffle purchase to balance', async () => {
    await createTestUser({ balance: 100 })

    await refundRafflePurchase({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 40,
      raffleId: 'raffle-refund-1'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(140)

    const tx = await Transaction.findOne({
      betId: 'raffle-refund-1',
      type: 'refund'
    })
    expect(tx?.amount).toBe(40)
  })

  it('throws USER_NOT_FOUND on raffle refund', async () => {
    await expect(
      refundRafflePurchase({
        userId: 'missing',
        guildId: 'guild-1',
        amount: 10,
        raffleId: 'raffle-refund-missing'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('throws USER_NOT_FOUND on raffle winner pay', async () => {
    await expect(
      payRaffleWinner({
        userId: 'missing',
        guildId: 'guild-1',
        amount: 10,
        raffleId: 'raffle-win-missing'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('pays raffle winner', async () => {
    await createTestUser({ balance: 50 })

    await payRaffleWinner({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 250,
      raffleId: 'raffle-win-1'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(300)

    const tx = await Transaction.findOne({
      betId: 'raffle-win-1',
      type: 'win'
    })
    expect(tx?.amount).toBe(250)
  })
})
