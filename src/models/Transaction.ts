import { TransactionSchema } from 'gambling-bot-shared/mongoose'
import { TTransaction } from 'gambling-bot-shared/transactions'
import mongoose from 'mongoose'

export default (mongoose.models.Transaction as mongoose.Model<TTransaction>) ||
  mongoose.model<TTransaction>('Transaction', TransactionSchema)
