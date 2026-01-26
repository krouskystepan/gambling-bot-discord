import { Schema, model } from 'mongoose'

import { Card, GamePhase } from '@/utils/casino/blackjack'

export type TBlackjackHand = {
  cards: Card[]
  betAmount: number
  finished: boolean
  isSplitHand: boolean
}

export type TBlackjackGame = {
  userId: string
  guildId: string
  channelId: string
  messageId: string
  betId: string

  deck: Card[]
  deckIndex: number

  hands: TBlackjackHand[]
  activeHandIndex: number
  phase: GamePhase

  dealerCards: Card[]

  createdAt: Date
  updatedAt: Date
}

const cardSchema = {
  suite: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: Number, required: true }
}

const handSchema = new Schema<TBlackjackHand>(
  {
    cards: [cardSchema],
    betAmount: { type: Number, required: true },
    finished: { type: Boolean, required: true, default: false }
  },
  { _id: false }
)

const BlackjackGameSchema = new Schema<TBlackjackGame>(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    betId: { type: String, required: true, index: true },

    deck: [cardSchema],
    deckIndex: { type: Number, required: true, default: 0 },

    hands: { type: [handSchema], required: true, default: [] },
    phase: {
      type: String,
      enum: ['PLAYER', 'DEALER', 'FINISHED'],
      required: true,
      default: 'PLAYER'
    },
    activeHandIndex: { type: Number, required: true, default: 0 },

    dealerCards: [cardSchema]
  },
  { timestamps: true }
)

BlackjackGameSchema.index({ userId: 1, guildId: 1 }, { unique: true })

export default model<TBlackjackGame>('BlackjackGame', BlackjackGameSchema)
