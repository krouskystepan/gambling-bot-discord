import { Schema, model } from 'mongoose'

type TRaffle = {
  drawId: string
  raffleId: string
  guildId: string
  channelId: string
  creatorId: string

  ticketPrice: number
  maxTicketsPerUser: number

  nextDrawAt: Date
  lastDrawAt?: Date
  drawIntervalMs: number

  participants: {
    userId: string
    tickets: number
  }[]

  createdAt: Date
  updatedAt: Date
}

const RaffleSchema = new Schema<TRaffle>(
  {
    drawId: { type: String, required: true },
    raffleId: { type: String, required: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    creatorId: { type: String, required: true },

    ticketPrice: { type: Number, required: true, min: 1 },
    maxTicketsPerUser: { type: Number, required: true, min: 1 },

    nextDrawAt: { type: Date, required: true },
    lastDrawAt: { type: Date },
    drawIntervalMs: { type: Number, required: true, min: 1 },

    participants: [
      {
        userId: { type: String, required: true },
        tickets: { type: Number, required: true, min: 1 }
      }
    ]
  },
  { timestamps: true }
)

RaffleSchema.index({ raffleId: 1 }, { unique: true })

export default model<TRaffle>('Raffle', RaffleSchema)
