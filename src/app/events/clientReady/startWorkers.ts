import { Client } from 'discord.js'

import {
  blackjackAutostandJob,
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

export default (client: Client) => {
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
    void runWorkerLoop('Blackjack auto-stand', ONE_HOUR, () =>
      blackjackAutostandJob(client)
    )
  }, THIRTY_SECONDS)

  setTimeout(() => {
    void runWorkerLoop('Prediction cleanup', ONE_DAY, predictionCleanupJob)
  }, ONE_MINUTE)
}
