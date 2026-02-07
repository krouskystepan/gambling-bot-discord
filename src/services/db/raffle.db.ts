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
  drawId,
  raffleId,
  creatorId,
  channelId,
  ticketPrice,
  maxTicketsPerUser,
  nextDrawAt,
  drawIntervalMs
}: {
  raffleId: string
  drawId: string
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
        drawId,
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
  return Raffle.aggregate([
    {
      $match: {
        guildId,
        raffleId: { $regex: query, $options: 'i' }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 25 },
    {
      $addFields: {
        totalTickets: {
          $sum: {
            $map: {
              input: '$participants',
              as: 'p',
              in: '$$p.tickets'
            }
          }
        }
      }
    },
    {
      $addFields: {
        totalPot: { $multiply: ['$totalTickets', '$ticketPrice'] }
      }
    },
    {
      $project: {
        raffleId: 1,
        nextDrawAt: 1,
        ticketPrice: 1,
        maxTicketsPerUser: 1,
        totalPot: 1
      }
    }
  ])
}

export const getRafflesReadyToDraw = async () => {
  return Raffle.find({
    nextDrawAt: { $lte: new Date() }
  })
}

export const completeRaffleDraw = async ({
  raffleId,
  nextDrawAt,
  lastDrawAt,
  drawId
}: {
  raffleId: string
  nextDrawAt: Date
  lastDrawAt: Date
  drawId: string
}) => {
  await Raffle.updateOne(
    { raffleId },
    {
      $set: {
        nextDrawAt,
        lastDrawAt,
        participants: [],
        drawId
      }
    }
  )
}
