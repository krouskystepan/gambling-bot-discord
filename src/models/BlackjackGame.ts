import { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import { BlackjackGameSchema } from 'gambling-bot-shared/mongoose'
import mongoose from 'mongoose'

export type {
  TBlackjackHand,
  TBlackjackGame
} from 'gambling-bot-shared/blackjack'

export default (mongoose.models
  .BlackjackGame as mongoose.Model<TBlackjackGame>) ||
  mongoose.model<TBlackjackGame>('BlackjackGame', BlackjackGameSchema)
