import { Client } from 'discord.js'

import { blackjackAutostandJob } from '@/workers/blackjackAutostand.job'
import { guildSettingsSyncJob } from '@/workers/guildSettingsSync.job'
import { autolockPredictions } from '@/workers/predictionAutolock.job'
import { cleanupOldPredictions } from '@/workers/predictionCleanup.job'
import { raffleDrawJob } from '@/workers/raffleDraw.job'
import { vipExpirationJob } from '@/workers/vipExpiration.job'
import { runWorkerLoop } from '@/workers/workerLoop.util'

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
    autolockPredictions(client)
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
    void runWorkerLoop('Prediction cleanup', ONE_DAY, cleanupOldPredictions)
  }, ONE_MINUTE)
}
