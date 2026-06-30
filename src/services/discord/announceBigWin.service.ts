import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import { logger } from '@/utils/logger'

type AnnounceGuild = {
  id: string
  channels: {
    fetch: (channelId: string) => Promise<unknown>
  }
}

type BigWinAnnouncement = {
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  message: string
  sourceChannelId?: string
}

export const announceBigWin = async ({
  guild,
  guildConfig,
  message,
  sourceChannelId
}: BigWinAnnouncement) => {
  const channelId = guildConfig.winAnnouncementsChannelId
  if (!channelId) return
  if (sourceChannelId && sourceChannelId === channelId) return

  const channel = await guild.channels.fetch(channelId).catch(() => null)
  if (!isGuildSendableChannel(channel)) {
    logger.error(
      { channelId, guildId: guild.id },
      'Win announcements channel not sendable'
    )
    return
  }

  channel.send({ content: message }).catch((err) => {
    logger.error(
      { err, guildId: guild.id, channelId },
      'Failed to send big win announcement'
    )
  })
}
