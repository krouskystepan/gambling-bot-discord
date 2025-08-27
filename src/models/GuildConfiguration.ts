import { Schema, model, Document } from 'mongoose'
import defaultCasinoSettings from '../utils/defaultConfig'

export type GuildConfiguration = Document & {
  guildId: string
  atmChannelIds: {
    actions: string
    logs: string
  }
  adminChannelIds: string[]
  casinoChannelIds: string[]
  predictionChannelIds: string[]
  managerRoleId: string
  casinoSettings: typeof defaultCasinoSettings
  vipSettings: {
    roleId: string
    categoryId: string
    pricePerDay: number
    pricePerCreate: number
  }
}

const guildConfigurationSchema = new Schema<GuildConfiguration>({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  atmChannelIds: {
    actions: {
      type: String,
      default: '',
    },
    logs: {
      type: String,
      default: '',
    },
  },
  adminChannelIds: {
    type: [String],
    default: [],
  },
  casinoChannelIds: {
    type: [String],
    default: [],
  },
  predictionChannelIds: {
    type: [String],
    default: [],
  },
  managerRoleId: {
    type: String,
    default: '',
  },
  casinoSettings: {
    type: Schema.Types.Mixed,
    default: defaultCasinoSettings,
  },
  vipSettings: {
    roleId: {
      type: String,
      default: '',
    },
    categoryId: {
      type: String,
      default: '',
    },
    pricePerDay: {
      type: Number,
      default: 0,
    },
    pricePerCreate: {
      type: Number,
      default: 0,
    },
  },
})

export default model<GuildConfiguration>(
  'GuildConfiguration',
  guildConfigurationSchema
)
