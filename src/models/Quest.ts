import { QuestSchema } from 'gambling-bot-shared/mongoose'
import { TQuest } from 'gambling-bot-shared/quests'
import mongoose from 'mongoose'

export default (mongoose.models.Quest as mongoose.Model<TQuest>) ||
  mongoose.model<TQuest>('Quest', QuestSchema)
