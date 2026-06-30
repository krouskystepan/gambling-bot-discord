import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const runningWorkers = new Set<string>()

export const runWorkerLoop = async (
  name: string,
  intervalMs: number,
  job: () => Promise<void>
) => {
  if (runningWorkers.has(name)) {
    logger.error(
      { worker: name },
      'Worker already running - duplicate start prevented'
    )
    return
  }

  runningWorkers.add(name)
  logger.worker(`Worker started: ${name}`)

  while (true) {
    const start = Date.now()

    try {
      await job()
    } catch (err) {
      logger.error({ err, worker: name }, 'Worker run failed')
    }

    const duration = Date.now() - start
    const delay = Math.max(5_000, intervalMs - duration)

    await sleep(delay)
  }
}
