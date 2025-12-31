import { defaultCasinoSettings } from 'gambling-bot-shared'
import merge from 'lodash/merge'

import { Client } from 'discord.js'

import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services'
import { logger } from '@/utils/logger'

export default async (client: Client) => {
  for (const guild of client.guilds.cache.values()) {
    let dbSettings = await await getGuildConfigByGuildId({
      guildId: guild.id
    })

    if (!dbSettings) {
      await createGuildConfiguration({ guildId: guild.id })
      logger.worker(`🆕 Created settings => ${guild.name} (${guild.id})`)
      continue
    }

    const mergedSettings = merge(
      {},
      defaultCasinoSettings,
      dbSettings.casinoSettings
    )

    if (
      JSON.stringify(dbSettings.casinoSettings) !==
      JSON.stringify(mergedSettings)
    ) {
      dbSettings.casinoSettings = mergedSettings
      await dbSettings.save()
      logger.worker(`🔧 Updated settings => ${guild.name} (${guild.id})`)
    }
  }
}
