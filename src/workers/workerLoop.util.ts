import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const runningWorkers = new Set<string>()

export const runWorkerLoop = async (
  name: string,
  intervalMs: number,
  job: () => Promise<void>
) => {
  if (runningWorkers.has(name)) {
    logger.error(`[WORKER] ${name} already running — duplicate start prevented`)
    return
  }

  runningWorkers.add(name)
  logger.worker(`⌛ ${name} worker started`)

  while (true) {
    const start = Date.now()

    try {
      await job()
    } catch (err) {
      logger.error(`[${name}] Worker run failed`, err)
    }

    const duration = Date.now() - start
    const delay = Math.max(5_000, intervalMs - duration)

    await sleep(delay)
  }
}
