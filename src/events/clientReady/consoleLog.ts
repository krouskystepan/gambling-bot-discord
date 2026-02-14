import { Client } from 'discord.js'

import { logger } from '@/utils/logger'

export default async (client: Client) => {
  logger.ready(`🤖 ${client.user?.tag} is online`)
}
