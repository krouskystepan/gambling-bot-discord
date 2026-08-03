import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import { getGuildConfigByGuildId, refundLockedBet } from '@/services'
import {
  deleteBaccaratGame,
  getAllOldBaccaratGames
} from '@/services/db/baccaratGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { baccaratLockedTotal } from '@/utils/casino/baccarat/slip'
import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const baccaratIdleCloseJob = async (client: Client<true>) => {
  const oldGames = await getAllOldBaccaratGames(1)

  let processed = 0
  let refunded = 0
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
          embeds: [
            formatSessionSummaryEmbed({
              gameLabel: 'Baccarat',
              emoji: '🃏',
              stats: game.sessionStats,
              reason: 'timeout',
              gameId: game.gameId,
              globalSettings: guildConfig?.globalSettings
            })
          ],
          components: []
        })
      }

      // Only a round that never settled still holds a lock.
      const locked = baccaratLockedTotal({
        lockedAmount: game.lockedAmount,
        bets: game.bets
      })
      if (game.activeBetId && locked > 0) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: locked,
          betId: game.activeBetId,
          game: 'baccarat'
        })
        refunded++
      }

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
      logger.error(`Baccarat idle close failed for game ${game.gameId}`, err)
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Baccarat idle close',
      verb: 'closed',
      total: processed,
      unit: 'table(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Baccarat idle close',
        title: `Auto-closed ${count} idle table(s)`,
        description: [
          'Inactive baccarat tables were closed after 24 hours.',
          refunded > 0 ? 'Any bet still in flight was refunded.' : null
        ]
          .filter(Boolean)
          .join('\n\n'),
        level: 'info'
      })
    }
  }
}
