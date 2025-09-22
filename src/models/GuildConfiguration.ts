import { Schema, model, Document } from 'mongoose'
import defaultCasinoSettings from '../utils/defaultConfig'

export type RewardMode = 'linear' | 'exponential'

export type GuildConfigurationDoc = Document & {
  guildId: string
  atmChannelIds: {
    actions: string
    logs: string
  }
  casinoChannelIds: string[]
  predictionChannelIds: {
    actions: string
    logs: string
  }
  managerRoleId: string
  casinoSettings: typeof defaultCasinoSettings
  vipSettings: {
    roleId: string
    categoryId: string
    pricePerDay: number
    pricePerCreate: number
  }
  bonusSettings: {
    rewardMode: RewardMode
    baseReward: number
    streakIncrement?: number
    streakMultiplier?: number
    maxReward: number
    resetOnMax: boolean
    milestoneBonus: {
      weekly: number
      monthly: number
    }
  }
}

const guildConfigurationSchema = new Schema<GuildConfigurationDoc>({
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
  casinoChannelIds: {
    type: [String],
    default: [],
  },
  predictionChannelIds: {
    actions: {
      type: String,
      default: '',
    },
    logs: {
      type: String,
      default: '',
    },
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
  bonusSettings: {
    rewardMode: {
      type: String,
      enum: ['linear', 'exponential'],
      default: 'linear',
    },
    baseReward: { type: Number, default: 0 },
    streakIncrement: { type: Number, default: 0 },
    streakMultiplier: { type: Number, default: 0 },
    maxReward: { type: Number, default: 0 },
    resetOnMax: { type: Boolean, default: false },
    milestoneBonus: {
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
    },
  },
})

export default model<GuildConfigurationDoc>(
  'GuildConfiguration',
  guildConfigurationSchema
)
