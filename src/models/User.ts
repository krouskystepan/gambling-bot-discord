import { TUser, UserSchema } from 'gambling-bot-shared'
import mongoose from 'mongoose'

export default (mongoose.models.User as mongoose.Model<TUser>) ||
  mongoose.model<TUser>('User', UserSchema)
