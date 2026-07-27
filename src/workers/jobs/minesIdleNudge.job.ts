import { hoursUntilMinesAutoResolve } from 'gambling-bot-shared/mines'

import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  getMinesGamesNeedingIdleNudge,
  markMinesIdleNudgeSent
} from '@/services/db/minesGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { createWarningEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const minesIdleNudgeJob = async (client: Client<true>) => {
  const games = await getMinesGamesNeedingIdleNudge()
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

      const hoursLeft = hoursUntilMinesAutoResolve(game.updatedAt)
      const gameMessageLink = `https://discord.com/channels/${game.guildId}/${game.channelId}/${game.messageId}`

      await channel.send({
        content: `<@${game.userId}>`,
        embeds: [
          createWarningEmbed(
            'Mines Game Idle',
            [
              `Still playing? If you stay inactive, this game will auto-resolve in about **${hoursLeft} hour(s)**.`,
              '',
              `[Jump to your game message](${gameMessageLink})`
            ].join('\n'),
            game.betId
          )
        ]
      })

      await markMinesIdleNudgeSent({
        userId: game.userId,
        guildId: game.guildId
      })

      sent++
      guildSent.set(game.guildId, (guildSent.get(game.guildId) ?? 0) + 1)
      await sleep(500)
    } catch (err) {
      logger.error(`Mines idle nudge failed for game ${game.betId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Mines idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Mines reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive mines games were pinged before auto-resolve.',
        level: 'info'
      })
    }
  }
}
