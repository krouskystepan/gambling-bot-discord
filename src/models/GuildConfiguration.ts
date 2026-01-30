import { TGuildConfiguration } from 'gambling-bot-shared'
import { GuildConfigurationSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export default (mongoose.models
  .GuildConfiguration as mongoose.Model<TGuildConfiguration>) ||
  mongoose.model<TGuildConfiguration>(
    'GuildConfiguration',
    GuildConfigurationSchema
  )
