import { type TAtmRequest } from 'gambling-bot-shared/atm'

import { TextChannel } from 'discord.js'

import { logger } from '@/utils/logger'

export type AtmLogMessageClient = {
  channels: {
    fetch: (id: string) => Promise<unknown>
  }
}

export const editAtmLogMessage = async ({
  client,
  request,
  content
}: {
  client: AtmLogMessageClient
  request: TAtmRequest
  content: string
}) => {
  if (!request.logChannelId || !request.logMessageId) return

  try {
    const logChannel = (await client.channels.fetch(
      request.logChannelId
    )) as TextChannel
    const logMessage = await logChannel.messages.fetch(request.logMessageId)
    await logMessage.edit({ content, components: [] })
  } catch (err) {
    logger.error(
      { err, requestId: request.requestId, handler: 'atmLogMessage' },
      'Failed to update ATM log message'
    )
  }
}
