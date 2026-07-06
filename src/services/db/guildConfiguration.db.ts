import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import {
  defaultGlobalSettings,
  normalizeGlobalSettings
} from 'gambling-bot-shared/guild'

import GuildConfiguration from '@/models/GuildConfiguration'
import { TGetGuildcongifuration } from '@/types/types'

export const getGuildConfigByGuildId = async ({
  guildId
}: TGetGuildcongifuration) => {
  const doc = await GuildConfiguration.findOne({ guildId })
  if (!doc) return null

  doc.globalSettings = normalizeGlobalSettings(doc.globalSettings)
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
    globalSettings: defaultGlobalSettings
  })

  return guildConfiguration
}

export const getAllGuildConfigIds = async (): Promise<string[]> => {
  return GuildConfiguration.distinct('guildId')
}
