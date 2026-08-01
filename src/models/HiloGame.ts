import { THiloGame } from 'gambling-bot-shared/casino'
import { HiloGameSchema } from 'gambling-bot-shared/mongoose'
import mongoose from 'mongoose'

export type {
  THiloGame,
  HiloGameStatus,
  HiloStoredCard
} from 'gambling-bot-shared/casino'

export default (mongoose.models.HiloGame as mongoose.Model<THiloGame>) ||
  mongoose.model<THiloGame>('HiloGame', HiloGameSchema)
