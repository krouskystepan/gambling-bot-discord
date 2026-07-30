import { UserQuestProgressSchema } from 'gambling-bot-shared/mongoose'
import { TUserQuestProgress } from 'gambling-bot-shared/quests'
import mongoose from 'mongoose'

export default (mongoose.models
  .UserQuestProgress as mongoose.Model<TUserQuestProgress>) ||
  mongoose.model<TUserQuestProgress>(
    'UserQuestProgress',
    UserQuestProgressSchema
  )
