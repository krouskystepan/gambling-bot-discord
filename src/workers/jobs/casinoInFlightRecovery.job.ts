import { CASINO_IN_FLIGHT_GRACE_MS } from 'gambling-bot-shared/casino'

import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteRouletteGame,
  getGuildConfigByGuildId,
  getStaleDealerBlackjackGames,
  getStaleDealingBaccaratGames,
  getStaleDroppingPlinkoGames,
  getStaleSettlingMinesGames,
  getStaleSpinningRouletteGames,
  getStaleSpinningSlotsGames,
  refundLockedBet,
  updateBaccaratGame,
  updatePlinkoGame,
  updateRouletteGame,
  updateSlotsGame
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  recoverBaccaratDeal,
  renderBaccaratButtons,
  renderBaccaratPromptEmbed
} from '@/utils/casino/baccarat'
import { baccaratLockedTotal } from '@/utils/casino/baccarat/slip'
import {
  docToEngine,
  finishBlackjackDealerAndSettle
} from '@/utils/casino/blackjack'
import { finishMinesAndSettle } from '@/utils/casino/mines'
import {
  recoverPlinkoBatch,
  renderPlinkoBoardEmbed,
  renderPlinkoComponents
} from '@/utils/casino/plinko'
import {
  renderRouletteComponents,
  renderRouletteTableEmbed,
  renderRouletteTimeoutEmbed
} from '@/utils/casino/roulette'
import { recoverRouletteSpin } from '@/utils/casino/roulette/playRound'
import {
  recoverSlotsBatch,
  renderSlotsComponents,
  renderSlotsMachineEmbed
} from '@/utils/casino/slots'
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
  const [
    rouletteGames,
    blackjackGames,
    baccaratGames,
    slotsGames,
    plinkoGames,
    minesGames
  ] = await Promise.all([
    getStaleSpinningRouletteGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleDealerBlackjackGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleDealingBaccaratGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleSpinningSlotsGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleDroppingPlinkoGames(CASINO_IN_FLIGHT_GRACE_MS),
    getStaleSettlingMinesGames(CASINO_IN_FLIGHT_GRACE_MS)
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
              embeds: [
                renderRouletteTimeoutEmbed({
                  autoClosed: true,
                  stats: game.sessionStats,
                  gameId: game.gameId
                })
              ],
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
        `Blackjack in-flight recovery failed for ${game.gameId}`,
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

      const locked = baccaratLockedTotal({
        lockedAmount: game.lockedAmount,
        bets: game.bets
      })
      const slip = game.bets ?? []

      if (
        game.pendingDeal &&
        game.activeBetId &&
        slip.length > 0 &&
        locked > 0
      ) {
        await recoverBaccaratDeal({
          message,
          playerCards: game.pendingDeal.playerCards,
          bankerCards: game.pendingDeal.bankerCards,
          bets: slip,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          betId: game.activeBetId,
          sessionStats: game.sessionStats,
          showBalance: game.showBalance,
          baccaratSettings: guildConfig.casinoSettings.baccarat,
          globalSettings: guildConfig.globalSettings,
          guild,
          guildConfig,
          sourceChannelId: game.channelId
        })
      } else {
        if (game.activeBetId && locked > 0) {
          await refundLockedBet({
            userId: game.userId,
            guildId: game.guildId,
            amount: locked,
            betId: game.activeBetId,
            game: 'baccarat'
          })
        }

        // Hand the table back to the player instead of dropping the session.
        await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          phase: 'waiting',
          activeBetId: null,
          lockedAmount: null,
          pendingDeal: null
        })

        if (message) {
          await message.edit({
            embeds: [
              renderBaccaratPromptEmbed({
                bets: slip,
                gameId: game.gameId,
                globalSettings: guildConfig.globalSettings
              })
            ],
            components: renderBaccaratButtons({
              gameId: game.gameId,
              hasBets: slip.length > 0,
              hasLastBets: (game.lastBets?.length ?? 0) > 0
            })
          })
        }
      }

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
    } catch (error) {
      logger.error(
        `Baccarat in-flight recovery failed for ${game.gameId}`,
        error
      )
    }
  }

  for (const game of slotsGames) {
    try {
      const { guild, message } = await fetchGameMessage(client, game)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })
      if (!guildConfig) continue

      if (
        game.pendingBatchResults &&
        game.pendingBatchResults.length > 0 &&
        game.activeBetId &&
        game.unitBet != null
      ) {
        await recoverSlotsBatch({
          message,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          unitBet: game.unitBet,
          spinsCount: game.pendingBatchResults.length,
          spinResults: game.pendingBatchResults,
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
          game: 'slots'
        })

        const resumePhase =
          game.lastNetResult != null ? ('result' as const) : ('ready' as const)

        await updateSlotsGame({
          userId: game.userId,
          guildId: game.guildId,
          phase: resumePhase,
          pendingBatchResults: null,
          activeBetId: null,
          lockedAmount: null
        })

        if (message) {
          await message.edit({
            embeds: [
              renderSlotsMachineEmbed({
                gameId: game.gameId,
                phase: resumePhase,
                unitBet: game.unitBet,
                spinsCount: game.spinsCount,
                lastNetResult: game.lastNetResult,
                lastSpinsCount: game.lastSpinsCount,
                lastTotalBet: game.lastTotalBet,
                lastWinsCount: game.lastWinsCount,
                showBalance: game.showBalance,
                globalSettings: guildConfig.globalSettings
              })
            ],
            components: renderSlotsComponents({
              gameId: game.gameId,
              phase: resumePhase,
              hasUnitBet: game.unitBet != null,
              spinsCount: game.spinsCount
            })
          })
        }
      }

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
    } catch (error) {
      logger.error(`Slots in-flight recovery failed for ${game.gameId}`, error)
    }
  }

  for (const game of plinkoGames) {
    try {
      const { guild, message } = await fetchGameMessage(client, game)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })
      if (!guildConfig) continue

      if (
        game.pendingBatchResults &&
        game.pendingBatchResults.length > 0 &&
        game.activeBetId &&
        game.unitBet != null
      ) {
        await recoverPlinkoBatch({
          message,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          unitBet: game.unitBet,
          ballsCount: game.pendingBatchResults.length,
          paths: game.pendingBatchResults,
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
          game: 'plinko'
        })

        const resumePhase =
          game.lastNetResult != null ? ('result' as const) : ('ready' as const)

        await updatePlinkoGame({
          userId: game.userId,
          guildId: game.guildId,
          phase: resumePhase,
          pendingBatchResults: null,
          activeBetId: null,
          lockedAmount: null
        })

        if (message) {
          await message.edit({
            embeds: [
              renderPlinkoBoardEmbed({
                gameId: game.gameId,
                phase: resumePhase,
                unitBet: game.unitBet,
                lastNetResult: game.lastNetResult,
                lastTotalBet: game.lastTotalBet,
                lastBallsCount: game.lastBallsCount,
                showBalance: game.showBalance,
                globalSettings: guildConfig.globalSettings,
                binMultipliers: guildConfig.casinoSettings.plinko.binMultipliers
              })
            ],
            components: renderPlinkoComponents({
              gameId: game.gameId,
              phase: resumePhase,
              hasUnitBet: game.unitBet != null
            })
          })
        }
      }

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )
    } catch (error) {
      logger.error(`Plinko in-flight recovery failed for ${game.gameId}`, error)
    }
  }

  for (const game of minesGames) {
    try {
      const { guild, message } = await fetchGameMessage(client, game)
      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })

      await finishMinesAndSettle({
        game,
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
      logger.error(`Mines in-flight recovery failed for ${game.gameId}`, error)
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
          'Stale casino games left mid-spin, mid-batch, mid-deal, or mid-reveal were settled or cleaned up after restart.',
        level: 'info'
      })
    }
  }
}
