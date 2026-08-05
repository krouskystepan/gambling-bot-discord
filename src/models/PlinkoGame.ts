import { PlinkoGameSchema } from 'gambling-bot-shared/mongoose'
import { type TPlinkoGame } from 'gambling-bot-shared/plinko'
import mongoose from 'mongoose'

export type { TPlinkoGame } from 'gambling-bot-shared/plinko'

export default (mongoose.models.PlinkoGame as mongoose.Model<TPlinkoGame>) ||
  mongoose.model<TPlinkoGame>('PlinkoGame', PlinkoGameSchema)
