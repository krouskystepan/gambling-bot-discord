import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import { refundLockedBet } from '@/services'
import {
  deletePlinkoGame,
  getAllOldPlinkoGames
} from '@/services/db/plinkoGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { renderPlinkoTimeoutEmbed } from '@/utils/casino/plinko'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const plinkoIdleCloseJob = async (client: Client<true>) => {
  const oldGames = await getAllOldPlinkoGames(1)

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
            renderPlinkoTimeoutEmbed({
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
          game: 'plinko'
        })
      }

      await deletePlinkoGame({
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
      logger.error(`Plinko idle close failed for game ${game.gameId}`, err)
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Plinko idle close',
      verb: 'closed',
      total: processed,
      unit: 'board(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Plinko idle close',
        title: `Auto-closed ${count} idle board(s)`,
        description:
          'Inactive Plinko boards were closed after 24 hours. Any mid-drop lock was refunded.',
        level: 'info'
      })
    }
  }
}
