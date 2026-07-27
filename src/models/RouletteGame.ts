import { RouletteGameSchema } from 'gambling-bot-shared/mongoose'
import { type TRouletteGame } from 'gambling-bot-shared/roulette'
import mongoose from 'mongoose'

export type { TRouletteGame } from 'gambling-bot-shared/roulette'

export default (mongoose.models
  .RouletteGame as mongoose.Model<TRouletteGame>) ||
  mongoose.model<TRouletteGame>('RouletteGame', RouletteGameSchema)
