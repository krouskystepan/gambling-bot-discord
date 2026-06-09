import { TBlackjackGame } from 'gambling-bot-shared'
import { BlackjackGameSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export type { TBlackjackHand, TBlackjackGame } from 'gambling-bot-shared'

export default (mongoose.models
  .BlackjackGame as mongoose.Model<TBlackjackGame>) ||
  mongoose.model<TBlackjackGame>('BlackjackGame', BlackjackGameSchema)
