import { TMinesGame } from 'gambling-bot-shared/mines'
import { MinesGameSchema } from 'gambling-bot-shared/mongoose'
import mongoose from 'mongoose'

export type { TMinesGame, MinesGameStatus } from 'gambling-bot-shared/mines'

export default (mongoose.models.MinesGame as mongoose.Model<TMinesGame>) ||
  mongoose.model<TMinesGame>('MinesGame', MinesGameSchema)
