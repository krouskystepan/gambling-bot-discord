import { UserBanSchema } from 'gambling-bot-shared/mongoose'
import { TUserBan } from 'gambling-bot-shared/user'
import mongoose from 'mongoose'

export default (mongoose.models.UserBan as mongoose.Model<TUserBan>) ||
  mongoose.model<TUserBan>('UserBan', UserBanSchema)
