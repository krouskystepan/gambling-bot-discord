import { hoursUntilBlackjackAutostand } from 'gambling-bot-shared/blackjack'

import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  getBlackjackGamesNeedingIdleNudge,
  markBlackjackIdleNudgeSent
} from '@/services/db/blackjackGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { createWarningEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const blackjackIdleNudgeJob = async (client: Client<true>) => {
  const games = await getBlackjackGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const guild = await client.guilds.fetch(game.guildId).catch(() => null)
      if (!guild) continue

      const channel = await guild.channels
        .fetch(game.channelId)
        .catch(() => null)
      if (!channel || channel.type !== ChannelType.GuildText) continue

      const hoursLeft = hoursUntilBlackjackAutostand(game.updatedAt)
      const gameMessageLink = `https://discord.com/channels/${game.guildId}/${game.channelId}/${game.messageId}`

      await channel.send({
        content: `<@${game.userId}>`,
        embeds: [
          createWarningEmbed(
            'Blackjack Game Idle',
            [
              `Still playing? If you stay inactive, this game will auto-stand in about **${hoursLeft} hour(s)**.`,
              '',
              `[Jump to your game message](${gameMessageLink})`
            ].join('\n'),
            game.betId
          )
        ]
      })

      await markBlackjackIdleNudgeSent({
        userId: game.userId,
        guildId: game.guildId
      })

      sent++
      guildSent.set(game.guildId, (guildSent.get(game.guildId) ?? 0) + 1)
      await sleep(500)
    } catch (err) {
      logger.error(`Blackjack idle nudge failed for game ${game.betId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Blackjack idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Blackjack reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive blackjack games were pinged before auto-stand.',
        level: 'info'
      })
    }
  }
}
