import Raffle from '@/models/Raffle'
import { TAddRaffleTickets } from '@/types/types'

export const getRaffleById = async ({
  raffleId,
  guildId
}: {
  raffleId: string
  guildId: string
}) => {
  return Raffle.findOne({ raffleId, guildId })
}

export const upsertRaffle = async ({
  guildId,
  raffleId,
  creatorId,
  channelId,
  ticketPrice,
  maxTicketsPerUser,
  nextDrawAt,
  drawIntervalMs
}: {
  raffleId: string
  guildId: string
  creatorId: string
  channelId: string
  ticketPrice: number
  maxTicketsPerUser: number
  nextDrawAt: Date
  drawIntervalMs: number
}) => {
  return Raffle.findOneAndUpdate(
    { raffleId, guildId },
    {
      $set: {
        creatorId,
        channelId,
        ticketPrice,
        maxTicketsPerUser,
        nextDrawAt,
        drawIntervalMs
      }
    },
    {
      upsert: true,
      new: true
    }
  )
}

export const addRaffleTickets = async ({
  raffleId,
  guildId,
  userId,
  tickets
}: TAddRaffleTickets) => {
  const result = await Raffle.updateOne(
    {
      raffleId,
      guildId,
      'participants.userId': userId
    },
    {
      $inc: { 'participants.$.tickets': tickets }
    }
  )

  if (result.matchedCount === 0) {
    await Raffle.updateOne(
      { raffleId, guildId },
      {
        $push: {
          participants: {
            userId,
            tickets
          }
        }
      }
    )
  }
}

export const deleteRaffle = async ({ raffleId }: { raffleId: string }) => {
  await Raffle.findOneAndDelete({ raffleId })
}

export const searchRafflesForAutocomplete = async ({
  guildId,
  query
}: {
  guildId: string
  query: string
}) => {
  return Raffle.find({
    guildId,
    raffleId: { $regex: query, $options: 'i' }
  })
    .sort({ createdAt: -1 })
    .limit(25)
    .select('raffleId nextDrawAt')
    .lean()
}

export const getRafflesReadyToDraw = async () => {
  return Raffle.find({
    nextDrawAt: { $lte: new Date() }
  })
}

export const completeRaffleDraw = async ({
  raffleId,
  nextDrawAt,
  lastDrawAt
}: {
  raffleId: string
  nextDrawAt: Date
  lastDrawAt: Date
}) => {
  await Raffle.updateOne(
    { raffleId },
    {
      $set: {
        nextDrawAt,
        lastDrawAt,
        participants: []
      }
    }
  )
}
