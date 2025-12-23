import { Client } from 'discord.js'

import { logger } from '@/utils/logger'

export default async (client: Client) => {
  const currentTime = new Date().toLocaleString('cs-CZ')

  logger.ready(`🕛 Time: ${currentTime}`)
  logger.ready(`🤖 ${client.user?.tag} is online`)
}
