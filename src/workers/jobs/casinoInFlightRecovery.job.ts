import { CASINO_IN_FLIGHT_GRACE_MS } from 'gambling-bot-shared/casino'

import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteBaccaratGame,
  deleteRouletteGame,
  getGuildConfigByGuildId,
  getStaleDealerBlackjackGames,
  getStaleDealingBaccaratGames,
  getStaleSpinningRouletteGames,
  refundLockedBet,
  updateRouletteGame
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { recoverBaccaratDeal } from '@/utils/casino/baccarat/playRound'
import { renderBaccaratTimeoutEmbed } from '@/utils/casino/baccarat/render'
import {
  docToEngine,
  finishBlackjackDealerAndSettle
} from '@/utils/casino/blackjack'
import {
  renderRouletteComponents,
  renderRouletteTableEmbed,
  renderRouletteTimeoutEmbed
} from '@/utils/casino/roulette'
import { recoverRouletteSpin } from '@/utils/casino/roulette/playRound'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

const fetchGameMessage = async (
  client: Client<true>,
  game: {
    guildId: string
    channelId: string
    messageId: string
  }
) => {
  const guild = await client.guilds.fetch(game.guildId).catch(() => null)
  if (!guild) return { guild: null, message: null }

  const channel = await guild.channels.fetch(game.channelId).catch(() => null)
  const message =
    channel?.type === ChannelType.GuildText
      ? await channel.messages.fetch(game.messageId).catch(() => null)
      : null

  return { guild, message }
}

export const casinoInFlightRecoveryJob = async (client: Client<true>) => {
  const [rouletteGames, blackjackGames, baccaratGames] = await Promise.all([
    getStaleSpinningRouletteGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleDealerBlackjackGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleDealingBaccaratGames(CASINO_IN_FLIGHT_GRACE_MS)
  ])

  const guildProcessed = new Map<string, number>()
  let processed = 0

  for (const game of rouletteGames) {
    try {
      const { guild, message } = await fetchGameMessage(client, game)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })
      if (!guildConfig) continue

      if (game.pendingSpinResult && game.activeBetId) {
        await recoverRouletteSpin({
          message,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          bets: game.bets,
          spinResult: game.pendingSpinResult,
          showBalance: game.showBalance,
          guild,
          guildConfig,
          sourceChannelId: game.channelId,
          betId: game.activeBetId
        })
      } else if (
        game.activeBetId &&
        game.lockedAmount &&
        game.lockedAmount > 0
      ) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.lockedAmount,
          betId: game.activeBetId,
          game: 'roulette'
        })

        if (game.bets.length > 0) {
          await updateRouletteGame({
            userId: game.userId,
            guildId: game.guildId,
            phase: 'betting',
            pendingSpinResult: null,
            activeBetId: null,
            lockedAmount: null
          })

          if (message) {
            await message.edit({
              embeds: [
                renderRouletteTableEmbed({
                  gameId: game.gameId,
                  bets: game.bets,
                  phase: 'betting',
                  showBalance: game.showBalance,
                  globalSettings: guildConfig.globalSettings
                })
              ],
              components: renderRouletteComponents({
                gameId: game.gameId,
                phase: 'betting',
                hasBets: game.bets.length > 0,
                hasLastBets: game.lastBets.length > 0
              })
            })
          }
        } else {
          await deleteRouletteGame({
            userId: game.userId,
            guildId: game.guildId
          })
          if (message) {
            await message.edit({
              embeds: [renderRouletteTimeoutEmbed({ autoClosed: true })],
              components: []
            })
          }
        }
      }

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
    } catch (error) {
      logger.error(
        `Roulette in-flight recovery failed for ${game.gameId}`,
        error
      )
    }
  }

  for (const game of blackjackGames) {
    try {
      const { guild, message } = await fetchGameMessage(client, game)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })
      await finishBlackjackDealerAndSettle({
        game,
        engine: docToEngine(game),
        guildConfig,
        guild,
        sourceChannelId: game.channelId,
        showBalance: false,
        message
      })

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
    } catch (error) {
      logger.error(
        `Blackjack in-flight recovery failed for ${game.betId}`,
        error
      )
    }
  }

  for (const game of baccaratGames) {
    try {
      const { guild, message } = await fetchGameMessage(client, game)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })
      if (!guildConfig) continue

      if (game.pendingDeal) {
        await recoverBaccaratDeal({
          message,
          side: game.pendingDeal.side,
          playerCards: game.pendingDeal.playerCards,
          bankerCards: game.pendingDeal.bankerCards,
          userId: game.userId,
          guildId: game.guildId,
          betId: game.betId,
          betAmount: game.betAmount,
          showBalance: game.showBalance,
          winMultipliers: guildConfig.casinoSettings.baccarat.winMultipliers,
          globalSettings: guildConfig.globalSettings,
          guild,
          guildConfig,
          sourceChannelId: game.channelId
        })
      } else {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.betAmount,
          betId: game.betId,
          game: 'baccarat'
        })
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
    } catch (error) {
      logger.error(
        `Baccarat in-flight recovery failed for ${game.betId}`,
        error
      )
    }
  }

  if (processed > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Casino in-flight recovery',
      verb: 'recovered',
      total: processed,
      unit: 'game(s)',
      guildCounts: guildProcessed
    })

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Casino in-flight recovery',
        title: `Recovered ${count} in-flight game(s)`,
        description:
          'Stale casino games left mid-spin or mid-deal were settled or cleaned up after restart.',
        level: 'info'
      })
    }
  }
}
