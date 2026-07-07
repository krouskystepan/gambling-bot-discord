import { formatMoneyExact } from 'gambling-bot-shared/common'

import { Client } from 'commandkit'

import GuildConfiguration from '@/models/GuildConfiguration'
import { getGuildConfigByGuildId } from '@/services'
import { reconcileUserLockedBalance } from '@/services/casino/lockedBalanceReconciliation.service'
import { getUsersWithLockedBalance } from '@/services/db/user.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const USER_DELAY_MS = 150
const USER_BATCH_LIMIT = 500

type LockedBalanceReconciliationGuildConfig = {
  botLeftAt?: Date | null
}

export const lockedBalanceReconciliationJob = async (client: Client<true>) => {
  const users = await getUsersWithLockedBalance()
  const hitBatchLimit = users.length >= USER_BATCH_LIMIT

  if (hitBatchLimit) {
    logger.worker(
      `Locked balance reconciliation: hit user batch limit (${USER_BATCH_LIMIT})`
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
      const guildConfig = await getGuildConfigByGuildId({ guildId })
      const formattedRefund = guildConfig
        ? formatMoneyExact(stats.refunded, guildConfig.globalSettings)
        : String(stats.refunded)

      const description = [
        `Returned **${formattedRefund}** to **${stats.users}** player(s) from **${stats.betIds}** unfinished bet(s).`,
        hitBatchLimit
          ? 'More stuck balances may still remain — the worker hit its batch limit.'
          : null
      ]
        .filter(Boolean)
        .join('\n\n')

      await postWorkerLog(client, {
        guildId,
        worker: 'Stuck balances',
        title: `Fixed ${stats.users} player balance(s)`,
        description,
        level: hitBatchLimit ? 'warning' : 'info'
      })
    }
  }
}
