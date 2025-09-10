import { Schema, model, Document } from 'mongoose'

export type UserDoc = Document & {
  userId: string
  guildId: string
  balance: number
  amountGambled: number
  milestoneUnlocked: number
  milestoneProgress: number
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<UserDoc>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    balance: { type: Number, default: 0 },
    amountGambled: { type: Number, default: 0 },
    milestoneUnlocked: { type: Number, default: 0 },
    milestoneProgress: { type: Number, default: 0 },
  },
  { timestamps: true }
)

UserSchema.index({ userId: 1, guildId: 1 }, { unique: true })

export default model<UserDoc>('User', UserSchema)
