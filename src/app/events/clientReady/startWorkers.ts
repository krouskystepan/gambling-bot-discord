import { EventHandler } from 'commandkit'

import { logger } from '@/utils/logger'
import { runWorkerLoop, workerDefinitions } from '@/workers'

const handler: EventHandler<'clientReady'> = (client) => {
  logger.boot('Starting background workers')

  for (const worker of workerDefinitions) {
    setTimeout(() => {
      void runWorkerLoop(worker.name, worker.intervalMs, () =>
        worker.run(client)
      )
    }, worker.startDelayMs ?? 0)
  }

  logger.boot('Background worker scheduling complete')
}

export default handler
