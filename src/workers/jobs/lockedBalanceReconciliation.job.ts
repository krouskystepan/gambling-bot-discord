import { Client } from 'commandkit'

import GuildConfiguration from '@/models/GuildConfiguration'
import { reconcileUserLockedBalance } from '@/services/casino/lockedBalanceReconciliation.service'
import { getUsersWithLockedBalance } from '@/services/db/user.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const USER_DELAY_MS = 150

type LockedBalanceReconciliationGuildConfig = {
  botLeftAt?: Date | null
}

export const lockedBalanceReconciliationJob = async (client: Client<true>) => {
  const users = await getUsersWithLockedBalance()
  const limit = 500

  if (users.length >= limit) {
    logger.worker(
      `Locked balance reconciliation: hit user batch limit (${limit})`
    )
  }

  let usersReconciled = 0
  let totalRefunded = 0
  let totalBetIds = 0
  const guildStats = new Map<
    string,
    { users: number; refunded: number; betIds: number }
  >()

  for (const user of users) {
    try {
      const config = await GuildConfiguration.findOne({ guildId: user.guildId })
        .select('botLeftAt')
        .lean<LockedBalanceReconciliationGuildConfig>()

      if (config?.botLeftAt) continue

      const result = await reconcileUserLockedBalance({
        userId: user.userId,
        guildId: user.guildId
      })

      if (!result) continue

      usersReconciled++
      totalRefunded += result.refunded + result.released
      totalBetIds += result.orphanBetIds.length

      const stats = guildStats.get(user.guildId) ?? {
        users: 0,
        refunded: 0,
        betIds: 0
      }
      stats.users++
      stats.refunded += result.refunded + result.released
      stats.betIds += result.orphanBetIds.length
      guildStats.set(user.guildId, stats)

      await sleep(USER_DELAY_MS)
    } catch (error) {
      logger.error(
        {
          err: error,
          userId: user.userId,
          guildId: user.guildId
        },
        'Locked balance reconciliation failed for user'
      )
    }
  }

  if (usersReconciled > 0 || totalRefunded > 0) {
    logger.worker(
      `Locked balance reconciliation: ${usersReconciled} user(s), refunded ${totalRefunded} total across ${totalBetIds} betId(s)`
    )

    for (const [guildId, stats] of guildStats) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Locked balance reconciliation',
        title: `Reconciled ${stats.users} user(s)`,
        description: `Refunded **${stats.refunded}** total across **${stats.betIds}** bet ID(s).`,
        level: 'warning'
      })
    }
  }
}
