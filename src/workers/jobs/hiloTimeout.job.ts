import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import { getGuildConfigByGuildId, getTimedOutHiloGames } from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { settleHiloTimeout } from '@/utils/casino/hilo'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const hiloTimeoutJob = async (client: Client<true>) => {
  const games = await getTimedOutHiloGames()

  let processed = 0
  const guildProcessed = new Map<string, number>()

  for (const game of games) {
    try {
      const guild = await client.guilds.fetch(game.guildId).catch(() => null)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })

      const channel = guild
        ? await guild.channels.fetch(game.channelId).catch(() => null)
        : null

      const message =
        channel?.type === ChannelType.GuildText
          ? await channel.messages.fetch(game.messageId).catch(() => null)
          : null

      const settled = await settleHiloTimeout({
        game,
        guildConfig,
        guild,
        message
      })

      if (!settled) continue

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
      await sleep(250)
    } catch (err) {
      logger.error(`Hi-Lo timeout settle failed for game ${game.gameId}`, err)
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Hi-Lo timeout',
      verb: 'settled',
      total: processed,
      unit: 'round(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Hi-Lo timeout',
        title: `Timed out ${count} Hi-Lo round(s)`,
        description:
          'Idle streaks were auto cashed out; first decisions used the safest auto-guess.',
        level: 'info'
      })
    }
  }
}
