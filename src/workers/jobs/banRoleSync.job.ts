import { Client } from 'commandkit'

import GuildConfiguration from '@/models/GuildConfiguration'
import { syncGuildBannedRoles } from '@/services/moderation'
import { logger } from '@/utils/logger'

type BanRoleSyncGuildConfig = {
  bannedRoleId?: string
  botLeftAt?: Date | null
}

export const banRoleSyncJob = async (client: Client<true>) => {
  let guildsProcessed = 0
  let totalAdded = 0
  let totalRemoved = 0

  for (const guild of client.guilds.cache.values()) {
    const config = await GuildConfiguration.findOne({ guildId: guild.id })
      .select('bannedRoleId botLeftAt')
      .lean<BanRoleSyncGuildConfig>()

    if (!config?.bannedRoleId || config.botLeftAt) continue

    const result = await syncGuildBannedRoles({
      guild,
      bannedRoleId: config.bannedRoleId
    })

    guildsProcessed++
    totalAdded += result.added
    totalRemoved += result.removed
  }

  if (totalAdded > 0 || totalRemoved > 0) {
    logger.worker(
      `Ban role sync: +${totalAdded} -${totalRemoved} across ${guildsProcessed} guild(s)`
    )
  }
}
