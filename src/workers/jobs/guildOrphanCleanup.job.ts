import { DiscordAPIError } from 'discord.js'

import { Client } from 'commandkit'

import { getAllGuildConfigIds } from '@/services/guild/guildConfiguration.db'
import { runGuildOrphanCleanup } from '@/services/guild/guildOrphanCleanup.service'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export const isUnknownGuildError = (error: unknown): boolean =>
  error instanceof DiscordAPIError &&
  (error.rawError as { code?: number }).code === 10004

export const checkGuildOrphaned = async (
  client: Client<true>,
  guildId: string
): Promise<'member' | 'orphan' | 'retry'> => {
  if (client.guilds.cache.has(guildId)) return 'member'

  try {
    await client.guilds.fetch(guildId)
    return 'member'
  } catch (error) {
    if (isUnknownGuildError(error)) return 'orphan'
    return 'retry'
  }
}

export const guildOrphanCleanupJob = async (client: Client<true>) => {
  const guildIds = await getAllGuildConfigIds()
  let processed = 0

  for (const guildId of guildIds) {
    try {
      const status = await checkGuildOrphaned(client, guildId)

      if (status === 'member') continue
      if (status === 'retry') {
        logger.error(
          `Guild orphan check skipped for ${guildId} due to Discord API error`
        )
        continue
      }

      const summary = await runGuildOrphanCleanup({ guildId })

      processed++
      logger.worker(
        `Guild orphan cleanup: ${guildId} — predictions=${summary.predictions}, raffles=${summary.raffles}, blackjack=${summary.blackjack}, vip=${summary.vipRooms}, atm=${summary.atmRejected}, errors=${summary.errors.length}`
      )

      await postWorkerLog(client, {
        guildId,
        worker: 'Guild cleanup',
        title: 'Cleaned up old data',
        description: [
          `Predictions: **${summary.predictions}**`,
          `Raffles: **${summary.raffles}**`,
          `Blackjack: **${summary.blackjack}**`,
          `VIP rooms: **${summary.vipRooms}**`,
          `ATM requests: **${summary.atmRejected}**`,
          summary.errors.length > 0
            ? `Some items could not be cleaned: **${summary.errors.length}**`
            : null
        ]
          .filter(Boolean)
          .join('\n'),
        level: summary.errors.length > 0 ? 'warning' : 'info'
      })

      await sleep(500)
    } catch (error) {
      logger.error(`Guild orphan cleanup failed for guild ${guildId}`, error)
    }
  }

  if (processed > 0) {
    logger.worker(`Guild orphan cleanup: processed ${processed} guild(s)`)
  }
}
