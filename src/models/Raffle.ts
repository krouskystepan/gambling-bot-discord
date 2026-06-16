import { RaffleSchema } from 'gambling-bot-shared/mongoose'
import { TRaffle } from 'gambling-bot-shared/raffle'
import mongoose from 'mongoose'

export type { TRaffle } from 'gambling-bot-shared/raffle'

export default (mongoose.models.Raffle as mongoose.Model<TRaffle>) ||
  mongoose.model<TRaffle>('Raffle', RaffleSchema)
