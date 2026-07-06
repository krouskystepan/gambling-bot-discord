import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteBlackjackGame,
  getAllOldBlackjackGames,
  getGuildConfigByGuildId,
  settleCasinoWinnings,
  updateBlackjackGame
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  FinalGameResultId,
  applyAction,
  dealerDrawOne,
  dealerShouldDraw,
  docToEngine,
  engineToDoc,
  renderBlackjackEmbed,
  resolveResult
} from '@/utils/casino/blackjack'
import { collectBlackjackBigWinLines } from '@/utils/casino/blackjackBigWin'
import { sleep } from '@/utils/common/utils'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'
import { logger } from '@/utils/logger'

export const blackjackAutostandJob = async (client: Client<true>) => {
  const oldGames = await getAllOldBlackjackGames(1) // older than 1 day

  let processed = 0
  const guildProcessed = new Map<string, number>()

  for (const game of oldGames) {
    try {
      const guild = await client.guilds.fetch(game.guildId).catch(() => null)
      if (!guild) continue

      const channel = await guild.channels
        .fetch(game.channelId)
        .catch(() => null)

      if (!channel || channel.type !== ChannelType.GuildText) continue

      const guildConfig = await getGuildConfigByGuildId({
        guildId: game.guildId
      })
      const globalSettings = guildConfig?.globalSettings

      const message = await channel.messages
        .fetch(game.messageId)
        .catch(() => null)
      if (!message) continue

      await message.edit({ components: [] })

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

      while (dealerShouldDraw(engine)) {
        dealerDrawOne(engine)
      }

      let totalPayout = 0
      for (let i = 0; i < engine.hands.length; i++) {
        const r = resolveResult(engine, i)
        if (r.finished) totalPayout += r.payout
      }

      const totalBet = engine.hands.reduce(
        (sum, hand) => sum + hand.betAmount,
        0
      )
      const net = totalPayout - totalBet

      let finalResultId: FinalGameResultId =
        totalPayout === 0 ? 'LOSS' : totalPayout === totalBet ? 'EVEN' : 'WIN'

      await settleCasinoWinnings({
        userId: game.userId,
        guildId: game.guildId,
        totalBet,
        winnings: totalPayout,
        betId: game.betId,
        game: 'blackjack'
      })

      if (guildConfig) {
        tryAnnounceBigWin({
          guild,
          guildConfig,
          game: 'blackjack',
          lines: collectBlackjackBigWinLines({
            engine,
            globalSettings,
            minMultiplier:
              guildConfig.casinoSettings.winAnnouncements.blackjackMinMultiplier
          }),
          betId: game.betId,
          sourceChannelId: game.channelId
        })
      }

      await message.edit({
        content: 'This game was inactive, so auto-stand was executed.',
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId: game.guildId,
            betId: game.betId,
            hands: engine.hands,
            activeHandIndex: -1,
            dealerCards: engine.dealerCards,
            result: { kind: 'FINAL', finalResultId, netProfit: net },
            showBalance: false,
            globalSettings
          })
        ],
        components: []
      })

      await deleteBlackjackGame({
        userId: game.userId,
        guildId: game.guildId
      })

      processed++
      guildProcessed.set(
        game.guildId,
        (guildProcessed.get(game.guildId) ?? 0) + 1
      )

      await sleep(300)
    } catch (err) {
      logger.error(`Auto-stand failed for game ${game.betId}`, err)
    }
  }

  if (processed > 0) {
    logger.worker(`Blackjack auto-stand: processed ${processed}`)

    for (const [guildId, count] of guildProcessed) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Blackjack auto-stand',
        title: `Processed ${count} game(s)`,
        description:
          'Inactive blackjack games were auto-stood, settled, and removed.',
        level: 'warning'
      })
    }
  }
}
