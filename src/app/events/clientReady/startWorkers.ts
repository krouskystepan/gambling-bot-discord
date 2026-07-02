import { EventHandler } from 'commandkit'

import { logger } from '@/utils/logger'
import {
  blackjackAutostandJob,
  blackjackIdleNudgeJob,
  guildOrphanCleanupJob,
  guildSettingsSyncJob,
  predictionAutolockJob,
  predictionCleanupJob,
  raffleDrawJob,
  runWorkerLoop,
  vipExpirationJob
} from '@/workers'

const THIRTY_SECONDS = 30 * 1000
const ONE_MINUTE = 60 * 1000

const ONE_HOUR = 60 * ONE_MINUTE
const SIX_HOURS = 6 * ONE_HOUR

const ONE_DAY = 24 * 60 * ONE_MINUTE

const handler: EventHandler<'clientReady'> = (client) => {
  logger.boot('Starting background workers')

  void runWorkerLoop('VIP expiration', ONE_MINUTE, () =>
    vipExpirationJob(client)
  )

  void runWorkerLoop('Prediction autolock', ONE_MINUTE, () =>
    predictionAutolockJob(client)
  )

  void runWorkerLoop('Raffle auto-draw', ONE_MINUTE, () =>
    raffleDrawJob(client)
  )

  void runWorkerLoop('Guild settings sync', SIX_HOURS, () =>
    guildSettingsSyncJob(client)
  )

  setTimeout(() => {
    void runWorkerLoop('Blackjack idle nudge', ONE_HOUR, () =>
      blackjackIdleNudgeJob(client)
    )
    void runWorkerLoop('Blackjack auto-stand', ONE_HOUR, () =>
      blackjackAutostandJob(client)
    )
  }, THIRTY_SECONDS)

  setTimeout(() => {
    void runWorkerLoop('Prediction cleanup', ONE_DAY, () =>
      predictionCleanupJob()
    )
    void runWorkerLoop('Guild orphan cleanup', ONE_DAY, () =>
      guildOrphanCleanupJob(client)
    )
  }, ONE_MINUTE)

  logger.boot('Background worker scheduling complete')
}

export default handler
