import type { EventHandler } from 'commandkit'

import { logger } from '@/utils/logger'

const handler: EventHandler<'clientReady'> = (client) => {
  logger.ready(`🤖 ${client.user?.tag} is online`)
}

export default handler
