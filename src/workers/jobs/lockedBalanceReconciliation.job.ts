import { Client } from 'commandkit'

import GuildConfiguration from '@/models/GuildConfiguration'
import { reconcileUserLockedBalance } from '@/services/casino/lockedBalanceReconciliation.service'
import { getUsersWithLockedBalance } from '@/services/db/user.db'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const USER_DELAY_MS = 150

type LockedBalanceReconciliationGuildConfig = {
  botLeftAt?: Date | null
}

export const lockedBalanceReconciliationJob = async (_client: Client<true>) => {
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
  }
}
