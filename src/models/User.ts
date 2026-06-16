import { UserSchema } from 'gambling-bot-shared/mongoose'
import { TUser } from 'gambling-bot-shared/user'
import mongoose from 'mongoose'

export default (mongoose.models.User as mongoose.Model<TUser>) ||
  mongoose.model<TUser>('User', UserSchema)
