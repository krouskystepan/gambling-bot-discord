import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { announceBigWin } from '@/services/discord/announceBigWin.service'
import {
  type BigWinGame,
  formatBigWinMessage
} from '@/utils/discord/formatBigWinMessage'

type AnnounceGuild = {
  id: string
  channels: {
    fetch: (channelId: string) => Promise<unknown>
  }
}

export const tryAnnounceBigWin = ({
  guild,
  guildConfig,
  game,
  lines,
  betId,
  sourceChannelId
}: {
  guild: AnnounceGuild | null | undefined
  guildConfig: TGuildConfiguration
  game: BigWinGame
  lines: string[]
  betId?: string
  sourceChannelId?: string
}) => {
  if (lines.length === 0 || !guild) return

  void announceBigWin({
    guild,
    guildConfig,
    message: formatBigWinMessage({ game, lines, betId }),
    sourceChannelId
  })
}
