import {
  GuildConfigurationSchema,
  TGuildConfiguration,
} from 'gambling-bot-shared'
import { model } from 'mongoose'

export default model<TGuildConfiguration>(
  'GuildConfiguration',
  GuildConfigurationSchema
)
