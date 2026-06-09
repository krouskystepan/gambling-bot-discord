import { TGuildConfiguration } from 'gambling-bot-shared'

import { announceBigWin } from '@/services/discord/announceBigWin.service'

type AnnounceGuild = {
  id: string
  channels: {
    fetch: (channelId: string) => Promise<unknown>
  }
}

export const tryAnnounceBigWin = ({
  guild,
  guildConfig,
  userId,
  title,
  lines,
  intro,
  betId,
  sourceChannelId
}: {
  guild: AnnounceGuild | null | undefined
  guildConfig: TGuildConfiguration
  userId: string
  title: string
  lines: string[]
  intro?: string
  betId?: string
  sourceChannelId?: string
}) => {
  if (lines.length === 0 || !guild) return

  const description = intro ? `${intro}\n${lines.join('\n')}` : lines.join('\n')

  void announceBigWin({
    guild,
    guildConfig,
    userId,
    title,
    description,
    betId,
    sourceChannelId
  })
}
