import { Schema, model, Document } from 'mongoose'

export type User = Document & {
  userId: string
  guildId: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<User>(
  {
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
    balance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

export default model<User>('User', UserSchema)
