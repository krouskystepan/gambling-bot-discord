import { TAtmRequest } from 'gambling-bot-shared/atm'
import { AtmRequestSchema } from 'gambling-bot-shared/mongoose'
import mongoose from 'mongoose'

export type { TAtmRequest } from 'gambling-bot-shared/atm'

export default (mongoose.models.AtmRequest as mongoose.Model<TAtmRequest>) ||
  mongoose.model<TAtmRequest>('AtmRequest', AtmRequestSchema)
