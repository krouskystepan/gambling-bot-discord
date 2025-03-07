import { Schema, model, Document } from 'mongoose'

export type User = Document & {
  userId: string
  guildId: string
  balance: number
}

const UserSchema = new Schema<User>({
  userId: {
    type: String,
    unique: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  balance: {
    type: Number,
    default: 0,
  },
})

export default model<User>('User', UserSchema)
