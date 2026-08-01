import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteHiloGame,
  getGuildConfigByGuildId,
  getOldIdleHiloGames
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const hiloIdleCloseJob = async (client: Client<true>) => {
  const oldGames = await getOldIdleHiloGames()

  let processed = 0
  const guildProcessed = new Map<string, number>()

  for (const game of oldGames) {
    try {
      const guild = await client.guilds.fetch(game.guildId).catch(() => null)
      if (!guild) continue

      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })

      const channel = await guild.channels
        .fetch(game.channelId)
        .catch(() => null)

      const message =
        channel?.type === ChannelType.GuildText
          ? await channel.messages.fetch(game.messageId).catch(() => null)
          : null

      if (message) {
        await message.edit({
          content: null,
          embeds: [
            formatSessionSummaryEmbed({
              gameLabel: 'Hi-Lo',
              emoji: '🃏',
              stats: game.sessionStats,
              reason: 'timeout',
              gameId: game.gameId,
              globalSettings: guildConfig?.globalSettings,
              roundsLabel: 'Rounds'
            })
          ],
          components: []
        })
      }

      await deleteHiloGame({
        userId: game.userId,
        guildId: game.guildId
      })

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
      await sleep(500)
    } catch (err) {
      logger.error(`Hi-Lo idle close failed for game ${game.gameId}`, err)
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Hi-Lo idle close',
      verb: 'closed',
      total: processed,
      unit: 'table(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Hi-Lo idle close',
        title: `Auto-closed ${count} idle table(s)`,
        description:
          'Hi-Lo tables with no new round were closed after 24 hours.',
        level: 'info'
      })
    }
  }
}
