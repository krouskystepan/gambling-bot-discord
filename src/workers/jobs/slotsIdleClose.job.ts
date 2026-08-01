import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import { refundLockedBet } from '@/services'
import {
  deleteSlotsGame,
  getAllOldSlotsGames
} from '@/services/db/slotsGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { renderSlotsTimeoutEmbed } from '@/utils/casino/slots'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const slotsIdleCloseJob = async (client: Client<true>) => {
  const oldGames = await getAllOldSlotsGames(1)

  let processed = 0
  const guildProcessed = new Map<string, number>()

  for (const game of oldGames) {
    try {
      const guild = await client.guilds.fetch(game.guildId).catch(() => null)
      if (!guild) continue

      const channel = await guild.channels
        .fetch(game.channelId)
        .catch(() => null)

      const message =
        channel?.type === ChannelType.GuildText
          ? await channel.messages.fetch(game.messageId).catch(() => null)
          : null

      if (message) {
        await message.edit({
          embeds: [
            renderSlotsTimeoutEmbed({
              autoClosed: true,
              stats: game.sessionStats,
              gameId: game.gameId
            })
          ],
          components: []
        })
      }

      if (game.activeBetId && game.lockedAmount && game.lockedAmount > 0) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.lockedAmount,
          betId: game.activeBetId,
          game: 'slots'
        })
      }

      await deleteSlotsGame({
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
      logger.error(`Slots idle close failed for game ${game.gameId}`, err)
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Slots idle close',
      verb: 'closed',
      total: processed,
      unit: 'machine(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Slots idle close',
        title: `Auto-closed ${count} idle machine(s)`,
        description:
          'Inactive slots machines were closed after 24 hours. Any mid-spin lock was refunded.',
        level: 'info'
      })
    }
  }
}
