import { Schema, model } from 'mongoose'

export type TAtmRequest = {
  requestId: string
  guildId: string
  userId: string

  type: 'deposit' | 'withdraw'
  amount: number
  account: string

  status: 'pending' | 'approved' | 'rejected'
  handledBy?: string
  handledAt?: Date

  logChannelId: string
  logMessageId: string

  createdAt: Date
  updatedAt: Date
}

const AtmRequestSchema = new Schema<TAtmRequest>(
  {
    requestId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },

    type: { type: String, enum: ['deposit', 'withdraw'], required: true },
    amount: { type: Number, required: true, min: 1 },
    account: { type: String, required: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
      default: 'pending',
      index: true
    },
    handledBy: { type: String },
    handledAt: { type: Date },

    logChannelId: { type: String },
    logMessageId: { type: String }
  },
  { timestamps: true }
)

export default model<TAtmRequest>('AtmRequest', AtmRequestSchema)
