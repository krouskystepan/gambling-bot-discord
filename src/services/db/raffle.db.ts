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
  tickets,
  maxTicketsPerUser
}: TAddRaffleTickets): Promise<boolean> => {
  const now = new Date()

  const updateExisting = await Raffle.updateOne(
    {
      raffleId,
      guildId,
      status: 'active',
      nextDrawAt: { $gt: now },
      'participants.userId': userId,
      $expr: {
        $lte: [
          {
            $add: [
              {
                $ifNull: [
                  {
                    $first: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$participants',
                            as: 'p',
                            cond: { $eq: ['$$p.userId', userId] }
                          }
                        },
                        as: 'p',
                        in: '$$p.tickets'
                      }
                    }
                  },
                  0
                ]
              },
              tickets
            ]
          },
          maxTicketsPerUser
        ]
      }
    },
    { $inc: { 'participants.$.tickets': tickets } }
  )

  if (updateExisting.modifiedCount > 0) return true

  const addNew = await Raffle.updateOne(
    {
      raffleId,
      guildId,
      status: 'active',
      nextDrawAt: { $gt: now },
      participants: { $not: { $elemMatch: { userId } } },
      $expr: {
        $lte: [
          {
            $cond: [{ $gte: [tickets, 0] }, tickets, maxTicketsPerUser]
          },
          maxTicketsPerUser
        ]
      }
    },
    { $push: { participants: { userId, tickets } } }
  )

  return addNew.modifiedCount > 0
}

export const cancelRaffleAtomic = async ({
  raffleId,
  guildId
}: {
  raffleId: string
  guildId: string
}) => {
  return Raffle.findOneAndUpdate(
    { raffleId, guildId, status: { $ne: 'canceled' } },
    { $set: { status: 'canceled' } },
    { new: true }
  )
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
        raffleId: { $regex: query, $options: 'i' },
        status: 'active'
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
    status: 'active',
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
    {
      raffleId,
      status: 'active'
    },
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
