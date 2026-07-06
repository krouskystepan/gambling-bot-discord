import { Client } from 'commandkit'

import GuildConfiguration from '@/models/GuildConfiguration'
import { syncGuildBannedRoles } from '@/services/moderation'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { logger } from '@/utils/logger'

type BanRoleSyncGuildConfig = {
  bannedRoleId?: string
  botLeftAt?: Date | null
}

export const banRoleSyncJob = async (client: Client<true>) => {
  for (const guild of client.guilds.cache.values()) {
    const config = await GuildConfiguration.findOne({ guildId: guild.id })
      .select('bannedRoleId botLeftAt')
      .lean<BanRoleSyncGuildConfig>()

    if (!config?.bannedRoleId || config.botLeftAt) continue

    const result = await syncGuildBannedRoles({
      guild,
      bannedRoleId: config.bannedRoleId
    })

    if (result.added > 0 || result.removed > 0) {
      logger.worker(
        `Ban role sync: +${result.added} -${result.removed} in ${guild.name} (${guild.id})`
      )
      await postWorkerLog(client, {
        guildId: guild.id,
        worker: 'Ban role sync',
        title: 'Banned roles updated',
        description: `Added **${result.added}** and removed **${result.removed}** banned role assignment(s).`
      })
    }
  }
}
