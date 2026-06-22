import { generateId } from 'gambling-bot-shared/common'
import type { TRaffle } from 'gambling-bot-shared/raffle'

import Raffle from '@/models/Raffle'

import {
  type MockUserPools,
  fakeChannelId,
  pickChipAmount,
  randomChoice,
  randomCreatedAt,
  randomInt,
  weightedRandomChoice
} from './constants'

export type MockRafflesResult = {
  inserted: number
  active: number
  canceled: number
  totalTickets: number
}

const RAFFLE_STATUS_WEIGHTS = {
  active: 72,
  canceled: 28
} as const

const DRAW_INTERVALS_MS = [
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000
]

export async function mockRaffles({
  guildId,
  pools,
  count,
  days = 30
}: {
  guildId: string
  pools: MockUserPools
  count: number
  days?: number
}): Promise<MockRafflesResult> {
  const docs: TRaffle[] = []
  let active = 0
  let canceled = 0
  let totalTickets = 0

  for (let i = 0; i < count; i++) {
    const status = weightedRandomChoice(RAFFLE_STATUS_WEIGHTS)
    const createdAt = randomCreatedAt(days)
    const drawIntervalMs = randomChoice(DRAW_INTERVALS_MS)
    const ticketPrice = pickChipAmount(500)
    const maxTicketsPerUser = randomChoice([5, 10, 20, 50])
    const participantCount = randomInt(3, Math.min(40, pools.userIds.length))

    const participantPool = [...pools.userIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, participantCount)

    const participants = participantPool.map((userId) => {
      const roll = Math.random()
      let tickets: number
      if (roll < 0.5) {
        tickets = randomInt(1, 3)
      } else if (roll < 0.85) {
        tickets = randomInt(3, Math.min(10, maxTicketsPerUser))
      } else {
        tickets = randomInt(
          Math.floor(maxTicketsPerUser * 0.5),
          maxTicketsPerUser
        )
      }
      totalTickets += tickets
      return { userId, tickets }
    })

    if (status === 'active') active++
    else canceled++

    const nextDrawAt =
      status === 'active'
        ? new Date(Date.now() + randomInt(1, 72) * 60 * 60 * 1000)
        : new Date(createdAt.getTime() + drawIntervalMs)

    docs.push({
      drawId: generateId(),
      raffleId: generateId(),
      guildId,
      channelId: fakeChannelId(),
      creatorId: pools.pickAdmin(),
      ticketPrice,
      maxTicketsPerUser,
      nextDrawAt,
      lastDrawAt:
        status === 'canceled' && Math.random() < 0.4
          ? new Date(createdAt.getTime() + drawIntervalMs)
          : undefined,
      drawIntervalMs,
      status,
      participants,
      createdAt,
      updatedAt: createdAt
    })
  }

  await Raffle.insertMany(docs)

  return { inserted: docs.length, active, canceled, totalTickets }
}
