import { Client } from 'discord.js'
import { merge } from 'lodash'
import GuildConfiguration from '../../models/GuildConfiguration'
import { defaultCasinoSettings } from '@krouskystepan/gambling-bot-shared'

export default async (client: Client) => {
  for (const guild of client.guilds.cache.values()) {
    let dbSettings = await GuildConfiguration.findOne({ guildId: guild.id })

    if (!dbSettings) {
      await GuildConfiguration.create({
        guildId: guild.id,
        casinoSettings: defaultCasinoSettings,
      })
      console.log(`🆕 Created settings => ${guild.name} (${guild.id})`)
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
      console.log(`🔧 Updated settings => ${guild.name} (${guild.id})`)
    }
  }
}
