import { TAtmRequest } from 'gambling-bot-shared'
import { AtmRequestSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export type { TAtmRequest } from 'gambling-bot-shared'

export default (mongoose.models.AtmRequest as mongoose.Model<TAtmRequest>) ||
  mongoose.model<TAtmRequest>('AtmRequest', AtmRequestSchema)
