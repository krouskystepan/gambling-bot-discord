import { defaultCasinoSettings } from 'gambling-bot-shared'

import GuildConfiguration from '@/models/GuildConfiguration'
import { TGetGuildcongifuration } from '@/types/types'

export const getGuildConfigByGuildId = async ({
  guildId
}: TGetGuildcongifuration) => {
  return GuildConfiguration.findOne({ guildId })
}

export const createGuildConfiguration = async ({
  guildId
}: {
  guildId: string
}) => {
  const guildConfiguration = await GuildConfiguration.create({
    guildId,
    casinoSettings: defaultCasinoSettings
  })

  return guildConfiguration
}
