import {
  TTransaction,
  TransactionSchema,
} from '@krouskystepan/gambling-bot-shared'
import { model } from 'mongoose'

export default model<TTransaction>('Transaction', TransactionSchema)
