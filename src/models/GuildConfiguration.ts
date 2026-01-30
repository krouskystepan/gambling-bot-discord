import {
  GuildConfigurationSchema,
  TGuildConfiguration
} from 'gambling-bot-shared'
import mongoose from 'mongoose'

export default (mongoose.models
  .GuildConfiguration as mongoose.Model<TGuildConfiguration>) ||
  mongoose.model<TGuildConfiguration>(
    'GuildConfiguration',
    GuildConfigurationSchema
  )
