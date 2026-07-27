import { SlotsGameSchema } from 'gambling-bot-shared/mongoose'
import { type TSlotsGame } from 'gambling-bot-shared/slots'
import mongoose from 'mongoose'

export type { TSlotsGame } from 'gambling-bot-shared/slots'

export default (mongoose.models.SlotsGame as mongoose.Model<TSlotsGame>) ||
  mongoose.model<TSlotsGame>('SlotsGame', SlotsGameSchema)
