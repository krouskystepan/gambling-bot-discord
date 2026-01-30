import { TTransaction, TransactionSchema } from 'gambling-bot-shared'
import mongoose from 'mongoose'

export default (mongoose.models.Transaction as mongoose.Model<TTransaction>) ||
  mongoose.model<TTransaction>('Transaction', TransactionSchema)
