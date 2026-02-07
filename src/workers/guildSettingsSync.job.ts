import { defaultCasinoSettings } from 'gambling-bot-shared'
import merge from 'lodash/merge'

import { Client } from 'discord.js'

import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services'
import { logger } from '@/utils/logger'

export const guildSettingsSyncJob = async (client: Client) => {
  for (const guild of client.guilds.cache.values()) {
    try {
      let dbSettings = await getGuildConfigByGuildId({ guildId: guild.id })

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
    } catch (err) {
      logger.error(`Guild settings sync failed for guild ${guild.id}`, err)
    }
  }
}
