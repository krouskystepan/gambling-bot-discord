import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  getAllOldBlackjackGames,
  getGuildConfigByGuildId,
  updateBlackjackGame
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  applyAction,
  docToEngine,
  engineToDoc,
  finishBlackjackDealerAndSettle
} from '@/utils/casino/blackjack'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const blackjackAutostandJob = async (client: Client<true>) => {
  const oldGames = await getAllOldBlackjackGames(1) // older than 1 day

  let processed = 0
  const guildProcessed = new Map<
    string,
    { finished: number; channelMissed: number }
  >()

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
        await message.edit({ components: [] })
      }

      const engine = docToEngine(game)
      applyAction(engine, 'STAND')

      const nextHandIndex = engine.hands.findIndex(
        (h, i) => i > engine.activeHandIndex && !h.finished
      )

      if (nextHandIndex !== -1) {
        engine.activeHandIndex = nextHandIndex
        engineToDoc(engine, game)
        await updateBlackjackGame(game)
        continue
      }

      engine.activeHandIndex = engine.hands.length - 1
      await finishBlackjackDealerAndSettle({
        game,
        engine,
        guildConfig,
        guild,
        sourceChannelId: game.channelId,
        showBalance: false,
        message,
        finalMessageContent:
          'This game was inactive, so auto-stand was executed.'
      })

      processed++
      const stats = guildProcessed.get(game.guildId) ?? {
        finished: 0,
        channelMissed: 0
      }
      stats.finished++
      if (!message) stats.channelMissed++
      guildProcessed.set(game.guildId, stats)

      await sleep(300)
    } catch (err) {
      logger.error(`Auto-stand failed for game ${game.betId}`, err)
    }
  }

  if (processed > 0) {
    const guildGameCounts = new Map(
      [...guildProcessed.entries()].map(([guildId, stats]) => [
        guildId,
        stats.finished
      ])
    )
    logMultiGuildCountSummary({
      client,
      job: 'Blackjack auto-stand',
      verb: 'processed',
      total: processed,
      unit: 'game(s)',
      guildCounts: guildGameCounts
    })

    for (const [guildId, stats] of guildProcessed) {
      const description = [
        'Blackjack games left inactive for 24h+ were finished automatically.',
        stats.channelMissed > 0
          ? `**${stats.channelMissed}** game message(s) could not be updated in Discord.`
          : null
      ]
        .filter(Boolean)
        .join('\n\n')

      await postWorkerLog(client, {
        guildId,
        worker: 'Blackjack auto-finish',
        title: `Finished ${stats.finished} idle game(s)`,
        description,
        level: stats.channelMissed > 0 ? 'warning' : 'info'
      })
    }
  }
}
