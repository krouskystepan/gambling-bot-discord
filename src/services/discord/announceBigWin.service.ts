import { TGuildConfiguration } from 'gambling-bot-shared'

import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import { createBetEmbed } from '@/utils/discord/createEmbed'
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
  userId: string
  title: string
  description: string
  betId?: string
  sourceChannelId?: string
}

export const announceBigWin = async ({
  guild,
  guildConfig,
  userId,
  title,
  description,
  betId,
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

  const embed = createBetEmbed(title, 'Gold', description, betId)

  channel.send({ content: `<@${userId}>`, embeds: [embed] }).catch((err) => {
    logger.error(
      { err, guildId: guild.id, channelId },
      'Failed to send big win announcement'
    )
  })
}
