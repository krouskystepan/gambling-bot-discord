import { TTransaction } from 'gambling-bot-shared'
import { TransactionSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export default (mongoose.models.Transaction as mongoose.Model<TTransaction>) ||
  mongoose.model<TTransaction>('Transaction', TransactionSchema)
