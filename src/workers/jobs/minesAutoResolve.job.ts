import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import {
  currentMinesMultiplier,
  docToMinesEngine,
  resolveIdleMines
} from 'gambling-bot-shared/mines'

import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteMinesGame,
  getAllOldMinesGames,
  getGuildConfigByGuildId,
  settleCasinoWinnings
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { formatMinesBoard, renderMinesEmbed } from '@/utils/casino/mines'
import { sleep } from '@/utils/common/utils'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const minesAutoResolveJob = async (client: Client<true>) => {
  const oldGames = await getAllOldMinesGames(1)

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
      const globalSettings = guildConfig?.globalSettings

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

      const engine = docToMinesEngine(game)
      const resolved = resolveIdleMines(engine)

      await settleCasinoWinnings({
        userId: game.userId,
        guildId: game.guildId,
        totalBet: game.betAmount,
        winnings: resolved.payout,
        betId: game.betId,
        game: 'mines'
      })

      if (
        guildConfig &&
        !resolved.forfeited &&
        shouldAnnounceByMultiplier(
          resolved.multiplier,
          guildConfig.casinoSettings.winAnnouncements.minesMinMultiplier
        )
      ) {
        tryAnnounceBigWin({
          guild,
          guildConfig,
          game: 'mines',
          lines: [
            formatBigWinLine({
              label: '💣 Mines',
              multiplier: resolved.multiplier.toFixed(2),
              payout: formatMoney(resolved.payout, globalSettings),
              bet: formatMoney(game.betAmount, globalSettings)
            })
          ],
          betId: game.betId,
          sourceChannelId: game.channelId
        })
      }

      if (message) {
        const content = resolved.forfeited
          ? 'This game was inactive with no reveals, so it was forfeited.'
          : 'This game was inactive, so auto cash-out was executed.'

        await message.edit({
          content,
          embeds: [
            renderMinesEmbed({
              betId: game.betId,
              betAmount: game.betAmount,
              mineCount: game.mineCount,
              revealedCount: engine.revealedIndices.length,
              multiplier: resolved.forfeited
                ? 0
                : resolved.multiplier || currentMinesMultiplier(engine),
              result: resolved.forfeited
                ? { kind: 'FORFEIT' }
                : {
                    kind: 'CASH_OUT',
                    multiplier: resolved.multiplier,
                    payout: resolved.payout
                  },
              board: formatMinesBoard(engine),
              showBalance: false,
              globalSettings
            })
          ],
          components: []
        })
      }

      await deleteMinesGame({
        userId: game.userId,
        guildId: game.guildId
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
      logger.error(`Mines auto-resolve failed for game ${game.betId}`, err)
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
      job: 'Mines auto-resolve',
      verb: 'processed',
      total: processed,
      unit: 'game(s)',
      guildCounts: guildGameCounts
    })

    for (const [guildId, stats] of guildProcessed) {
      const description = [
        'Mines games left inactive for 24h+ were finished automatically.',
        stats.channelMissed > 0
          ? `**${stats.channelMissed}** game message(s) could not be updated in Discord.`
          : null
      ]
        .filter(Boolean)
        .join('\n\n')

      await postWorkerLog(client, {
        guildId,
        worker: 'Mines auto-finish',
        title: `Finished ${stats.finished} idle game(s)`,
        description,
        level: stats.channelMissed > 0 ? 'warning' : 'info'
      })
    }
  }
}
