import { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { GuildConfigurationSchema } from 'gambling-bot-shared/mongoose'
import mongoose from 'mongoose'

export default (mongoose.models
  .GuildConfiguration as mongoose.Model<TGuildConfiguration>) ||
  mongoose.model<TGuildConfiguration>(
    'GuildConfiguration',
    GuildConfigurationSchema
  )
