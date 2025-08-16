import { Schema, model } from 'mongoose'
import { Card } from '../utils/blackjackUtils'

export interface BlackjackGame {
  gameId: string
  userId: string
  guildId: string
  betAmount: number
  deck: Card[]
  playerCards: Card[]
  dealerCards: Card[]
}

const BlackjackGameSchema = new Schema<BlackjackGame>({
  gameId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  betAmount: {
    type: Number,
    required: true,
  },
  deck: [
    {
      suite: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
  playerCards: [
    {
      suite: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
  dealerCards: [
    {
      suite: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
})

BlackjackGameSchema.index({ userId: 1, guildId: 1 }, { unique: true })

export default model<BlackjackGame>('BlackjackGame', BlackjackGameSchema)
