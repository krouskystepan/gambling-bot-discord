import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import {
  defaultGlobalSettings,
  normalizeGlobalSettings
} from 'gambling-bot-shared/guild'
import {
  defaultPaySettings,
  normalizePaySettings
} from 'gambling-bot-shared/pay'

import GuildConfiguration from '@/models/GuildConfiguration'

import { TGetGuildConfiguration } from './guildConfiguration.db.types'

export const getGuildConfigByGuildId = async ({
  guildId
}: TGetGuildConfiguration) => {
  const doc = await GuildConfiguration.findOne({ guildId })
  if (!doc) return null

  doc.globalSettings = normalizeGlobalSettings(doc.globalSettings)
  doc.paySettings = normalizePaySettings(doc.paySettings)
  return doc
}

export const createGuildConfiguration = async ({
  guildId
}: {
  guildId: string
}) => {
  const guildConfiguration = await GuildConfiguration.create({
    guildId,
    casinoSettings: defaultCasinoSettings,
    paySettings: defaultPaySettings,
    globalSettings: defaultGlobalSettings
  })

  return guildConfiguration
}

export const getAllGuildConfigIds = async (): Promise<string[]> => {
  return GuildConfiguration.distinct('guildId')
}
