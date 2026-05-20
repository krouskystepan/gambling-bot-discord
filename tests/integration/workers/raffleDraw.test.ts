import { describe, expect, it } from 'vitest'

import { payRaffleWinner } from '@/services/casino/casinoBet.service'
import {
  completeRaffleDraw,
  getRafflesReadyToDraw,
  upsertRaffle
} from '@/services/db/raffle.db'

import {
  Raffle,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

describe('raffle draw data flow', () => {
  it('finds raffles ready to draw and pays winner', async () => {
    await createTestUser({ userId: 'winner', balance: 0 })
    await upsertRaffle({
      raffleId: 'raffle-draw-1',
      drawId: 'draw-ready',
      guildId: 'guild-1',
      creatorId: 'mod-1',
      channelId: 'channel-1',
      ticketPrice: 10,
      maxTicketsPerUser: 10,
      nextDrawAt: new Date('2020-01-01T00:00:00Z'),
      drawIntervalMs: 86_400_000
    })
    await Raffle.updateOne(
      { raffleId: 'raffle-draw-1' },
      {
        $set: {
          participants: [
            { userId: 'winner', tickets: 5 },
            { userId: 'user-2', tickets: 2 }
          ]
        }
      }
    )

    const ready = await getRafflesReadyToDraw()
    expect(ready.some((r) => r.raffleId === 'raffle-draw-1')).toBe(true)

    const pot = 70 * 0.9
    await payRaffleWinner({
      userId: 'winner',
      guildId: 'guild-1',
      amount: pot,
      raffleId: 'draw-ready'
    })

    const winner = await User.findOne({ userId: 'winner', guildId: 'guild-1' })
    expect(winner?.balance).toBe(pot)

    await completeRaffleDraw({
      raffleId: 'raffle-draw-1',
      nextDrawAt: new Date('2026-07-01T00:00:00Z'),
      lastDrawAt: new Date('2020-01-01T00:00:00Z'),
      drawId: 'draw-next'
    })

    const raffle = await Raffle.findOne({ raffleId: 'raffle-draw-1' })
    expect(raffle?.participants).toEqual([])
    expect(raffle?.drawId).toBe('draw-next')
  })
})
