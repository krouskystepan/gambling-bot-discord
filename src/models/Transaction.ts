import { Schema, model, Document, Types } from 'mongoose'

export type TransactionDoc = Document & {
  userId: string
  guildId: string
  amount: number
  type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'refund' | 'bonus' | 'vip'
  source: 'command' | 'manual' | 'web' | 'system' | 'casino'
  meta?: Record<string, any>
  betId?: string
  handledBy?: string
  createdAt: Date
}

const TransactionSchema = new Schema<TransactionDoc>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      required: true,
      enum: ['deposit', 'withdraw', 'bet', 'win', 'refund', 'bonus', 'vip'],
    },
    source: {
      type: String,
      required: true,
      enum: ['command', 'manual', 'web', 'system', 'casino'],
    },
    meta: { type: Schema.Types.Mixed, default: {} },
    betId: { type: String, default: null },
    handledBy: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

TransactionSchema.index({
  guildId: 1,
  userId: 1,
  createdAt: -1,
  betId: 1,
  type: 1,
  source: 1,
  handledBy: 1,
})

export default model<TransactionDoc>('Transaction', TransactionSchema)
