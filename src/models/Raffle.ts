import { TRaffle } from 'gambling-bot-shared'
import { RaffleSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export type { TRaffle } from 'gambling-bot-shared'

export default (mongoose.models.Raffle as mongoose.Model<TRaffle>) ||
  mongoose.model<TRaffle>('Raffle', RaffleSchema)
