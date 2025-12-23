import { Schema, model } from 'mongoose'

import { Card } from '@/utils/casino/blackjack/deck'

export type TBlackjackGame = {
  userId: string
  guildId: string
  channelId: string
  messageId: string
  betId: string
  betAmount: number
  deck: Card[]
  deckIndex: number
  playerCards: Card[]
  dealerCards: Card[]
  createdAt: Date
}

const cardSchema = {
  suite: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: Number, required: true }
}

const BlackjackGameSchema = new Schema<TBlackjackGame>(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    betId: { type: String, required: true, index: true },
    betAmount: { type: Number, required: true },
    deck: [cardSchema],
    deckIndex: { type: Number, required: true, default: 0 },
    playerCards: [cardSchema],
    dealerCards: [cardSchema]
  },
  { timestamps: true }
)

BlackjackGameSchema.index({ userId: 1, guildId: 1 }, { unique: true })

export default model<TBlackjackGame>('BlackjackGame', BlackjackGameSchema)
