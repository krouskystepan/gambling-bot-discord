import { logger } from '@/utils/logger'

export const registerProcessLogHandlers = (): void => {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason)
  })

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err)
    process.exit(1)
  })
}

registerProcessLogHandlers()
