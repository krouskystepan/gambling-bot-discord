import { TTransaction, TransactionSchema } from 'gambling-bot-shared'
import { model } from 'mongoose'

export default model<TTransaction>('Transaction', TransactionSchema)
