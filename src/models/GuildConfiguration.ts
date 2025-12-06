import {
  GuildConfigurationSchema,
  TGuildConfiguration,
} from '@krouskystepan/gambling-bot-shared'
import { model } from 'mongoose'

export default model<TGuildConfiguration>(
  'GuildConfiguration',
  GuildConfigurationSchema
)
