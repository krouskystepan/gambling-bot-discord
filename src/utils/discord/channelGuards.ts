import { NewsChannel, TextChannel, ThreadChannel } from 'discord.js'

export function isGuildSendableChannel(
  channel: unknown
): channel is TextChannel | NewsChannel | ThreadChannel {
  return (
    !!channel &&
    typeof channel === 'object' &&
    'send' in channel &&
    'guild' in channel
  )
}
