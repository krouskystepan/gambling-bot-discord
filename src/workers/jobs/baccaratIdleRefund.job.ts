import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import { refundLockedBet } from '@/services'
import {
  deleteBaccaratGame,
  getAllOldBaccaratGames
} from '@/services/db/baccaratGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { renderBaccaratTimeoutEmbed } from '@/utils/casino/baccarat/render'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const baccaratIdleRefundJob = async (client: Client<true>) => {
  const oldGames = await getAllOldBaccaratGames(1) // older than 1 day

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
            renderBaccaratTimeoutEmbed({
              betId: game.betId,
              autoRefund: true
            })
          ],
          components: []
        })
      }

      await refundLockedBet({
        userId: game.userId,
        guildId: game.guildId,
        amount: game.betAmount,
        betId: game.betId,
        game: 'baccarat'
      })

      await deleteBaccaratGame({
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
      logger.error(`Baccarat idle refund failed for game ${game.betId}`, err)
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Baccarat idle refund',
      verb: 'refunded',
      total: processed,
      unit: 'game(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Baccarat idle refund',
        title: `Auto-refunded ${count} idle game(s)`,
        description:
          'Inactive baccarat side-picks were refunded and cleared after 24 hours.',
        level: 'info'
      })
    }
  }
}
