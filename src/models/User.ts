import { TUser } from 'gambling-bot-shared'
import { UserSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export default (mongoose.models.User as mongoose.Model<TUser>) ||
  mongoose.model<TUser>('User', UserSchema)
